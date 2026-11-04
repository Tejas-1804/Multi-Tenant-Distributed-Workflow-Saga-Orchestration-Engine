import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  Users,
  ShieldCheck,
  ExternalLink,
  Search,
  Check,
  ArrowRight,
} from 'lucide-react';
import api from '../services/api.ts';
import { Tenant } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

export const TenantsPage: React.FC = () => {
  const { tenant: currentTenant, setTargetTenant } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPlan, setNewTenantPlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants');
      setTenants(res.data);
    } catch (err) {
      // Fallback
      setTenants([
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

  useEffect(() => {
    fetchTenants();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    try {
      await api.post('/tenants', {
        name: newTenantName,
        plan: newTenantPlan,
      });
      showToast(`Tenant "${newTenantName}" provisioned.`);
      setNewTenantName('');
      setShowAddModal(false);
      fetchTenants();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // Map tenant admins
  const tenantAdminMap: Record<string, string> = {
    'dharma': 'Tejas Reddy',
    'acme-corp': 'Tejas',
    'technova': 'Amaan',
    'cyberdyne': 'Amaan',
    'global-systems': 'Priyanka',
    'quantum-dynamics': 'Priyanka',
    'helios-cloud': 'Rinkle Sharma',
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.domain && t.domain.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Tenants & Workspaces</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Strict multi-tenant isolation, custom domains, quotas, and admin assignment.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Tenant</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className={`p-4 rounded-xl border shadow-xs transition-colors ${
        isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
      }`}>
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tenant by name or domain..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Tenants Table */}
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
                <th className="py-3 px-6">Tenant Name</th>
                <th className="py-3 px-6">Domain</th>
                <th className="py-3 px-6">Assigned Admin</th>
                <th className="py-3 px-6">Plan</th>
                <th className="py-3 px-6">Rate Quota</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'}`}>
              {filteredTenants.map(t => {
                const isCurrent = currentTenant?.id === t.id || currentTenant?.slug === t.slug;
                const adminName = tenantAdminMap[t.slug] || 'Tejas Reddy';

                return (
                  <tr key={t.id} className={`transition-colors ${
                    isDark ? 'hover:bg-[#131E33]' : 'hover:bg-slate-50/70'
                  }`}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isDark ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-bold text-sm flex items-center gap-2 ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            <span>{t.name}</span>
                            {isCurrent && (
                              <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${
                                isDark ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700'
                              }`}>
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: {t.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`py-4 px-6 font-mono text-[11px] ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                      {t.domain || `${t.slug}.nexusflow.io`}
                    </td>
                    <td className="py-4 px-6">
                      <div className={`flex items-center gap-1.5 font-medium ${
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{adminName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                        isDark ? 'bg-[#0B1220] text-slate-300 border border-[#1E2D4A]' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.plan || 'PRO'}
                      </span>
                    </td>
                    <td className={`py-4 px-6 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {t.rateLimitPerMinute || 1000} req/min
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {isCurrent ? (
                        <span className="text-xs text-slate-400 font-medium">Active Now</span>
                      ) : (
                        <button
                          onClick={() => {
                            setTargetTenant(t.id);
                            showToast(`Switched workspace to ${t.name}`);
                          }}
                          className={`px-3 py-1 font-medium rounded-lg border shadow-2xs transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#131E33] hover:bg-[#1C2B44] text-blue-400 border-blue-900/60'
                              : 'bg-white hover:bg-slate-50 text-blue-600 border-blue-200'
                          }`}
                        >
                          Switch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl border shadow-xl max-w-md w-full p-6 space-y-4 ${
            isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-[#1E2D4A]' : 'border-slate-100'
            }`}>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Provision New Tenant</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Organization Name</label>
                <input
                  type="text"
                  required
                  value={newTenantName}
                  onChange={e => setNewTenantName(e.target.value)}
                  placeholder="e.g. Acme Retail Global"
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 ${
                    isDark
                      ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Subscription Tier</label>
                <select
                  value={newTenantPlan}
                  onChange={e => setNewTenantPlan(e.target.value as any)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs ${
                    isDark
                      ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="FREE">Free Tier (100 req/m)</option>
                  <option value="PRO">Pro Tier (1,000 req/m)</option>
                  <option value="ENTERPRISE">Enterprise (5,000 req/m)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 border rounded-lg text-xs cursor-pointer ${
                    isDark
                      ? 'border-[#1E2D4A] text-slate-400 hover:bg-[#1E2D4A]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
