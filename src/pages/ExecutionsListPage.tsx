import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
} from 'lucide-react';
import api from '../services/api.ts';
import { WorkflowExecution } from '../types/index.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface ExecutionsListPageProps {
  onOpenExecution: (id: string) => void;
}

export const ExecutionsListPage: React.FC<ExecutionsListPageProps> = ({ onOpenExecution }) => {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const isDark = theme === 'dark';

  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
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
  }, [tenant?.id]);

  const filtered = executions.filter(e => {
    const matchesStatus = filterStatus === 'ALL' || e.status === filterStatus;
    const matchesSearch =
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.workflowName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Executions</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Monitor real-time workflow state machines, latency, and step traces for {tenant?.name || 'Dharma'}.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
      }`}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search executions by ID or workflow..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          {['ALL', 'SUCCESS', 'RUNNING', 'FAILED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterStatus === status
                  ? isDark
                    ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60 font-semibold'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                  : isDark
                  ? 'text-slate-400 hover:bg-[#1E2D4A]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status === 'ALL' ? 'All' : status === 'SUCCESS' ? 'Completed' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Executions Table */}
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
                <th className="py-3 px-6">Execution ID</th>
                <th className="py-3 px-6">Workflow</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Duration</th>
                <th className="py-3 px-6">Trigger</th>
                <th className="py-3 px-6">Started At</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'}`}>
              {filtered.map((exec, idx) => {
                const isSuccess = exec.status === 'SUCCESS';
                const isRunning = exec.status === 'RUNNING';
                const isFailed = exec.status === 'FAILED';

                return (
                  <tr
                    key={`${exec.id}-${idx}`}
                    onClick={() => onOpenExecution(exec.id)}
                    className={`transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#131E33]' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-4 px-6 font-mono font-semibold text-blue-500 dark:text-blue-400">
                      {exec.id}
                    </td>
                    <td className={`py-4 px-6 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {exec.workflowName}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isSuccess
                            ? isDark
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-emerald-50 text-emerald-700'
                            : isRunning
                            ? isDark
                              ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                              : 'bg-blue-50 text-blue-700'
                            : isDark
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />}
                        {isRunning && <Clock className="w-3 h-3 text-blue-500 dark:text-blue-400" />}
                        {isFailed && <XCircle className="w-3 h-3 text-rose-500 dark:text-rose-400" />}
                        <span>{isSuccess ? 'Completed' : isRunning ? 'Running' : 'Failed'}</span>
                      </span>
                    </td>
                    <td className={`py-4 px-6 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {exec.duration || '2.4s'}
                    </td>
                    <td className={`py-4 px-6 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {exec.trigger || 'MANUAL'}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                      {new Date(exec.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-blue-500 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1">
                        <span>View Flow</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
