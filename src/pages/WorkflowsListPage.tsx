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
  Search,
  Filter,
  ArrowRight,
  MoreVertical,
  Check,
} from 'lucide-react';
import api from '../services/api.ts';
import { Workflow } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

interface WorkflowsListPageProps {
  onOpenBuilder: (workflowId?: string) => void;
  onOpenExecution: (executionId: string) => void;
}

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  onOpenBuilder,
  onOpenExecution,
}) => {
  const { tenant } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT'>('ALL');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workflow "${name}"?`)) return;
    try {
      await api.delete(`/workflows/${id}`);
      showToast(`Workflow "${name}" deleted.`);
      await loadWorkflows();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDuplicate = async (workflow: Workflow) => {
    try {
      await api.post('/workflows', {
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        status: 'DRAFT',
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
      showToast(`Workflow duplicated.`);
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
          productId: 'PRD-1024',
          amount: 249.99,
          quantity: 25,
          warehouse: 'WH-01',
        },
      });
      showToast('Workflow execution started.');
      onOpenExecution(res.data.execution.id);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Workflows</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Manage, configure and orchestrate distributed DAG workflows across {tenant?.name || 'Dharma'}.
          </p>
        </div>
        <button
          onClick={() => onOpenBuilder()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workflow</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
      }`}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search workflows by name or description..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          {(['ALL', 'ACTIVE', 'DRAFT'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === status
                  ? isDark
                    ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isDark
                  ? 'text-slate-400 hover:bg-[#1E2D4A]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows Table / List */}
      <div className={`rounded-xl border shadow-xs overflow-hidden transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-semibold uppercase tracking-wider text-[10px] ${
              isDark
                ? 'bg-[#0F172A] border-[#1E2D4A] text-slate-400'
                : 'bg-slate-50/70 border-slate-200/80 text-slate-500'
            }`}>
              <tr>
                <th className="py-3 px-6">Workflow Name</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">DAG Nodes</th>
                <th className="py-3 px-6">Created By</th>
                <th className="py-3 px-6">Last Updated</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'}`}>
              {filteredWorkflows.map(wf => (
                <tr key={wf.id} className={`transition-colors ${
                  isDark ? 'hover:bg-[#131E33]' : 'hover:bg-slate-50/70'
                }`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <GitFork className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          onClick={() => onOpenBuilder(wf.id)}
                          className={`font-bold hover:text-blue-500 cursor-pointer text-sm ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {wf.name}
                        </div>
                        <div className={`text-[11px] line-clamp-1 max-w-sm mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {wf.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        wf.status === 'ACTIVE'
                          ? isDark
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : 'bg-emerald-50 text-emerald-700'
                          : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          wf.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{wf.status}</span>
                    </span>
                  </td>
                  <td className={`py-4 px-6 font-mono text-[11px] ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {wf.nodes?.length || 0} nodes
                  </td>
                  <td className={`py-4 px-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {wf.createdBy || 'tejasreddy1808@gmail.com'}
                  </td>
                  <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                    {new Date(wf.updatedAt || wf.createdAt || Date.now()).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleExecute(wf.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'text-blue-400 hover:bg-blue-950/50' : 'text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Run Workflow"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onOpenBuilder(wf.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'text-slate-300 hover:bg-[#1E2D4A]' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Edit in Builder"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(wf)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'text-slate-300 hover:bg-[#1E2D4A]' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Duplicate Workflow"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(wf.id, wf.name)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'text-rose-400 hover:bg-rose-950/50' : 'text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Delete Workflow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
