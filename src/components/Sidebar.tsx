import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  PlayCircle,
  Layers,
  Building2,
  Users,
  Activity,
  Bell,
  Settings,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'workflows'
  | 'builder'
  | 'executions'
  | 'execution-detail'
  | 'templates'
  | 'tenants'
  | 'workers'
  | 'monitoring'
  | 'alerts'
  | 'settings'
  | 'auth';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, alertCount = 3 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workflows' as NavTab, label: 'Workflows', icon: GitFork },
    { id: 'executions' as NavTab, label: 'Executions', icon: PlayCircle },
    { id: 'templates' as NavTab, label: 'Templates', icon: Layers },
    { id: 'tenants' as NavTab, label: 'Tenants', icon: Building2 },
    { id: 'workers' as NavTab, label: 'Workers', icon: Users },
    { id: 'monitoring' as NavTab, label: 'Monitoring', icon: Activity },
    { id: 'alerts' as NavTab, label: 'Alerts', icon: Bell, badge: alertCount },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`w-56 md:w-60 flex flex-col justify-between shrink-0 select-none z-20 min-h-screen border-r transition-colors duration-200 ${
        isDark
          ? 'bg-[#070D18] border-[#1E2D4A] text-slate-300'
          : 'bg-[#0c1322] border-slate-800 text-slate-300'
      }`}
    >
      <div className="p-4">
        {/* Brand Header */}
        <div className="px-3 pt-2 pb-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            NexusFlow
          </h1>
          <div className="text-[10px] text-blue-400 font-mono tracking-wider mt-0.5">
            DISTRIBUTED DAG ENGINE
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'workflows' && currentTab === 'builder') ||
              (item.id === 'executions' && currentTab === 'execution-detail');

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#2563eb] text-white font-semibold shadow-md shadow-blue-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 font-normal'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer subtle version info */}
      <div className="p-4 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center justify-between">
          <span>Engine Status</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
      </div>
    </aside>
  );
};
