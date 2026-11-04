import { motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  RefreshCw,
  SkipForward,
  Undo2,
  XCircle,
} from 'lucide-react';

export type StepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'RETRYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export interface SagaStep {
  nodeId: string;
  name: string;
  status: StepStatus;
  startedAt?: string | number;
  finishedAt?: string | number;
  attempts?: number;
  maxAttempts?: number;
  error?: string;
  compensationName?: string;
  compensatedAt?: string | number;
}

interface Props {
  steps: SagaStep[];
  className?: string;
}

const STATUS_META: Record<
  StepStatus,
  { label: string; icon: typeof CheckCircle2; tone: string; spin?: boolean }
> = {
  PENDING: { label: 'Waiting', icon: CircleDashed, tone: 'text-slate-400' },
  RUNNING: { label: 'Running', icon: Loader2, tone: 'text-sky-500', spin: true },
  RETRYING: { label: 'Retrying', icon: RefreshCw, tone: 'text-amber-500', spin: true },
  SUCCESS: { label: 'Done', icon: CheckCircle2, tone: 'text-emerald-500' },
  FAILED: { label: 'Failed', icon: XCircle, tone: 'text-rose-500' },
  SKIPPED: { label: 'Skipped', icon: SkipForward, tone: 'text-slate-400' },
  COMPENSATING: { label: 'Undoing', icon: Loader2, tone: 'text-orange-500', spin: true },
  COMPENSATED: { label: 'Undone', icon: Undo2, tone: 'text-orange-500' },
};

const toMs = (v?: string | number) => (v === undefined ? undefined : new Date(v).getTime());
function duration(step: SagaStep) {
  const a = toMs(step.startedAt);
  const b = toMs(step.finishedAt);
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return null;
  const ms = Math.max(0, b - a);
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatusIcon({ status }: { status: StepStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Icon
      aria-hidden
      className={`h-5 w-5 shrink-0 ${meta.tone} ${meta.spin ? 'animate-spin' : ''}`}
    />
  );
}

function Row({
  step,
  title,
  note,
  index,
  reduce,
}: {
  step: SagaStep;
  title: string;
  note?: string;
  index: number;
  reduce: boolean;
}) {
  const meta = STATUS_META[step.status];
  const d = duration(step);
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: reduce ? 0 : Math.min(index * 0.04, 0.3) }}
      className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-3 py-2.5"
    >
      <div className="pt-0.5">
        <StatusIcon status={step.status} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {meta.label}
          {step.attempts && step.attempts > 1
            ? ` · attempt ${step.attempts}${step.maxAttempts ? ` of ${step.maxAttempts}` : ''}`
            : ''}
          {note ? ` · ${note}` : ''}
        </p>
        {step.error && step.status === 'FAILED' && (
          <p className="mt-1 rounded bg-rose-50 px-2 py-1 font-mono text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {step.error}
          </p>
        )}
      </div>
      <span className="pt-0.5 font-mono text-xs tabular-nums text-slate-400">{d ?? ''}</span>
    </motion.li>
  );
}

export default function SagaTimeline({ steps, className = '' }: Props) {
  const reduce = useReducedMotion() ?? false;

  const forward = steps.filter((s) => s.status !== 'COMPENSATED' && s.status !== 'COMPENSATING');

  const rollback = steps
    .filter((s) => s.status === 'COMPENSATED' || s.status === 'COMPENSATING')
    .sort((a, b) => (toMs(a.compensatedAt) ?? 0) - (toMs(b.compensatedAt) ?? 0));

  const failed = steps.find((s) => s.status === 'FAILED');
  const hasRollback = rollback.length > 0;

  if (steps.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700 ${className}`}>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No steps yet</p>
        <p className="mt-1 text-xs text-slate-500">Run the workflow to see each step appear here.</p>
      </div>
    );
  }

  return (
    <section
      aria-label="Saga execution timeline"
      className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <ol className="divide-y divide-slate-100 dark:divide-slate-800">
        {forward.map((s, i) => (
          <Row key={s.nodeId} step={s} title={s.name} index={i} reduce={reduce} />
        ))}
      </ol>

      {hasRollback && (
        <>
          <div className="my-3 flex items-center gap-3" role="separator">
            <div className="h-px flex-1 bg-orange-300 dark:bg-orange-800" />
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
              {failed
                ? `“${failed.name}” failed after ${failed.attempts ?? 1} attempt${(failed.attempts ?? 1) === 1 ? '' : 's'}. Undoing completed steps in reverse.`
                : 'Undoing completed steps in reverse.'}
            </p>
            <div className="h-px flex-1 bg-orange-300 dark:bg-orange-800" />
          </div>

          <ol className="divide-y divide-orange-100 rounded-md bg-orange-50/60 px-3 dark:divide-orange-950 dark:bg-orange-950/20">
            {rollback.map((s, i) => (
              <Row
                key={`c-${s.nodeId}`}
                step={s}
                title={s.compensationName ?? `Undo: ${s.name}`}
                note={`reverses “${s.name}”`}
                index={i}
                reduce={reduce}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export function toSteps(execution: {
  nodeStates?: Record<string, any>;
  nodes?: { id: string; data?: { label?: string; compensation?: { label?: string } } }[];
}): SagaStep[] {
  const states = execution.nodeStates ?? {};
  return (execution.nodes ?? []).map((n) => {
    const st = states[n.id] ?? {};
    return {
      nodeId: n.id,
      name: n.data?.label ?? n.id,
      status: (st.status as StepStatus) ?? 'PENDING',
      startedAt: st.startedAt,
      finishedAt: st.finishedAt,
      attempts: st.attempts,
      maxAttempts: st.maxAttempts,
      error: st.error,
      compensationName: n.data?.compensation?.label,
      compensatedAt: st.compensatedAt,
    };
  });
}