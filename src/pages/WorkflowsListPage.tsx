import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Plus,
  Play,
  Edit,
  Trash2,
  Copy,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api.ts';
import { Workflow } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface WorkflowsListPageProps {
  onOpenBuilder: (workflowId?: string) => void;
  onOpenExecution: (executionId: string) => void;
}

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  onOpenBuilder,
  onOpenExecution,
}) => {
  const { user, tenant } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      setWorkflows(res.data);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [tenant?.id]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workflow "${name}"?`)) return;
    try {
      await api.delete(`/workflows/${id}`);
      await loadWorkflows();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      const res = await api.post(`/workflows/${id}/execute`, {
        inputPayload: {
          orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          customer: 'Sarah Connor',
          amount: 249.99,
          status: 200,
        },
        trigger: 'MANUAL',
      });
      onOpenExecution(res.data.executionId);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="text-xs font-mono text-emerald-400 mb-1">
            TENANT: {tenant?.name}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Directed Acyclic Graphs (Workflows)
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Manage your organization's versioned workflow graphs and Saga orchestration pipelines.
          </p>
        </div>

        <button
          onClick={() => onOpenBuilder()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm shadow-emerald-950 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Workflow</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          Loading tenant workflows...
        </div>
      ) : workflows.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/30 space-y-3">
          <GitFork className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">No workflows in this tenant yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Design your first workflow DAG with HTTP requests, conditions, retries, and Saga compensations.
          </p>
          <button
            onClick={() => onOpenBuilder()}
            className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
          >
            Launch DAG Builder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workflows.map(wf => (
            <div
              key={wf.id}
              className="p-5 rounded-xl border border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    VERSION {wf.version}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                    {wf.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-zinc-100 line-clamp-1">{wf.name}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {wf.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-800/80 space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                  <span>Nodes: {wf.nodes?.length || 0}</span>
                  <span>Edges: {wf.edges?.length || 0}</span>
                  <span>By: {wf.createdBy.split('@')[0]}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => handleExecute(wf.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run</span>
                  </button>

                  <button
                    onClick={() => onOpenBuilder(wf.id)}
                    className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                    title="Edit DAG in visual editor"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(wf.id, wf.name)}
                    className="p-1.5 rounded-lg border border-zinc-800 hover:bg-rose-950/40 text-rose-400 transition-colors cursor-pointer"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
