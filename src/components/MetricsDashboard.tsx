import { useMemo } from 'react';

/**
 * MetricsDashboard
 * ----------------
 * Computes everything client-side from a list of executions, so it needs no new
 * backend endpoint and no chart library (charts are plain SVG / Tailwind).
 *
 * Pass the executions you already fetch from /api/executions.
 */

export interface ExecutionRecord {
  id: string;
  status: string; // SUCCESS | FAILED | COMPENSATED | RUNNING | PENDING ...
  workflowName?: string;
  startedAt?: string | number;
  finishedAt?: string | number;
  retryCount?: number;
}

interface Props {
  executions: ExecutionRecord[];
  /** How many days to show in the activity chart. Default 14. */
  days?: number;
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: '#10b981',
  COMPLETED: '#10b981',
  COMPENSATED: '#f97316',
  FAILED: '#f43f5e',
  RUNNING: '#0ea5e9',
  PENDING: '#94a3b8',
};
const colorFor = (s: string) => STATUS_COLOR[s] ?? '#94a3b8';

const isSuccess = (s: string) => s === 'SUCCESS' || s === 'COMPLETED';

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function fmtMs(ms: number) {
  if (!ms) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function MetricsDashboard({ executions, days = 14 }: Props) {
  const m = useMemo(() => {
    const total = executions.length;
    const byStatus: Record<string, number> = {};
    const durations: number[] = [];
    let retries = 0;
    const perWorkflow = new Map<string, { runs: number; ok: number; dur: number[] }>();

    for (const e of executions) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      retries += e.retryCount ?? 0;

      let dur: number | undefined;
      if (e.startedAt !== undefined && e.finishedAt !== undefined) {
        const d = new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime();
        if (Number.isFinite(d) && d >= 0) {
          dur = d;
          durations.push(d);
        }
      }

      const name = e.workflowName ?? 'Unnamed workflow';
      const w = perWorkflow.get(name) ?? { runs: 0, ok: 0, dur: [] };
      w.runs += 1;
      if (isSuccess(e.status)) w.ok += 1;
      if (dur !== undefined) w.dur.push(dur);
      perWorkflow.set(name, w);
    }

    durations.sort((a, b) => a - b);
    const finished = total - (byStatus.RUNNING ?? 0) - (byStatus.PENDING ?? 0);
    const succeeded = (byStatus.SUCCESS ?? 0) + (byStatus.COMPLETED ?? 0);

    // Daily buckets for the activity chart
    const buckets: { key: string; label: string; ok: number; comp: number; fail: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({
        key: dayKey(d),
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        ok: 0,
        comp: 0,
        fail: 0,
      });
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const e of executions) {
      if (e.startedAt === undefined) continue;
      const i = index.get(dayKey(new Date(e.startedAt)));
      if (i === undefined) continue;
      if (isSuccess(e.status)) buckets[i].ok++;
      else if (e.status === 'COMPENSATED') buckets[i].comp++;
      else if (e.status === 'FAILED') buckets[i].fail++;
    }

    return {
      total,
      byStatus,
      successRate: finished ? (succeeded / finished) * 100 : 0,
      avg: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95: percentile(durations, 95),
      retries,
      buckets,
      workflows: [...perWorkflow.entries()]
        .map(([name, w]) => ({
          name,
          runs: w.runs,
          rate: w.runs ? (w.ok / w.runs) * 100 : 0,
          avg: w.dur.length ? w.dur.reduce((a, b) => a + b, 0) / w.dur.length : 0,
        }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 6),
    };
  }, [executions, days]);

  if (executions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No executions yet</p>
        <p className="mt-1 text-xs text-slate-500">Run a workflow and its metrics will show up here.</p>
      </div>
    );
  }

  // --- activity chart geometry ---
  const W = 640;
  const H = 180;
  const padL = 28;
  const padB = 22;
  const maxDay = Math.max(1, ...m.buckets.map((b) => b.ok + b.comp + b.fail));
  const barW = (W - padL) / m.buckets.length;
  const y = (v: number) => (H - padB) * (1 - v / maxDay);

  const statusEntries = Object.entries(m.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total runs" value={String(m.total)} />
        <Stat
          label="Success rate"
          value={`${m.successRate.toFixed(1)}%`}
          hint="Of runs that have finished"
        />
        <Stat label="Average duration" value={fmtMs(m.avg)} hint={`p95 ${fmtMs(m.p95)}`} />
        <Stat
          label="Rolled back"
          value={String(m.byStatus.COMPENSATED ?? 0)}
          hint={`${m.retries} retries in total`}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Runs per day
          </h3>
          <ul className="flex gap-3 text-xs text-slate-500">
            {[
              ['Succeeded', '#10b981'],
              ['Rolled back', '#f97316'],
              ['Failed', '#f43f5e'],
            ].map(([l, c]) => (
              <li key={l} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
                {l}
              </li>
            ))}
          </ul>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Stacked bar chart of runs per day over the last ${days} days`}
          className="w-full"
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W}
                y1={y(maxDay * t)}
                y2={y(maxDay * t)}
                className="stroke-slate-200 dark:stroke-slate-800"
              />
              <text
                x={padL - 6}
                y={y(maxDay * t) + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px]"
              >
                {Math.round(maxDay * t)}
              </text>
            </g>
          ))}
          {m.buckets.map((b, i) => {
            const x = padL + i * barW + barW * 0.2;
            const w = barW * 0.6;
            let top = H - padB;
            const seg = (v: number, c: string) => {
              if (!v) return null;
              const h = (H - padB) - y(v);
              top -= h;
              return <rect key={c} x={x} y={top} width={w} height={h} fill={c} rx={1.5} />;
            };
            return (
              <g key={b.key}>
                <title>{`${b.label}: ${b.ok} succeeded, ${b.comp} rolled back, ${b.fail} failed`}</title>
                {seg(b.ok, '#10b981')}
                {seg(b.comp, '#f97316')}
                {seg(b.fail, '#f43f5e')}
                {(i % 2 === 0 || m.buckets.length <= 8) && (
                  <text
                    x={x + w / 2}
                    y={H - 6}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px]"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Outcome mix
          </h3>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {statusEntries.map(([s, n]) => (
              <div
                key={s}
                title={`${s}: ${n}`}
                style={{ width: `${(n / m.total) * 100}%`, background: colorFor(s) }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {statusEntries.map(([s, n]) => (
              <li key={s} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-sm" style={{ background: colorFor(s) }} />
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </span>
                <span className="font-mono tabular-nums text-slate-500">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Busiest workflows
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2 font-medium">Workflow</th>
                <th className="pb-2 text-right font-medium">Runs</th>
                <th className="pb-2 text-right font-medium">Success</th>
                <th className="pb-2 text-right font-medium">Avg time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {m.workflows.map((w) => (
                <tr key={w.name}>
                  <td className="max-w-[12rem] truncate py-2 text-slate-700 dark:text-slate-200">
                    {w.name}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-500">{w.runs}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                    {w.rate.toFixed(0)}%
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                    {fmtMs(w.avg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}