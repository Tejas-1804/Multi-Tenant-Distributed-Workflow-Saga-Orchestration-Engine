import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Play,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Activity,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import api from '../services/api.ts';
import { useWebSocket } from '../hooks/useWebSocket.ts';
import {
  WorkflowExecution,
  WorkflowNodeExecution,
  Workflow as IWorkflow,
} from '../types/index.ts';

interface ExecutionDetailPageProps {
  executionId: string;
  onBack: () => void;
  onOpenWorkflow: (workflowId: string) => void;
}

export const ExecutionDetailPage: React.FC<ExecutionDetailPageProps> = ({
  executionId,
  onBack,
  onOpenWorkflow,
}) => {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [workflow, setWorkflow] = useState<IWorkflow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);

  // Hook up live WebSocket
  const { isConnected, lastEvent, subscribeExecution } = useWebSocket();

  // Load execution data
  const loadExecution = async () => {
    try {
      const res = await api.get(`/executions/${executionId}`);
      const exec: WorkflowExecution = res.data;
      setExecution(exec);

      // Extract all current logs across nodes
      const allLogs: string[] = [];
      Object.values(exec.nodeExecutions).forEach(ne => {
        if (ne.logs) allLogs.push(...ne.logs);
      });
      setLiveLogs(allLogs);

      // Load workflow definition
      if (exec.workflowId) {
        const wfRes = await api.get(`/workflows/${exec.workflowId}`);
        setWorkflow(wfRes.data);
      }
    } catch (err) {
      console.error('Failed to load execution details:', err);
    }
  };

  useEffect(() => {
    loadExecution();
    subscribeExecution(executionId);

    // Polling fallback every 3 seconds if active
    const interval = setInterval(() => {
      if (execution?.status === 'RUNNING' || execution?.status === 'RETRYING' || execution?.status === 'COMPENSATING') {
        loadExecution();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [executionId]);

  // Handle live WebSocket event for this execution
  useEffect(() => {
    if (!lastEvent || lastEvent.executionId !== executionId) return;

    if (lastEvent.type === 'EXECUTION_STATUS_CHANGED') {
      setExecution(prev => prev ? { ...prev, status: lastEvent.data.status, completedAt: lastEvent.data.completedAt } : prev);
      setLiveLogs(prev => [...prev, `[EVENT] Execution status transitioned to ${lastEvent.data.status}`]);
    } else if (lastEvent.type === 'NODE_STATUS_CHANGED') {
      const { nodeId, data } = lastEvent;
      setExecution(prev => {
        if (!prev) return prev;
        const currentNe = prev.nodeExecutions[nodeId!] || {
          id: 'ne_' + nodeId,
          executionId,
          nodeId: nodeId!,
          nodeType: 'HTTP_REQUEST',
          nodeLabel: nodeId!,
          status: data.status,
          attempts: 1,
          maxAttempts: 1,
          logs: [],
        };
        return {
          ...prev,
          currentNodeId: nodeId,
          nodeExecutions: {
            ...prev.nodeExecutions,
            [nodeId!]: {
              ...currentNe,
              status: data.status,
              output: data.output || currentNe.output,
              error: data.error || currentNe.error,
            },
          },
        };
      });
      setLiveLogs(prev => [...prev, `[NODE] ${nodeId} status: ${data.status}`]);
    } else if (lastEvent.type === 'RETRY_ATTEMPT') {
      const { nodeId, data } = lastEvent;
      setLiveLogs(prev => [
        ...prev,
        `[RETRY] Node ${nodeId} retry attempt ${data.attempt}/${data.maxAttempts} with backoff delay...`,
      ]);
    } else if (lastEvent.type === 'COMPENSATION_TRIGGERED') {
      setLiveLogs(prev => [
        ...prev,
        `[SAGA TRIGGERED] Downstream failure detected! Initiating reverse Saga compensation rollback...`,
      ]);
      loadExecution();
    } else if (lastEvent.type === 'COMPENSATION_NODE_STATUS') {
      const { nodeId, data } = lastEvent;
      setLiveLogs(prev => [
        ...prev,
        `[SAGA ROLLBACK] Compensating node ${nodeId}: ${data.actionTaken || data.status}`,
      ]);
      loadExecution();
    } else if (lastEvent.type === 'EXECUTION_COMPLETED') {
      setExecution(prev => prev ? { ...prev, status: lastEvent.data.status } : prev);
      setLiveLogs(prev => [...prev, `[COMPLETE] Execution terminated with status: ${lastEvent.data.status}`]);
      loadExecution();
    }
  }, [lastEvent, executionId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/executions/${executionId}/cancel`);
      await loadExecution();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono text-xs flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>SUCCESS</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="px-2.5 py-1 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-mono text-xs flex items-center gap-1.5 font-bold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>RUNNING</span>
          </span>
        );
      case 'RETRYING':
        return (
          <span className="px-2.5 py-1 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 font-mono text-xs flex items-center gap-1.5 font-bold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>RETRYING (EXPONENTIAL BACKOFF)</span>
          </span>
        );
      case 'COMPENSATING':
        return (
          <span className="px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-xs flex items-center gap-1.5 font-bold animate-pulse">
            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            <span>COMPENSATING (SAGA ROLLBACK)</span>
          </span>
        );
      case 'COMPENSATED':
        return (
          <span className="px-2.5 py-1 rounded bg-amber-950/90 text-amber-300 border border-amber-700 font-mono text-xs flex items-center gap-1.5 font-bold">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>COMPENSATED (TRANSACTION SAFE)</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-1 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-mono text-xs flex items-center gap-1.5 font-bold">
            <XCircle className="w-3.5 h-3.5" />
            <span>FAILED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 font-mono text-xs">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 font-mono text-xs">
            {status}
          </span>
        );
    }
  };

  if (!execution) {
    return (
      <div className="p-8 text-center text-zinc-400 font-mono text-xs">
        Loading execution trace...
      </div>
    );
  }

  const nodesList = workflow?.nodes || [];
  const selectedNodeExec = selectedNodeId ? execution.nodeExecutions[selectedNodeId] : null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-zinc-100 font-mono">
                {execution.workflowName}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-xs font-mono text-zinc-400">{execution.id}</span>
            </div>
            <div className="text-xs text-zinc-400 font-mono flex items-center gap-3 mt-0.5">
              <span>Trigger: {execution.trigger} ({execution.triggeredBy})</span>
              <span>·</span>
              <span>Started: {new Date(execution.startedAt).toLocaleTimeString()}</span>
              {execution.completedAt && (
                <>
                  <span>·</span>
                  <span>
                    Duration: {Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()))}ms
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(execution.status)}

          {['RUNNING', 'RETRYING', 'COMPENSATING'].includes(execution.status) && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3 py-1.5 rounded-lg border border-rose-800 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-mono cursor-pointer"
            >
              Cancel Execution
            </button>
          )}

          <button
            onClick={() => onOpenWorkflow(execution.workflowId)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono cursor-pointer"
          >
            Inspect DAG
          </button>
        </div>
      </div>

      {/* SAGA COMPENSATED BANNER IF ROLLBACK OCCURRED */}
      {execution.status === 'COMPENSATED' && (
        <div className="p-4 rounded-xl border border-amber-800/80 bg-amber-950/40 text-xs font-mono space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <RotateCcw className="w-4 h-4" />
            <span>SAGA ROLLBACK COMPLETED WITH ZERO TRANSACTION LEAKAGE</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            A downstream node encountered a fatal error. The Saga Orchestrator caught the failure, moved the job to the Dead Letter Queue, and automatically invoked rollback compensations for all preceding succeeded nodes in reverse topological order (
            {execution.compensationsExecuted.join(' ← ')}).
          </p>
        </div>
      )}

      {/* Main Execution View: Left Step Timeline + Right Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step-by-Step DAG Execution Timeline */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Execution Node Timeline</h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              CLICK ANY STEP TO INSPECT INPUT/OUTPUT
            </span>
          </div>

          <div className="space-y-3">
            {nodesList.map((node, index) => {
              const nodeExec = execution.nodeExecutions[node.id];
              const isSelected = selectedNodeId === node.id;
              const status = nodeExec?.status || 'PENDING';

              let statusColor = 'text-zinc-500 border-zinc-800 bg-zinc-950/60';
              let icon = <Clock className="w-3.5 h-3.5 text-zinc-500" />;

              if (status === 'SUCCESS') {
                statusColor = 'text-emerald-400 border-emerald-900/60 bg-emerald-950/20';
                icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
              } else if (status === 'RUNNING') {
                statusColor = 'text-cyan-400 border-cyan-800 bg-cyan-950/40 ring-1 ring-cyan-500';
                icon = <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />;
              } else if (status === 'RETRYING') {
                statusColor = 'text-purple-400 border-purple-800 bg-purple-950/40 ring-1 ring-purple-500';
                icon = <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />;
              } else if (status === 'COMPENSATING') {
                statusColor = 'text-amber-400 border-amber-800 bg-amber-950/40 ring-1 ring-amber-500';
                icon = <RotateCcw className="w-4 h-4 text-amber-400 animate-spin" />;
              } else if (status === 'COMPENSATED') {
                statusColor = 'text-amber-400 border-amber-800/80 bg-amber-950/30';
                icon = <RotateCcw className="w-4 h-4 text-amber-400" />;
              } else if (status === 'FAILED') {
                statusColor = 'text-rose-400 border-rose-900/80 bg-rose-950/30';
                icon = <XCircle className="w-4 h-4 text-rose-400" />;
              } else if (status === 'SKIPPED') {
                statusColor = 'text-zinc-600 border-zinc-900 bg-zinc-950/40 line-through';
                icon = <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />;
              }

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${statusColor} ${
                    isSelected ? 'ring-2 ring-emerald-400 shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">{icon}</div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                        <span>{node.data.label || node.id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {node.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {nodeExec?.error ? (
                          <span className="text-rose-400 font-semibold">{nodeExec.error}</span>
                        ) : node.data.description ? (
                          <span>{node.data.description}</span>
                        ) : (
                          <span>Step {index + 1} of workflow</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono space-y-0.5">
                    <span className="font-bold">{status}</span>
                    {nodeExec && nodeExec.attempts > 1 && (
                      <div className="text-[10px] text-purple-400 font-semibold">
                        Attempt {nodeExec.attempts}/{nodeExec.maxAttempts}
                      </div>
                    )}
                    {status === 'COMPENSATED' && (
                      <div className="text-[10px] text-amber-400 font-bold">
                        ⤾ Rolled Back
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Step Payload & Context Inspector */}
        <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between space-y-4 font-mono text-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="font-bold text-zinc-200">STEP INSPECTOR</span>
              <span className="text-[10px] text-zinc-400">
                {selectedNodeId || 'Global Context'}
              </span>
            </div>

            {selectedNodeExec ? (
              <div className="space-y-3 mt-3">
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase">Node Label</div>
                  <div className="text-xs font-bold text-zinc-100">{selectedNodeExec.nodeLabel}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase">Status & Attempts</div>
                  <div className="text-xs text-zinc-300">
                    Status: <span className="font-bold text-emerald-400">{selectedNodeExec.status}</span> · Attempts: {selectedNodeExec.attempts}
                  </div>
                </div>

                {selectedNodeExec.error && (
                  <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] space-y-1">
                    <div className="font-bold">Error Encountered:</div>
                    <div>{selectedNodeExec.error}</div>
                  </div>
                )}

                {selectedNodeExec.output && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-400 uppercase">Node Output Payload</div>
                    <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-48">
                      {JSON.stringify(selectedNodeExec.output, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedNodeExec.logs && selectedNodeExec.logs.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-400 uppercase">Step Activity Logs</div>
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 space-y-1 max-h-36 overflow-y-auto">
                      {selectedNodeExec.logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  Click any node on the left timeline to inspect its discrete input, output payload, retry backoff times, and Saga compensation execution state.
                </div>
                <div className="space-y-1 pt-2">
                  <div className="text-[10px] text-zinc-400 uppercase">Initial Ingestion Payload</div>
                  <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-60">
                    {JSON.stringify(execution.contextData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Execution Console Logs */}
      <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-zinc-200 text-xs">Real-Time Orchestration Event Stream</h3>
          </div>
          <span className="text-[10px] text-zinc-500">WEBSOCKET FEED: /ws</span>
        </div>

        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 max-h-48 overflow-y-auto space-y-1 font-mono">
          {liveLogs.length === 0 ? (
            <div className="text-zinc-500">Waiting for events...</div>
          ) : (
            liveLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-zinc-600 mr-2">{idx + 1}.</span>
                <span className={log.includes('ERROR') || log.includes('FAILED') ? 'text-rose-400' : log.includes('SAGA') ? 'text-amber-400' : log.includes('SUCCESS') ? 'text-emerald-400' : 'text-zinc-300'}>
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
