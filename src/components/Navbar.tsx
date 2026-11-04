import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  Building2,
  Check,
  User,
  LogOut,
  UserPlus,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import api from '../services/api.ts';
import { Tenant } from '../types/index.ts';

interface NavbarProps {
  onSearch?: (term: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearch, onNavigateTab }) => {
  const { user, tenant, setTargetTenant, switchPersona, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Fetch tenants for selector
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await api.get('/tenants');
        setTenantsList(res.data);
      } catch (err) {
        // Fallback default tenants including Dharma
        setTenantsList([
          { id: 't-dharma', name: 'Dharma', slug: 'dharma', domain: 'dharma.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-1', name: 'Acme Corp', slug: 'acme-corp', domain: 'acme.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 2000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-2', name: 'TechNova', slug: 'technova', domain: 'technova.nexusflow.io', plan: 'PRO', rateLimitPerMinute: 1500, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-3', name: 'Global Systems', slug: 'global-systems', domain: 'global.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-4', name: 'Quantum Dynamics', slug: 'quantum-dynamics', domain: 'quantum.nexusflow.io', plan: 'PRO', rateLimitPerMinute: 1000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-5', name: 'Helios Cloud', slug: 'helios-cloud', domain: 'helios.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
          { id: 't-6', name: 'Cyberdyne', slug: 'cyberdyne', domain: 'cyberdyne.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000, status: 'ACTIVE', createdAt: '', updatedAt: '' },
        ]);
      }
    };
    fetchTenants();
  }, [tenant?.id]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
        setShowTenantMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotificationMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchQuery(term);
    onSearch?.(term);
  };

  const currentTenantName = tenant?.name || 'Dharma';

  // Compute initials: specifically 'TR' for Tejas Reddy as requested
  const userInitials = user?.name?.toLowerCase().includes('tejas') ? 'TR' : (
    user?.name
      ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'TR'
  );

  const isDark = theme === 'dark';

  return (
    <header className={`h-16 px-6 flex items-center justify-between z-30 sticky top-0 transition-colors duration-200 border-b ${
      isDark
        ? 'bg-[#0D1524] border-[#1E2D4A] text-slate-100'
        : 'bg-white border-slate-200 text-slate-800'
    }`}>
      {/* Left side tenant info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'} animate-pulse`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Engine Status: Online
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            isDark ? 'bg-blue-950/70 border border-blue-800/80 text-blue-300' : 'bg-blue-50 text-blue-700'
          }`}>
            Multi-Tenant Isolated
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3.5">
        {/* Current Tenant Selector */}
        <div className="relative" ref={tenantMenuRef}>
          <div className="flex flex-col items-start">
            <span className={`text-[10px] font-medium leading-none mb-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-400'
            }`}>
              Current Tenant
            </span>
            <button
              onClick={() => setShowTenantMenu(!showTenantMenu)}
              className={`flex items-center gap-1.5 text-sm font-bold transition-colors py-0.5 focus:outline-none cursor-pointer ${
                isDark ? 'text-slate-100 hover:text-blue-400' : 'text-slate-800 hover:text-blue-600'
              }`}
            >
              <span>{currentTenantName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Tenant Dropdown */}
          {showTenantMenu && (
            <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl py-1.5 z-50 text-xs border ${
              isDark
                ? 'bg-[#172235] border-[#1E2D4A] text-slate-200 shadow-black/60'
                : 'bg-white border-slate-200 text-slate-700 shadow-slate-300'
            }`}>
              <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b ${
                isDark ? 'text-slate-400 border-[#1E2D4A]' : 'text-slate-400 border-slate-100'
              }`}>
                Switch Organization Workspace
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {tenantsList.map(t => {
                  const isSelected = t.name === currentTenantName || t.id === tenant?.id;
                  return (
                    <button
                      key={t.id || t.slug}
                      onClick={() => {
                        setTargetTenant(t.id);
                        setShowTenantMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? isDark
                            ? 'bg-blue-600/20 text-blue-300 font-semibold'
                            : 'bg-blue-50/80 text-blue-700 font-medium'
                          : isDark
                          ? 'hover:bg-slate-800/60 text-slate-300'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-semibold">{t.name}</div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                            {t.domain || `${t.slug}.nexusflow.io`}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  );
                })}
              </div>
              <div className={`border-t pt-1 px-1 ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
                <button
                  onClick={() => {
                    onNavigateTab?.('tenants');
                    setShowTenantMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded font-medium flex items-center gap-1.5 cursor-pointer ${
                    isDark ? 'text-blue-400 hover:bg-slate-800' : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>Manage All Tenants</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search workflows, executions..."
            className={`w-52 md:w-64 pl-9 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder-slate-500 focus:border-blue-500'
                : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-blue-500'
            }`}
          />
        </div>

        {/* Theme Toggle (Dark Navy / Light) */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg border transition-all cursor-pointer ${
            isDark
              ? 'bg-[#172235] border-[#1E2D4A] text-amber-400 hover:bg-slate-800'
              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark Navy'} Theme`}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell with red badge '3' */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-slate-300 hover:bg-[#172235]' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
              3
            </span>
          </button>

          {/* Quick Notifications Popover */}
          {showNotificationMenu && (
            <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl py-2 z-50 text-xs border ${
              isDark
                ? 'bg-[#172235] border-[#1E2D4A] text-slate-200 shadow-black/60'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
            }`}>
              <div className={`px-3 pb-2 border-b flex items-center justify-between ${
                isDark ? 'border-[#1E2D4A]' : 'border-slate-100'
              }`}>
                <span className="font-bold">System Notifications</span>
                <span
                  className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                  onClick={() => { onNavigateTab?.('alerts'); setShowNotificationMenu(false); }}
                >
                  View All Alerts
                </span>
              </div>
              <div className={`divide-y max-h-72 overflow-y-auto ${isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'}`}>
                <div className={`p-3 transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Database Latency Spike</span>
                  </div>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Check Inventory service database query latency peaked at 480ms on Dharma cluster shard.
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">14m ago</span>
                </div>
                <div className={`p-3 transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Payment Gateway Timeout</span>
                  </div>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Execution EX-1003 encountered 502 Bad Gateway. Auto-retry scheduled.
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">35m ago</span>
                </div>
                <div className={`p-3 transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Worker Fleet Scaled</span>
                  </div>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Worker US-East replica connected to Dharma tenant queue.
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">1h ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Circle: PRINTS 'TR' FOR TEJAS REDDY */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center hover:opacity-95 transition-opacity cursor-pointer shadow-md ring-2 ring-blue-500/30"
            title={`${user?.name || 'Tejas Reddy'} (${user?.role || 'Tenant Admin'})`}
          >
            {userInitials}
          </button>

          {/* User & Role Switcher Popover */}
          {showUserMenu && (
            <div className={`absolute right-0 mt-2 w-72 rounded-xl shadow-2xl p-2 z-50 text-xs border ${
              isDark
                ? 'bg-[#172235] border-[#1E2D4A] text-slate-200 shadow-black/70'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
            }`}>
              <div className={`p-2 border-b mb-1 ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{user?.name || 'Tejas Reddy'}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                    {userInitials}
                  </span>
                </div>
                <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {user?.email || 'tejasreddy1808@gmail.com'}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    isDark ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {user?.role || 'TENANT_ADMIN'}
                  </span>
                  <span className="text-[10px] text-slate-400">· {tenant?.name || 'Dharma'}</span>
                </div>
              </div>

              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                Switch Test Tenant Admin
              </div>
              <div className="space-y-0.5">
                {DEMO_PERSONAS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => {
                      switchPersona(p.key);
                      setShowUserMenu(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      user?.email === p.email
                        ? isDark
                          ? 'bg-blue-600/30 text-blue-200 font-semibold'
                          : 'bg-blue-50 text-blue-700 font-medium'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[9px] font-bold flex items-center justify-center text-blue-300">
                        {p.initials}
                      </span>
                      <span>{p.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{p.org}</span>
                  </button>
                ))}
              </div>

              <div className={`border-t pt-1 mt-1 space-y-0.5 ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
                <button
                  onClick={() => {
                    onNavigateTab?.('settings');
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                    isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account & Workspace Settings</span>
                </button>
                <button
                  onClick={() => {
                    onNavigateTab?.('auth');
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                    isDark ? 'text-blue-400 hover:bg-slate-800' : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Another Workspace</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                    isDark ? 'text-rose-400 hover:bg-slate-800' : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
