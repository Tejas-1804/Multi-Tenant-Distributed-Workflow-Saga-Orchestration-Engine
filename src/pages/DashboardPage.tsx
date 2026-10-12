import React, { useState, useEffect } from 'react';
import {
  Workflow,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  Server,
  Play,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import api from '../services/api.ts';
import { SystemStats, WorkflowExecution, Workflow as IWorkflow } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DashboardPageProps {
  onOpenWorkflowBuilder: (workflowId?: string) => void;
  onOpenExecutionDetail: (executionId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenWorkflowBuilder,
  onOpenExecutionDetail,
  onNavigateTab,
}) => {
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<WorkflowExecution[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringDemo, setTriggeringDemo] = useState(false);

  const loadData = async () => {
    try {
      const [statsRes, execsRes, wfRes] = await Promise.all([
        api.get('/admin/statistics'),
        api.get('/executions'),
        api.get('/workflows'),
      ]);
      setStats(statsRes.data);
      setRecentExecutions(execsRes.data.slice(0, 8));
      setWorkflows(wfRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Quick Demo Trigger
  const triggerDemoSaga = async (simulateFailure: boolean) => {
    setTriggeringDemo(true);
    try {
      // Find or pick first workflow
      const targetWf = workflows.find(w => w.name.includes('Order Processing') || w.name.includes('Saga')) || workflows[0];
      if (!targetWf) {
        alert('No workflow found to execute');
        return;
      }

      // If simulateFailure, clone or update shipment node simulateFailure: true
      if (simulateFailure) {
        // Toggle simulate failure on the shipment node
        const updatedNodes = targetWf.nodes.map(n => {
          if (n.id.includes('shipment') || n.data.label.includes('Shipment')) {
            return {
              ...n,
              data: {
                ...n.data,
                simulateFailure: true,
              },
            };
          }
          return n;
        });

        await api.put(`/workflows/${targetWf.id}`, { nodes: updatedNodes });
      } else {
        // Ensure simulateFailure is turned off
        const updatedNodes = targetWf.nodes.map(n => ({
          ...n,
          data: { ...n.data, simulateFailure: false },
        }));
        await api.put(`/workflows/${targetWf.id}`, { nodes: updatedNodes });
      }

      // Execute workflow
      const runRes = await api.post(`/workflows/${targetWf.id}/execute`, {
        inputPayload: {
          orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          customer: simulateFailure ? 'Elena Rostova (Failure Test)' : 'Marcus Vance',
          amount: 249.99,
          status: 200,
        },
        trigger: 'MANUAL',
      });

      // Jump to execution detail view
      onOpenExecutionDetail(runRes.data.executionId);
    } catch (err: any) {
      console.error('Demo trigger error:', err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setTriggeringDemo(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Banner & Quick Demos */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
              TENANT: {tenant?.name || 'Acme Global'}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs font-mono text-zinc-400">PLAN: {tenant?.plan} (ISOLATED REALM)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Workflow & Distributed Saga Orchestrator
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time DAG execution state machine with automatic reverse-order Saga compensations, exponential backoff retries, and sandboxed isolated transforms.
          </p>
        </div>

        {/* Action Buttons for Demonstration */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => triggerDemoSaga(false)}
            disabled={triggeringDemo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-sm shadow-emerald-950 hover:shadow-emerald-900 cursor-pointer"
            title="Execute Order Processing Saga where all forward actions succeed"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Saga (Success Scenario)</span>
          </button>

          <button
            onClick={() => triggerDemoSaga(true)}
            disabled={triggeringDemo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900/90 text-rose-200 border border-rose-800 font-medium text-xs transition-all shadow-sm shadow-rose-950 cursor-pointer"
            title="Simulate downstream carrier dispatch failure: will retry 3 times, enqueue to DLQ, and reverse compensate Inventory and Payment!"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Simulate Failure & Rollback</span>
          </button>

          <button
            onClick={() => onOpenWorkflowBuilder()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium text-xs transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Open DAG Builder</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 uppercase">Workflows</div>
          <div className="text-2xl font-bold font-mono text-zinc-100">{stats?.totalWorkflows ?? 0}</div>
          <div className="text-[10px] text-zinc-400 font-mono">Active DAG graphs</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Running</div>
          <div className="text-2xl font-bold font-mono text-cyan-300">{stats?.runningExecutions ?? 0}</div>
          <div className="text-[10px] text-cyan-500 font-mono">State machine active</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Successful</div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{stats?.successfulExecutions ?? 0}</div>
          <div className="text-[10px] text-emerald-500 font-mono">Completed DAGs</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Compensated</div>
          <div className="text-2xl font-bold font-mono text-amber-300">{stats?.compensatedExecutions ?? 0}</div>
          <div className="text-[10px] text-amber-500 font-mono">Saga rollbacks safe</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-purple-400 uppercase">Retried</div>
          <div className="text-2xl font-bold font-mono text-purple-300">{stats?.totalRetries ?? 0}</div>
          <div className="text-[10px] text-purple-500 font-mono">Backoff attempts</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-rose-400 uppercase">DLQ Jobs</div>
          <div className="text-2xl font-bold font-mono text-rose-300">{stats?.dlqCount ?? 0}</div>
          <div className="text-[10px] text-rose-500 font-mono">Failed max attempts</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 uppercase">Worker Latency</div>
          <div className="text-2xl font-bold font-mono text-zinc-200">{stats?.averageWorkerLatencyMs ?? 18}ms</div>
          <div className="text-[10px] text-zinc-400 font-mono">Distributed cluster</div>
        </div>
      </div>

      {/* Distributed Worker Nodes Cluster & Saga Execution Model */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Worker Pool Status */}
        <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Worker Node Fleet</h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              DISTRIBUTED
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Node.js asynchronous worker pool handling discrete task executions, timeouts, and sandboxed transformations.
          </p>

          <div className="space-y-2.5">
            {stats?.workers?.map(worker => (
              <div
                key={worker.id}
                className="p-3 rounded-lg border border-zinc-800/90 bg-zinc-950/60 flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        worker.status === 'BUSY'
                          ? 'bg-amber-400 animate-ping'
                          : worker.status === 'IDLE'
                          ? 'bg-emerald-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                    <span className="font-semibold text-zinc-200">{worker.name}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Jobs: {worker.completedJobs} completed · {worker.failedJobs} failed
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-zinc-300 font-bold">{worker.latencyMs}ms</span>
                  <div className="text-[10px] text-zinc-400 uppercase">{worker.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Saga Pattern Architecture Card */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Saga Orchestration Pattern</h2>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
              LIFO ROLLBACK
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Ensures eventual consistency across microservices without 2-phase commit (2PC) locks. If any downstream action fails permanently, compensating actions execute in reverse order to return the distributed system to a clean state.
          </p>

          <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800 font-mono text-xs space-y-3">
            <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
              Sample E-Commerce Transaction Rollback Flow:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2.5 rounded border border-emerald-800/40 bg-emerald-950/20 space-y-1">
                <div className="text-emerald-400 font-bold">1. Capture Payment</div>
                <div className="text-zinc-400 text-[10px]">Forward: Stripe POST</div>
                <div className="text-cyan-400 text-[10px] pt-1 border-t border-zinc-800">
                  ⤾ Rollback: Refund Credit
                </div>
              </div>

              <div className="p-2.5 rounded border border-emerald-800/40 bg-emerald-950/20 space-y-1">
                <div className="text-emerald-400 font-bold">2. Reserve Inventory</div>
                <div className="text-zinc-400 text-[10px]">Forward: WMS Lock</div>
                <div className="text-cyan-400 text-[10px] pt-1 border-t border-zinc-800">
                  ⤾ Rollback: Release SKU
                </div>
              </div>

              <div className="p-2.5 rounded border border-rose-800/40 bg-rose-950/20 space-y-1">
                <div className="text-rose-400 font-bold">3. Create Shipment</div>
                <div className="text-zinc-400 text-[10px]">FAILS (503 Service Down)</div>
                <div className="text-amber-400 text-[10px] pt-1 border-t border-zinc-800">
                  → Enqueue to DLQ & Trigger Saga
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Workflow Executions Table */}
      <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Recent Workflow Executions</h2>
          </div>
          <button
            onClick={() => onNavigateTab('executions')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 cursor-pointer"
          >
            <span>View all executions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentExecutions.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 font-mono">
            No executions recorded yet. Click "Run Saga (Success Scenario)" above to start one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px]">
                  <th className="pb-2.5">Execution ID</th>
                  <th className="pb-2.5">Workflow</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Trigger</th>
                  <th className="pb-2.5">Compensated</th>
                  <th className="pb-2.5">Started</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {recentExecutions.map(exec => {
                  let badgeClass = 'bg-zinc-800 text-zinc-300';
                  if (exec.status === 'SUCCESS') badgeClass = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';
                  if (exec.status === 'RUNNING') badgeClass = 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 animate-pulse';
                  if (exec.status === 'FAILED') badgeClass = 'bg-rose-950/80 text-rose-300 border border-rose-800/60';
                  if (exec.status === 'COMPENSATED') badgeClass = 'bg-amber-950/80 text-amber-300 border border-amber-800/60';
                  if (exec.status === 'RETRYING') badgeClass = 'bg-purple-950/80 text-purple-300 border border-purple-800/60';

                  return (
                    <tr key={exec.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 font-semibold text-zinc-200">{exec.id}</td>
                      <td className="py-3 text-zinc-300 max-w-xs truncate">{exec.workflowName}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
                          {exec.status}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-400">{exec.trigger}</td>
                      <td className="py-3">
                        {exec.compensationsExecuted && exec.compensationsExecuted.length > 0 ? (
                          <span className="text-amber-400 font-semibold">
                            {exec.compensationsExecuted.length} nodes rolled back
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-3 text-zinc-400">
                        {new Date(exec.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onOpenExecutionDetail(exec.id)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono cursor-pointer"
                        >
                          Inspect Trace
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
    </div>
  );
};
