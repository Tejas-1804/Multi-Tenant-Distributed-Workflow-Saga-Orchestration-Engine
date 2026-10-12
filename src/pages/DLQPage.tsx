import React, { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api.ts';
import { DeadLetterJob } from '../types/index.ts';

interface DLQPageProps {
  onOpenExecution: (id: string) => void;
}

export const DLQPage: React.FC<DLQPageProps> = ({ onOpenExecution }) => {
  const [jobs, setJobs] = useState<DeadLetterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<DeadLetterJob | null>(null);

  const loadDLQ = async () => {
    try {
      const res = await api.get('/dlq');
      setJobs(res.data);
    } catch (err) {
      console.error('Failed to load DLQ jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDLQ();
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      const res = await api.post(`/dlq/${jobId}/retry`);
      alert('Job re-queued successfully!');
      await loadDLQ();
      if (res.data.newExecutionId) {
        onOpenExecution(res.data.newExecutionId);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDiscard = async (jobId: string) => {
    if (!confirm('Discard this DLQ job?')) return;
    try {
      await api.delete(`/dlq/${jobId}`);
      await loadDLQ();
      setSelectedJob(null);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-rose-400 font-bold uppercase">
              FAULT TOLERANCE SUBSYSTEM
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Dead Letter Queue (DLQ)
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Failed jobs that exhausted exponential backoff retry policies. Inspect payloads, analyze root-cause errors, and trigger manual replays.
          </p>
        </div>

        <button
          onClick={loadDLQ}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-200 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          Loading Dead Letter Queue...
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/30 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">Dead Letter Queue is empty</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            All distributed nodes are processing cleanly without unrecoverable errors.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DLQ List */}
          <div className="lg:col-span-2 space-y-3">
            {jobs.map(job => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                  selectedJob?.id === job.id
                    ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="font-mono text-xs font-bold text-zinc-200">
                      {job.nodeLabel || job.nodeId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {job.attempts} ATTEMPTS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                      {job.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 font-mono">
                  Workflow: <span className="text-zinc-200 font-semibold">{job.workflowName}</span>
                </div>

                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-rose-400">
                  {job.error}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-400">
                  <span>Queued: {new Date(job.createdAt).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleRetry(job.id);
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Replay Job</span>
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDiscard(job.id);
                      }}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Discard</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Job Payload Inspector Side Panel */}
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 font-mono text-xs space-y-4">
            <div className="pb-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-bold text-zinc-200">JOB DETAILS</span>
              <span className="text-[10px] text-zinc-400">{selectedJob?.id || 'Select Job'}</span>
            </div>

            {selectedJob ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase">Failed Node Target</div>
                  <div className="text-xs font-bold text-zinc-100">{selectedJob.nodeLabel}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase">Original Execution Reference</div>
                  <div className="text-xs text-zinc-300">{selectedJob.executionId}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase">Payload at Time of Failure</div>
                  <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-64">
                    {JSON.stringify(selectedJob.payload, null, 2)}
                  </pre>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleRetry(selectedJob.id)}
                    className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Replay into Engine
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs">
                Select a failed job on the left to inspect its complete state.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
