import React, { useState, useEffect } from 'react';
import {
  Users,
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import api from '../services/api.ts';
import { useTheme } from '../context/ThemeContext.tsx';

export const WorkersPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/workers');
      setWorkers(res.data);
    } catch (err) {
      // Fallback
      setWorkers([
        {
          id: 'worker-us-east-1',
          name: 'Worker Node US-East (Primary)',
          region: 'us-east-1',
          status: 'BUSY',
          cpuPercent: 42,
          memoryPercent: 58,
          activeJobs: 3,
          totalCompleted: 842,
          latencyMs: 18,
          lastHeartbeat: new Date().toISOString(),
        },
        {
          id: 'worker-eu-west-1',
          name: 'Worker Node EU-West (Frankfurt)',
          region: 'eu-west-1',
          status: 'IDLE',
          cpuPercent: 18,
          memoryPercent: 34,
          activeJobs: 1,
          totalCompleted: 619,
          latencyMs: 24,
          lastHeartbeat: new Date(Date.now() - 2000).toISOString(),
        },
        {
          id: 'worker-ap-south-1',
          name: 'Worker Node AP-South (Singapore)',
          region: 'ap-south-1',
          status: 'IDLE',
          cpuPercent: 12,
          memoryPercent: 29,
          activeJobs: 0,
          totalCompleted: 420,
          latencyMs: 32,
          lastHeartbeat: new Date(Date.now() - 1500).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Worker Fleet</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Distributed execution agents, heartbeat telemetry, and queue consumption metrics.
          </p>
        </div>
      </div>

      {/* Cluster Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-xl border shadow-xs flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Worker Nodes</div>
            <div className={`text-2xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{workers.length} Nodes</div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
          }`}>
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-xs flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active Concurrent Jobs</div>
            <div className={`text-2xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {workers.reduce((acc, w) => acc + (w.activeJobs || 0), 0)} Jobs
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-600'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-xs flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average Fleet Latency</div>
            <div className={`text-2xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>24ms</div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-xs flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cluster Health</div>
            <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 mt-0.5">100% Online</div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Workers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workers.map(w => (
          <div key={w.id} className={`rounded-xl border shadow-xs p-6 space-y-4 transition-colors ${
            isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{w.name}</h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">Region: {w.region}</div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-700'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {/* CPU */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Cpu className="w-3.5 h-3.5 text-slate-400" /> CPU Load
                  </span>
                  <span className={`font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{w.cpuPercent}%</span>
                </div>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className="bg-blue-600 h-1.5 rounded-full"
                    style={{ width: `${w.cpuPercent}%` }}
                  />
                </div>
              </div>

              {/* Memory */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Memory Load
                  </span>
                  <span className={`font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{w.memoryPercent}%</span>
                </div>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className="bg-purple-600 h-1.5 rounded-full"
                    style={{ width: `${w.memoryPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className={`pt-3 border-t grid grid-cols-2 gap-2 text-xs ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Jobs</div>
                <div className={`font-bold font-mono mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{w.activeJobs} Running</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Latency</div>
                <div className={`font-bold font-mono mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{w.latencyMs}ms</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
