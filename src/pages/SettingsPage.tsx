import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  KeyRound,
  Shield,
  Bell,
  Sliders,
  Check,
  Copy,
  Plus,
  Sun,
  Moon,
  Palette,
} from 'lucide-react';
import api from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

export const SettingsPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'appearance' | 'workspace' | 'api-keys' | 'notifications'>('profile');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    try {
      const res = await api.get('/api-keys');
      setApiKeys(res.data);
    } catch {
      setApiKeys([
        { id: 'key-1', name: 'Production Gateway Key', keyPrefix: 'wk_live_dharma...', createdAt: new Date().toISOString() },
      ]);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'api-keys') {
      fetchApiKeys();
    }
  }, [activeSubTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const res = await api.post('/api-keys', { name: newKeyName });
      setGeneratedKey(res.data.rawKey);
      setNewKeyName('');
      fetchApiKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
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
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings & Preferences</h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Manage your account profile, theme appearance, workspace security, and API credentials.
        </p>
      </div>

      {/* Subtabs Navigation */}
      <div className={`flex flex-wrap items-center gap-2 border-b pb-2 text-sm font-medium ${
        isDark ? 'border-[#1E2D4A]' : 'border-slate-200'
      }`}>
        {[
          { id: 'profile', label: 'User Profile', icon: User },
          { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
          { id: 'workspace', label: 'Workspace Details', icon: Building2 },
          { id: 'api-keys', label: 'API Keys', icon: KeyRound },
          { id: 'notifications', label: 'Alert Preferences', icon: Bell },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
                isActive
                  ? isDark
                    ? 'bg-[#172235] text-blue-400 border border-[#1E2D4A] shadow-xs'
                    : 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeSubTab === 'profile' && (
        <div className={`p-6 rounded-xl border shadow-xs max-w-2xl space-y-5 transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>User Profile</h2>

          <div className={`flex items-center gap-4 pb-4 border-b ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold text-lg flex items-center justify-center shadow-md">
              TR
            </div>
            <div>
              <div className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user?.name || 'Tejas Reddy'}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {user?.email || 'tejasreddy1808@gmail.com'}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60' : 'bg-blue-50 text-blue-700'
                }`}>
                  {user?.role || 'TENANT_ADMIN'}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isDark ? 'bg-purple-950/60 text-purple-400 border border-purple-800/60' : 'bg-purple-50 text-purple-700'
                }`}>
                  {tenant?.name || 'Dharma'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Name</label>
              <input
                type="text"
                readOnly
                value={user?.name || 'Tejas Reddy (Tenant Admin)'}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email Address</label>
              <input
                type="email"
                readOnly
                value={user?.email || 'tejasreddy1808@gmail.com'}
                className={`w-full px-3 py-2 border rounded-lg font-mono ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Assigned Workspace</label>
              <input
                type="text"
                readOnly
                value={`${tenant?.name || 'Dharma'} (${tenant?.domain || 'dharma.nexusflow.io'})`}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Appearance & Theme Tab */}
      {activeSubTab === 'appearance' && (
        <div className={`p-6 rounded-xl border shadow-xs max-w-2xl space-y-6 transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Theme & Appearance</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Customize your interface background and color palette.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark Navy Option */}
            <div
              onClick={() => {
                setTheme('dark');
                showToast('Switched to Refined Dark Navy Theme');
              }}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isDark
                  ? 'border-blue-500 bg-[#0B1220] shadow-md ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-900 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500 flex items-center justify-center text-blue-400">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Dark Navy (Default)</div>
                    <div className="text-[10px] text-slate-400">#0B1220 to #172033</div>
                  </div>
                </div>
                {isDark && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                    ✓
                  </span>
                )}
              </div>
              <div className="h-16 rounded-lg bg-gradient-to-r from-[#070D18] via-[#0B1220] to-[#172235] border border-[#1E2D4A] p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="w-8 h-1 rounded bg-slate-600" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>Sidebar #070D18</span>
                  <span className="text-blue-400">Pill #2563EB</span>
                </div>
              </div>
            </div>

            {/* Light Option */}
            <div
              onClick={() => {
                setTheme('light');
                showToast('Switched to Enterprise Light Theme');
              }}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                !isDark
                  ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-500/20'
                  : 'border-[#1E2D4A] bg-[#0E1729] hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Enterprise Light</div>
                    <div className="text-[10px] text-slate-400">Crisp white & subtle slate</div>
                  </div>
                </div>
                {!isDark && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                    ✓
                  </span>
                )}
              </div>
              <div className="h-16 rounded-lg bg-slate-100 border border-slate-200 p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="w-8 h-1 rounded bg-slate-300" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-600 font-mono">
                  <span>Canvas #f8fafc</span>
                  <span className="text-blue-600">Card #FFFFFF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Tab */}
      {activeSubTab === 'workspace' && (
        <div className={`p-6 rounded-xl border shadow-xs max-w-2xl space-y-5 transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Current Workspace Details</h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Organization Name</label>
              <input
                type="text"
                readOnly
                value={tenant?.name || 'Dharma'}
                className={`w-full px-3 py-2 border rounded-lg font-semibold ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Custom Domain</label>
              <input
                type="text"
                readOnly
                value={tenant?.domain || 'dharma.nexusflow.io'}
                className={`w-full px-3 py-2 border rounded-lg font-mono ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Subscription Plan</label>
              <input
                type="text"
                readOnly
                value={tenant?.plan || 'ENTERPRISE'}
                className={`w-full px-3 py-2 border rounded-lg font-mono font-semibold ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Execution Rate Limit</label>
              <input
                type="text"
                readOnly
                value={`${tenant?.rateLimitPerMinute || 5000} requests per minute`}
                className={`w-full px-3 py-2 border rounded-lg font-mono ${
                  isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeSubTab === 'api-keys' && (
        <div className={`p-6 rounded-xl border shadow-xs space-y-6 transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Programmatic API Keys</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Authenticate automated webhook triggers, CLI deployments, and external microservices.
            </p>
          </div>

          {generatedKey && (
            <div className={`p-4 border rounded-xl space-y-2 animate-in fade-in ${
              isDark ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="text-xs font-bold">New Secret Key Generated:</div>
              <div className={`flex items-center justify-between border rounded-lg px-3 py-2 text-xs font-mono ${
                isDark ? 'bg-[#0B1220] border-emerald-800 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-900'
              }`}>
                <span>{generatedKey}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    showToast('Copied API key to clipboard.');
                  }}
                  className="p-1 hover:bg-emerald-800/30 rounded cursor-pointer"
                  title="Copy Key"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px]">Save this key now. It will not be shown again.</p>
            </div>
          )}

          <form onSubmit={handleCreateApiKey} className="flex gap-3 max-w-md">
            <input
              type="text"
              required
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key label e.g. Production Ingestion"
              className={`flex-1 px-3 py-1.5 border rounded-lg text-xs ${
                isDark ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Key</span>
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b font-semibold uppercase text-[10px] ${
                isDark ? 'bg-[#0F172A] border-[#1E2D4A] text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}>
                <tr>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Prefix</th>
                  <th className="py-2.5 px-4">Created At</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'}`}>
                {apiKeys.map(k => (
                  <tr key={k.id} className={isDark ? 'hover:bg-[#131E33]' : 'hover:bg-slate-50/70'}>
                    <td className={`py-3 px-4 font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{k.name}</td>
                    <td className={`py-3 px-4 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{k.keyPrefix}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeSubTab === 'notifications' && (
        <div className={`p-6 rounded-xl border shadow-xs max-w-2xl space-y-5 transition-colors ${
          isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
        }`}>
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Alert Notification Preferences</h2>

          <div className="space-y-4 text-xs">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'border-[#1E2D4A] bg-[#0B1220]' : 'border-slate-200 bg-white'
            }`}>
              <div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Critical Execution Failure Alert</div>
                <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Dispatch webhook & email when workflow reaches Dead Letter Queue</div>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'border-[#1E2D4A] bg-[#0B1220]' : 'border-slate-200 bg-white'
            }`}>
              <div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Latency Threshold Alert</div>
                <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Notify operations team if p99 database query exceeds 500ms</div>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'border-[#1E2D4A] bg-[#0B1220]' : 'border-slate-200 bg-white'
            }`}>
              <div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Saga Rollback Execution Log</div>
                <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Record all reverse compensation transactions to security audit log</div>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
