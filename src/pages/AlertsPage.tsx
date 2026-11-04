import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Check,
  Search,
} from 'lucide-react';
import api from '../services/api.ts';
import { SystemAlert } from '../types/index.ts';
import { useTheme } from '../context/ThemeContext.tsx';

export const AlertsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      // Fallback
      setAlerts([
        {
          id: 'alt-001',
          title: 'Database Query Latency Elevated',
          message: 'Check Inventory service database query latency peaked at 480ms on cluster shard us-east-2.',
          severity: 'WARNING',
          service: 'Database',
          status: 'ACTIVE',
          timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
          workflowId: 'wf_order_processing',
        },
        {
          id: 'alt-002',
          title: 'Payment Gateway Timeout',
          message: 'Stripe webhook listener reported 2 connection timeouts in the last 15 minutes. Exponential backoff retry engaged.',
          severity: 'CRITICAL',
          service: 'API Server',
          status: 'ACTIVE',
          timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
          executionId: 'EX-1003',
        },
        {
          id: 'alt-003',
          title: 'Worker Node-03 Memory Reached 78%',
          message: 'Execution worker node memory utilization reached threshold (78%). Auto-scaling replica queued.',
          severity: 'INFO',
          service: 'Workers',
          status: 'ACTIVE',
          timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
        },
        {
          id: 'alt-004',
          title: 'Message Queue Backlog Cleared',
          message: 'RabbitMQ / BullMQ execution queue backlog drained successfully. 142 tasks delivered.',
          severity: 'INFO',
          service: 'Message Queue',
          status: 'RESOLVED',
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        },
      ]);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/resolve`);
      showToast('Alert resolved.');
      fetchAlerts();
    } catch {
      setAlerts(prev => prev.map(a => (a.id === id ? { ...a, status: 'RESOLVED' } : a)));
      showToast('Alert marked as resolved.');
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const matchesSeverity = filterSeverity === 'ALL' || a.severity === filterSeverity;
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
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
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>System & Workflow Alerts</h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Incident management, execution anomalies, and infrastructure thresholds.
        </p>
      </div>

      {/* Filter and Search */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
      }`}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search alerts by title, service, or description..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 border ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Severity:</span>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterSeverity === sev
                  ? isDark
                    ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60 font-semibold'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                  : isDark
                  ? 'text-slate-400 hover:bg-[#1E2D4A]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className={`rounded-xl border shadow-xs divide-y overflow-hidden transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A] divide-[#1E2D4A]' : 'bg-white border-slate-200/80 divide-slate-100'
      }`}>
        {filteredAlerts.map(alert => {
          const isCritical = alert.severity === 'CRITICAL';
          const isWarning = alert.severity === 'WARNING';
          const isResolved = alert.status === 'RESOLVED';

          return (
            <div
              key={alert.id}
              className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                isResolved
                  ? isDark ? 'bg-[#0E1729]/40 opacity-70' : 'bg-slate-50/40 opacity-75'
                  : isDark ? 'hover:bg-[#131E33]' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCritical
                      ? isDark ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-50 text-rose-600'
                      : isWarning
                      ? isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-50 text-amber-600'
                      : isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {isCritical && <AlertTriangle className="w-5 h-5" />}
                  {isWarning && <AlertCircle className="w-5 h-5" />}
                  {!isCritical && !isWarning && <Info className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{alert.title}</h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isCritical
                          ? isDark ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60' : 'bg-rose-50 text-rose-700'
                          : isWarning
                          ? isDark ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' : 'bg-amber-50 text-amber-700'
                          : isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {alert.service}
                    </span>
                  </div>

                  <p className={`text-xs mt-1 leading-relaxed max-w-2xl ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {alert.workflowId && <span>Workflow: {alert.workflowId}</span>}
                    {alert.executionId && <span>Execution: {alert.executionId}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {isResolved ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                  </span>
                ) : (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer border ${
                      isDark
                        ? 'bg-[#131E33] hover:bg-[#1C2B44] text-slate-300 border-[#1E2D4A]'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Acknowledge & Resolve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
