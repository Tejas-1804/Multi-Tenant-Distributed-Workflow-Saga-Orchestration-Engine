import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, CheckCircle2, XCircle, RotateCcw, RefreshCw, Filter } from 'lucide-react';
import api from '../services/api.ts';
import { WorkflowExecution } from '../types/index.ts';

interface ExecutionsListPageProps {
  onOpenExecution: (id: string) => void;
}

export const ExecutionsListPage: React.FC<ExecutionsListPageProps> = ({ onOpenExecution }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadExecutions = async () => {
    try {
      const res = await api.get('/executions');
      setExecutions(res.data);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = executions.filter(e => {
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Workflow Execution Traces
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Audit logs and real-time state machine history for DAG workflow runs.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-zinc-800 bg-zinc-900/60 font-mono text-xs">
          {['ALL', 'SUCCESS', 'RUNNING', 'COMPENSATED', 'FAILED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          Loading executions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs font-mono text-zinc-500">
          No executions matching filter "{filterStatus}".
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-500 uppercase text-[10px]">
                <th className="py-3 px-4">Execution ID</th>
                <th className="py-3 px-4">Workflow Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4">Saga Rollback</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filtered.map(exec => {
                let badgeClass = 'bg-zinc-800 text-zinc-300';
                if (exec.status === 'SUCCESS') badgeClass = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';
                if (exec.status === 'RUNNING') badgeClass = 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 animate-pulse';
                if (exec.status === 'FAILED') badgeClass = 'bg-rose-950/80 text-rose-300 border border-rose-800/60';
                if (exec.status === 'COMPENSATED') badgeClass = 'bg-amber-950/80 text-amber-300 border border-amber-800/60';

                return (
                  <tr key={exec.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-zinc-200">{exec.id}</td>
                    <td className="py-3.5 px-4 text-zinc-200 font-bold max-w-xs truncate">{exec.workflowName}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">{exec.trigger}</td>
                    <td className="py-3.5 px-4">
                      {exec.compensationsExecuted && exec.compensationsExecuted.length > 0 ? (
                        <span className="text-amber-400 font-bold">
                          {exec.compensationsExecuted.length} nodes compensated
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {new Date(exec.startedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onOpenExecution(exec.id)}
                        className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs cursor-pointer"
                      >
                        Trace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
