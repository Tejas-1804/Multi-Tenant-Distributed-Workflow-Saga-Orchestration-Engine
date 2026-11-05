const Box = ({ x, y, w = 150, h = 48, label, sub, tone = 'slate' }: {
  x: number; y: number; w?: number; h?: number; label: string; sub?: string;
  tone?: 'slate' | 'sky' | 'emerald' | 'orange' | 'rose';
}) => {
  const fills = {
    slate: 'fill-slate-50 stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700',
    sky: 'fill-sky-50 stroke-sky-300 dark:fill-sky-950 dark:stroke-sky-800',
    emerald: 'fill-emerald-50 stroke-emerald-300 dark:fill-emerald-950 dark:stroke-emerald-800',
    orange: 'fill-orange-50 stroke-orange-300 dark:fill-orange-950 dark:stroke-orange-800',
    rose: 'fill-rose-50 stroke-rose-300 dark:fill-rose-950 dark:stroke-rose-800',
  };
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} className={fills[tone]} />
      <text x={x + w / 2} y={y + (sub ? 20 : 29)} textAnchor="middle" className="fill-slate-900 text-[12px] font-semibold dark:fill-slate-100">{label}</text>
      {sub && <text x={x + w / 2} y={y + 36} textAnchor="middle" className="fill-slate-500 text-[10px]">{sub}</text>}
    </g>
  );
};

const Arrow = ({ d, dashed = false, color = 'slate' }: { d: string; dashed?: boolean; color?: 'slate' | 'orange' }) => (
  <path
    d={d}
    fill="none"
    markerEnd={color === 'orange' ? 'url(#arrow-o)' : 'url(#arrow)'}
    strokeDasharray={dashed ? '4 4' : undefined}
    className={color === 'orange' ? 'stroke-orange-400' : 'stroke-slate-400'}
    strokeWidth={1.5}
  />
);

const POINTS = [
  ['Each company is isolated', 'Every record carries a tenant id, and every query filters by it, so one company can never read another’s workflows.'],
  ['Failures are retried', 'A step that hits a temporary error (500, timeout) is retried with growing delays before it is declared failed.'],
  ['Failures are undone', 'If a step still fails, the steps that already finished are reversed from last to first, such as releasing stock then refunding payment.'],
  ['Nothing is lost', 'Jobs that run out of retries go to a dead letter queue, where an operator can inspect and replay them.'],
  ['You can watch it live', 'Progress is pushed to the browser over a WebSocket, so each step changes colour as it happens.'],
];

export default function ArchitecturePage() {
  return (
    <article className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">How it works</h1>
        <p className="mt-2 max-w-prose text-slate-600 dark:text-slate-300">
          This engine runs multi-step business processes, like taking an order, and keeps data
          consistent when one step fails halfway through. That technique is called the saga pattern.
        </p>
      </header>

      <figure className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <svg viewBox="0 0 760 330" role="img" aria-labelledby="arch-t arch-d" className="min-w-[640px] w-full">
          <title id="arch-t">Architecture and saga flow</title>
          <desc id="arch-d">
            A browser talks to an API server. The workflow engine runs steps in order. If a step fails
            after retries, completed steps are undone in reverse and the failed job goes to a dead letter queue.
          </desc>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="fill-slate-400" />
            </marker>
            <marker id="arrow-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="fill-orange-400" />
            </marker>
          </defs>

          <text x="0" y="14" className="fill-slate-400 text-[11px]">Request path</text>
          <Box x={0} y={24} label="Browser" sub="React + live view" tone="sky" />
          <Box x={200} y={24} label="API server" sub="Login, roles, limits" />
          <Box x={400} y={24} label="Workflow engine" sub="Runs steps in order" tone="sky" />
          <Box x={600} y={24} label="Database" sub="MongoDB" />
          <Arrow d="M150 48H198" /><Arrow d="M350 48H398" /><Arrow d="M550 48H598" />

          <text x="0" y="130" className="fill-slate-400 text-[11px]">Order saga (happy path, then failure)</text>
          <Box x={0} y={140} w={130} label="Capture payment" tone="emerald" />
          <Box x={170} y={140} w={130} label="Reserve stock" tone="emerald" />
          <Box x={340} y={140} w={130} label="Create waybill" sub="fails 3 times" tone="rose" />
          <Arrow d="M130 164H168" /><Arrow d="M300 164H338" />

          <Box x={510} y={140} w={160} label="Dead letter queue" sub="kept for replay" />
          <Arrow d="M470 164H508" dashed />

          <text x="0" y="250" className="fill-orange-500 text-[11px]">Rollback, last step first</text>
          <Box x={170} y={260} w={130} label="Release stock" tone="orange" />
          <Box x={0} y={260} w={130} label="Refund payment" tone="orange" />
          <Arrow d="M405 188V224H235V258" color="orange" />
          <Arrow d="M168 284H132" color="orange" />
        </svg>
        <figcaption className="mt-2 text-xs text-slate-500">
          When “Create waybill” fails, the engine undoes the earlier steps in reverse order.
        </figcaption>
      </figure>

      <dl className="grid gap-4 sm:grid-cols-2">
        {POINTS.map(([t, d]) => (
          <div key={t} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t}</dt>
            <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}