import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  PlayCircle,
  AlertTriangle,
  KeyRound,
  FileText,
  Sliders,
  Shield,
  Activity,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'workflows'
  | 'builder'
  | 'executions'
  | 'execution-detail'
  | 'dlq'
  | 'apikeys'
  | 'audit'
  | 'admin'
  | 'auth';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  dlqCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, dlqCount = 0 }) => {
  const { user, tenant } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'workflows' as NavTab, label: 'Workflow DAGs', icon: GitFork },
    { id: 'executions' as NavTab, label: 'Executions', icon: PlayCircle },
    { id: 'dlq' as NavTab, label: 'Dead Letter Queue', icon: AlertTriangle, badge: dlqCount },
    { id: 'apikeys' as NavTab, label: 'API Keys', icon: KeyRound },
    { id: 'audit' as NavTab, label: 'Audit Logs', icon: FileText },
    { id: 'admin' as NavTab, label: 'Cluster & Admin', icon: Sliders },
    { id: 'auth' as NavTab, label: 'Register / Auth', icon: UserPlus },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-6">
        {/* Navigation list */}
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            ENGINE NAVIGATION
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.id === 'workflows' && currentTab === 'builder') || (item.id === 'executions' && currentTab === 'execution-detail');
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tenant Plan & Quota Widget */}
        <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">TENANT QUOTA</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {tenant?.plan || 'PRO'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
              <span>Rate Limit</span>
              <span className="text-zinc-300">{tenant?.rateLimitPerMinute || 1000} req/m</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-400 h-1.5 rounded-full w-2/5" />
            </div>
          </div>

          <div className="text-[10px] text-zinc-400 leading-tight">
            Tenant isolation verified via strict MongoDB document partition & JWT middleware.
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-zinc-900 text-[11px] text-zinc-400 font-mono space-y-1">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Saga Rollback: Reverse-LIFO</span>
        </div>
        <div>Retry Engine: Exp. Backoff Jitter</div>
      </div>
    </aside>
  );
};
