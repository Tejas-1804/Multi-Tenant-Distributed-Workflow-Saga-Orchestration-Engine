import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../services/api.ts';
import { AuditLog } from '../types/index.ts';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      const res = await api.get('/audit-logs');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase">
              COMPLIANCE & TRACEABILITY
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Audit Trail Logs
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Immutable log of system mutations, tenant administrative actions, and workflow orchestrations.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-200 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs font-mono text-zinc-500">
          No audit logs recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden font-mono text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-500 uppercase text-[10px]">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Resource ID</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-emerald-400">{log.action}</td>
                  <td className="py-3.5 px-4 text-zinc-200">{log.userEmail || log.userId}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{log.resource}</td>
                  <td className="py-3.5 px-4 text-zinc-500">{log.resourceId || '—'}</td>
                  <td className="py-3.5 px-4 text-zinc-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
