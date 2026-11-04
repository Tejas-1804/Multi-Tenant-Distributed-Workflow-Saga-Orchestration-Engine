import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  ArrowRight,
  Check,
  Clock,
  GitFork,
  Search,
  Filter,
  Plus,
} from 'lucide-react';
import api from '../services/api.ts';
import { WorkflowTemplate } from '../types/index.ts';
import { useTheme } from '../context/ThemeContext.tsx';

interface TemplatesPageProps {
  onInstantiateTemplate: (workflowId: string) => void;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ onInstantiateTemplate }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await api.get('/templates');
        setTemplates(res.data);
      } catch (err) {
        // Fallback default templates
        setTemplates([
          {
            id: 'tpl-order-processing',
            name: 'E-Commerce Order Fulfillment & Saga',
            category: 'E-Commerce',
            description: 'Complete order fulfillment pipeline with inventory check, payment capture, and automated rollback if stock is insufficient.',
            tags: ['E-Commerce', 'Saga', 'Payment', 'Inventory'],
            nodesCount: 6,
            estimatedRuntime: '1.2s - 2.5s',
            workflow: { nodes: [], edges: [] },
          },
          {
            id: 'tpl-payment-processing',
            name: 'Payment Processing & Invoicing',
            category: 'Finance',
            description: 'Capture subscription charges, generate PDF invoices, and trigger ERP revenue recognition hooks.',
            tags: ['Billing', 'Stripe', 'PDF Invoicing'],
            nodesCount: 5,
            estimatedRuntime: '800ms',
            workflow: { nodes: [], edges: [] },
          },
          {
            id: 'tpl-user-registration',
            name: 'User Registration & KYC Onboarding',
            category: 'User Ops',
            description: 'Multi-step customer onboarding with email verification, fraud screening, and welcome drip sequence.',
            tags: ['Auth', 'KYC', 'Security'],
            nodesCount: 5,
            estimatedRuntime: '1.5s',
            workflow: { nodes: [], edges: [] },
          },
          {
            id: 'tpl-inventory-sync',
            name: 'Real-time Multi-Warehouse Inventory Sync',
            category: 'E-Commerce',
            description: 'Poll ERP endpoints, balance distributed warehouse counts, and publish updates to storefronts.',
            tags: ['Warehouse', 'ERP', 'Catalog'],
            nodesCount: 4,
            estimatedRuntime: '2.1s',
            workflow: { nodes: [], edges: [] },
          },
        ]);
      }
    };
    fetchTemplates();
  }, []);

  const handleUseTemplate = async (tpl: WorkflowTemplate) => {
    setLoadingId(tpl.id);
    try {
      const res = await api.post(`/templates/${tpl.id}/instantiate`);
      onInstantiateTemplate(res.data.workflow.id);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const categories = ['ALL', 'E-Commerce', 'Finance', 'User Ops'];

  const filteredTemplates = templates.filter(tpl => {
    const matchesCategory = selectedCategory === 'ALL' || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Workflow Templates</h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Production-tested DAG automation archetypes with out-of-the-box Saga rollbacks.
        </p>
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
            placeholder="Search templates by keyword or tag..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 border ${
              isDark
                ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-200 placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Category:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? isDark
                    ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60 font-semibold'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                  : isDark
                  ? 'text-slate-400 hover:bg-[#1E2D4A]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(tpl => (
          <div
            key={tpl.id}
            className={`rounded-xl border shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between ${
              isDark ? 'bg-[#172235] border-[#1E2D4A]' : 'bg-white border-slate-200/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full font-mono ${
                  isDark
                    ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {tpl.category}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{tpl.estimatedRuntime}</span>
                </span>
              </div>

              <h2 className={`text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>{tpl.name}</h2>
              <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{tpl.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {tpl.tags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded font-mono ${
                      isDark ? 'bg-[#0B1220] text-slate-300 border border-[#1E2D4A]' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className={`pt-5 mt-5 border-t flex items-center justify-between ${
              isDark ? 'border-[#1E2D4A]' : 'border-slate-100'
            }`}>
              <span className={`text-xs font-mono flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <GitFork className="w-3.5 h-3.5 text-slate-400" />
                <span>{tpl.nodesCount} DAG Nodes</span>
              </span>

              <button
                onClick={() => handleUseTemplate(tpl)}
                disabled={loadingId === tpl.id}
                className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{loadingId === tpl.id ? 'Creating...' : 'Use Template'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
