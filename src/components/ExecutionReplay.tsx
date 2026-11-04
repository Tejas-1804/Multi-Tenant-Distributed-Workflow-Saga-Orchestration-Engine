import { useEffect, useRef, useState, useMemo } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import SagaTimeline, { SagaStep } from './SagaTimeline';

const ms = (v?: string | number) => (v === undefined ? undefined : new Date(v).getTime());

function statusAt(step: SagaStep, t: number): SagaStep {
  const start = ms(step.startedAt);
  const end = ms(step.finishedAt);
  const comp = ms(step.compensatedAt);
  const final = step.status;

  if (start === undefined || t < start) return { ...step, status: 'PENDING' };

  const wasCompensated = final === 'COMPENSATED' || final === 'COMPENSATING';
  if (wasCompensated && comp !== undefined) {
    if (t >= comp) return { ...step, status: final };
    if (end !== undefined && t >= end) return { ...step, status: 'SUCCESS' };
    return { ...step, status: 'RUNNING' };
  }
  if (end === undefined || t < end) return { ...step, status: 'RUNNING' };
  return { ...step, status: final };
}

export default function ExecutionReplay({ steps }: { steps: SagaStep[] }) {
  const { from, to } = useMemo(() => {
    const all = steps.flatMap((s) => [ms(s.startedAt), ms(s.finishedAt), ms(s.compensatedAt)])
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    return { from: Math.min(...all), to: Math.max(...all) };
  }, [steps]);

  const span = Math.max(1, to - from);
  const [pos, setPos] = useState(span); 
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const speed = span / 6000;
    const tick = (now: number) => {
      setPos((p) => {
        const next = p + (now - last) * speed;
        if (next >= span) { setPlaying(false); return span; }
        return next;
      });
      last = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, span]);

  if (steps.length === 0 || !Number.isFinite(from)) return null;

  const at = from + pos;
  const view = steps.map((s) => statusAt(s, at));

  const toggle = () => {
    if (!playing && pos >= span) setPos(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="rounded-md bg-slate-900 p-2 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setPos(0); }}
          aria-label="Restart replay"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={span}
          value={pos}
          onChange={(e) => { setPlaying(false); setPos(Number(e.target.value)); }}
          aria-label="Replay position"
          className="flex-1 accent-sky-500"
        />
        <span className="w-16 text-right font-mono text-xs tabular-nums text-slate-500">
          {(pos / 1000).toFixed(1)}s
        </span>
      </div>
      <SagaTimeline steps={view} />
    </div>
  );
}
