import React, { useState } from 'react';
import {
  Workflow,
  ShieldAlert,
  Server,
  Zap,
  Radio,
  UserCheck,
  ChevronDown,
  Building,
  LogOut,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext.tsx';

interface NavbarProps {
  isWsConnected: boolean;
  workerCount: number;
  onNavigateTab?: (tab: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isWsConnected, workerCount, onNavigateTab }) => {
  const { user, tenant, switchPersona, logout } = useAuth();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950">
          <Workflow className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-zinc-100 font-sans">
              DISTRIBUTED SAGA ENGINE
            </span>
            <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
              v2.4-ENTERPRISE
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-2 font-mono">
            <span>MULTI-TENANT ORCHESTRATION</span>
            <span>·</span>
            <span className="text-zinc-500">{tenant?.name || 'Loading...'}</span>
          </div>
        </div>
      </div>

      {/* Cluster Health & Live WebSocket Indicator */}
      <div className="flex items-center gap-4">
        {/* Live WebSocket Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-zinc-400 font-mono text-[11px]">
            WS: {isWsConnected ? 'CONNECTED' : 'RECONNECTING'}
          </span>
        </div>

        {/* Worker Pool Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 font-mono">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span>{workerCount} WORKERS ACTIVE</span>
        </div>

        {/* Active Tenant Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 text-xs">
          <Building className="w-3.5 h-3.5 text-zinc-400" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-zinc-400 font-mono uppercase">TENANT</span>
            <span className="text-xs font-semibold text-zinc-200">{tenant?.name || 'Acme Logistics'}</span>
          </div>
        </div>

        {/* Persona Switcher Dropdown (Essential for Testing Multi-Tenancy & Roles) */}
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-600 transition-all text-xs text-zinc-200"
            title="Switch User Role or Organization for testing"
          >
            <div className="w-6 h-6 rounded bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[11px] font-semibold text-zinc-200 leading-tight flex items-center gap-1.5">
                <span>{user?.name?.split(' ')[0] || 'User'}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {user?.role}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-2xl z-50 text-xs font-sans">
              <div className="px-2 py-1.5 text-[11px] font-mono text-zinc-400 border-b border-zinc-800/80 flex items-center justify-between">
                <span>SWITCH TEST PERSONA</span>
                <span className="text-[10px] text-emerald-400">1-CLICK</span>
              </div>

              <div className="py-1 space-y-1">
                {DEMO_PERSONAS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => {
                      switchPersona(p.key);
                      setShowPersonaMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded flex flex-col gap-0.5 hover:bg-zinc-800/80 transition-colors ${
                      user?.email === p.email ? 'bg-zinc-800/50 border border-emerald-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{p.label}</span>
                      <span className="text-[9px] font-mono text-emerald-400">{p.role}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {p.org} · {p.email}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-1 mt-1 border-t border-zinc-800 space-y-0.5">
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      onNavigateTab('auth');
                      setShowPersonaMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded text-emerald-400 hover:bg-emerald-950/30 flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register New Workspace</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    logout();
                    setShowPersonaMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
