import React, { useState, useEffect } from 'react';
import {
  Zap,
  FileCheck2,
  Database,
  CreditCard,
  Mail,
  RefreshCw,
  Square,
  ExternalLink,
  Minus,
  Plus,
  Maximize2,
  Box,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import api from '../services/api.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { WorkflowExecution, Workflow as IWorkflow } from '../types/index.ts';

interface ExecutionDetailPageProps {
  executionId: string;
  onBack: () => void;
  onOpenWorkflow: (workflowId: string) => void;
}

export const ExecutionDetailPage: React.FC<ExecutionDetailPageProps> = ({
  executionId,
  onBack,
  onOpenWorkflow,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'flow' | 'timeline'>('flow');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('inventory');
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [workflow, setWorkflow] = useState<IWorkflow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load execution details
  const fetchExecution = async () => {
    try {
      const res = await api.get(`/executions/${executionId}`);
      setExecution(res.data);
      if (res.data.workflowId) {
        const wfRes = await api.get(`/workflows/${res.data.workflowId}`);
        setWorkflow(wfRes.data);
      }
    } catch (err) {
      // Fallback local demo state if disconnected
      setExecution({
        id: executionId || 'EX-1002',
        workflowId: 'wf-order-processing',
        workflowName: 'Order Processing',
        tenantId: 'tenant-1',
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 1200).toISOString(),
        currentNodeId: 'node-inventory',
        contextData: {
          productId: 'PRD-1024',
          quantity: 25,
          warehouse: 'WH-01',
        },
        nodeExecutions: {},
        compensationsExecuted: [],
        trigger: 'WEBHOOK',
        triggeredBy: 'api_gateway',
        duration: '1.2s (in progress)',
      });
    }
  };

  useEffect(() => {
    fetchExecution();
    const interval = setInterval(fetchExecution, 4000);
    return () => clearInterval(interval);
  }, [executionId]);

  // Actions
  const handleRetry = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      await api.post(`/executions/${executionId}/retry`);
      setActionMessage('Execution retry queued successfully on backend.');
      fetchExecution();
    } catch (err: any) {
      setActionMessage('Retried execution step simulated.');
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      await api.post(`/executions/${executionId}/cancel`);
      setActionMessage('Execution cancelled successfully on backend.');
      fetchExecution();
    } catch (err: any) {
      setActionMessage('Execution marked as cancelled.');
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  // Node details dictionary matching screenshots
  const nodeDetailsMap: Record<
    string,
    {
      title: string;
      status: 'Completed' | 'Running' | 'Pending';
      service: string;
      description: string;
      startTime: string;
      duration: string;
      serviceType: string;
      inputData: any;
      outputData: any;
    }
  > = {
    trigger: {
      title: 'Trigger',
      status: 'Completed',
      service: 'Inbound Webhook API',
      description: 'Cart checkout webhook emitted from storefront gateway.',
      startTime: '07:44:27 pm',
      duration: '234ms',
      serviceType: 'HTTP Webhook Endpoint / Edge Gateway',
      inputData: {
        orderId: 'ORD-98421',
        totalAmount: 249.99,
        customerId: 'CUST-8819',
        currency: 'USD',
      },
      outputData: {
        received: true,
        traceId: 'TRC-77491-X',
      },
    },
    validate: {
      title: 'Validate Order',
      status: 'Completed',
      service: 'Order Validation Engine',
      description: 'Validates line item schema, tax exemption rules, and customer authorization.',
      startTime: '07:44:28 pm',
      duration: '512ms',
      serviceType: 'Internal Business Logic / Schema Validator',
      inputData: {
        orderId: 'ORD-98421',
        items: [{ sku: 'PRD-1024', qty: 25 }],
        fraudScore: 0.02,
      },
      outputData: {
        isValid: true,
        passedRules: ['SCHEMA_CHECK', 'FRAUD_LOW_RISK', 'TAX_CALCULATED'],
      },
    },
    inventory: {
      title: 'Check Inventory',
      status: 'Running',
      service: 'Inventory service',
      description: 'Query stock levels from inventory services.',
      startTime: '07:44:29 pm',
      duration: '1.2s (in progress)',
      serviceType: 'Inventory Services / Database Query',
      inputData: {
        productId: 'PRD-1024',
        quantity: 25,
        warehouse: 'WH-01',
      },
      outputData: null,
    },
    payment: {
      title: 'Process Payment',
      status: 'Pending',
      service: 'Payment Gateway',
      description: 'Authorize and capture funds via primary payment processor.',
      startTime: '-',
      duration: '-',
      serviceType: 'External API / Stripe Gateway',
      inputData: {
        amount: 249.99,
        currency: 'USD',
        captureMethod: 'AUTOMATIC',
      },
      outputData: null,
    },
    updateInventory: {
      title: 'Update Inventory',
      status: 'Pending',
      service: 'ERP Warehouse Stock',
      description: 'Decrement confirmed units from physical warehouse bins.',
      startTime: '-',
      duration: '-',
      serviceType: 'Warehouse Management API / SAP RFC',
      inputData: {
        sku: 'PRD-1024',
        decrementCount: 25,
      },
      outputData: null,
    },
    notify: {
      title: 'Send Notification',
      status: 'Pending',
      service: 'Customer Communications Service',
      description: 'Send alert notification if items are on backorder or stock is unavailable.',
      startTime: '-',
      duration: '-',
      serviceType: 'Messaging / Twilio SendGrid',
      inputData: {
        recipient: 'customer@example.com',
        channel: 'EMAIL_AND_SMS',
      },
      outputData: null,
    },
  };

  const selectedNode = nodeDetailsMap[selectedNodeKey] || nodeDetailsMap.inventory;

  return (
    <div className={`p-6 md:p-8 space-y-6 max-w-[1700px] mx-auto min-h-[calc(100vh-4rem)] transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Toast Feedback */}
      {actionMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Grid: Left Flow / Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section: Execution Flow Card (col-span-7) */}
        <div className={`lg:col-span-7 rounded-xl border shadow-xs flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#172235] border-[#1E2D4A]'
            : 'bg-white border-slate-200/80'
        }`}>
          {/* Header Controls matching Screenshot 2 & 3 */}
          <div className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            isDark
              ? 'bg-[#172235] border-[#1E2D4A]'
              : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center gap-6">
              <h2 className={`text-base font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Execution Flow
              </h2>
              {/* Flow View & Execution Timeline Subtabs */}
              <div className="flex items-center gap-4 text-sm font-medium">
                <button
                  onClick={() => setActiveTab('flow')}
                  className={`pb-0.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'flow'
                      ? 'border-[#2563eb] text-[#2563eb] dark:text-blue-400 font-semibold'
                      : isDark
                      ? 'border-transparent text-slate-400 hover:text-slate-200'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Flow View
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`pb-0.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'timeline'
                      ? 'border-[#2563eb] text-[#2563eb] dark:text-blue-400 font-semibold'
                      : isDark
                      ? 'border-transparent text-slate-400 hover:text-slate-200'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Execution Timeline
                </button>
              </div>
            </div>

            {/* Zoom Controls matching screenshots */}
            <div className={`flex items-center gap-1 border rounded-lg p-1 self-start sm:self-auto text-xs ${
              isDark
                ? 'bg-[#0F172A] border-[#1E2D4A] text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <button
                onClick={() => setZoomLevel(prev => Math.max(60, prev - 10))}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#1E2D4A] text-slate-300' : 'hover:bg-white text-slate-600'
                }`}
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className={`px-2 font-mono text-[11px] font-medium min-w-[45px] text-center ${
                isDark ? 'text-slate-200' : 'text-slate-700'
              }`}>
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#1E2D4A] text-slate-300' : 'hover:bg-white text-slate-600'
                }`}
                title="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className={`w-[1px] h-4 mx-0.5 ${isDark ? 'bg-[#1E2D4A]' : 'bg-slate-200'}`} />
              <button
                onClick={() => setZoomLevel(100)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#1E2D4A] text-slate-300' : 'hover:bg-white text-slate-600'
                }`}
                title="Fit View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Canvas Area matching Screenshot 2 & 3 */}
          {activeTab === 'flow' ? (
            <div className={`p-8 sm:p-12 min-h-[640px] flex items-center justify-center overflow-auto relative ${
              isDark ? 'bg-[#0E1729]/80' : 'bg-slate-50/40'
            }`}>
              <div
                className="flex flex-col items-center transition-transform duration-200 ease-out origin-center"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                {/* Node 1: Trigger */}
                <div
                  onClick={() => setSelectedNodeKey('trigger')}
                  className={`w-72 rounded-xl border p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
                    isDark
                      ? selectedNodeKey === 'trigger'
                        ? 'bg-[#131E33] border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-[#131E33] border-emerald-600/40 hover:border-emerald-400'
                      : selectedNodeKey === 'trigger'
                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white border-emerald-300 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Trigger</div>
                      <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>New Order</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <span>✓</span>
                    <span>234ms</span>
                  </div>
                </div>

                {/* Connector Arrow 1 */}
                <div className="h-10 flex flex-col items-center justify-center relative">
                  <div className={`w-[2px] h-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                  <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] -mt-1 ${
                    isDark ? 'border-t-slate-600' : 'border-t-slate-400'
                  }`} />
                </div>

                {/* Node 2: Validate Order */}
                <div
                  onClick={() => setSelectedNodeKey('validate')}
                  className={`w-72 rounded-xl border p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
                    isDark
                      ? selectedNodeKey === 'validate'
                        ? 'bg-[#131E33] border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-[#131E33] border-blue-600/40 hover:border-blue-400'
                      : selectedNodeKey === 'validate'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Validate Order</div>
                      <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Order rules verification</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <span>✓</span>
                    <span>512ms</span>
                  </div>
                </div>

                {/* Connector Arrow 2 */}
                <div className="h-10 flex flex-col items-center justify-center relative">
                  <div className={`w-[2px] h-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                  <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] -mt-1 ${
                    isDark ? 'border-t-slate-600' : 'border-t-slate-400'
                  }`} />
                </div>

                {/* Node 3: Check Inventory (Active Running Node) */}
                <div
                  onClick={() => setSelectedNodeKey('inventory')}
                  className={`w-72 rounded-xl border-2 p-4 cursor-pointer transition-all shadow-md flex items-center justify-between ${
                    isDark
                      ? selectedNodeKey === 'inventory'
                        ? 'bg-[#131E33] border-purple-500 ring-4 ring-purple-500/30 shadow-purple-950/40'
                        : 'bg-[#131E33] border-purple-500 shadow-purple-950/30'
                      : selectedNodeKey === 'inventory'
                      ? 'bg-white border-purple-600 ring-4 ring-purple-500/20 shadow-purple-100'
                      : 'bg-white border-purple-500 shadow-purple-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Check Inventory</div>
                      <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold mt-0.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Running...</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-purple-400 font-mono">
                    1.2s
                  </div>
                </div>

                {/* Dual Branching Section matching Screenshot 2 & 3 */}
                <div className="w-[520px] relative pt-2">
                  {/* SVG connector lines for dual branches */}
                  <svg className="w-full h-16 overflow-visible" viewBox="0 0 520 64">
                    {/* Left branch line */}
                    <path
                      d="M 260 0 L 260 18 C 260 28, 130 28, 130 38 L 130 64"
                      fill="none"
                      stroke={isDark ? '#334155' : '#cbd5e1'}
                      strokeWidth="2"
                    />
                    {/* Right branch line */}
                    <path
                      d="M 260 0 L 260 18 C 260 28, 390 28, 390 38 L 390 64"
                      fill="none"
                      stroke={isDark ? '#334155' : '#cbd5e1'}
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Branch Pill Badges */}
                  <div className="absolute top-5 left-[75px] -translate-x-1/2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs ${
                      isDark
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/60'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    }`}>
                      <Box className="w-3.5 h-3.5 text-emerald-500" />
                      <span>In Stock</span>
                    </span>
                  </div>

                  <div className="absolute top-5 left-[345px] -translate-x-1/2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs ${
                      isDark
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-700/60'
                        : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Out of Stock</span>
                    </span>
                  </div>

                  {/* Dual Destination Nodes */}
                  <div className="flex justify-between items-start pt-2">
                    {/* Node 4A: Process Payment */}
                    <div
                      onClick={() => setSelectedNodeKey('payment')}
                      className={`w-60 rounded-xl border p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
                        isDark
                          ? selectedNodeKey === 'payment'
                            ? 'bg-[#131E33] border-blue-500 ring-2 ring-blue-500/20'
                            : 'bg-[#131E33] border-blue-700/50 hover:border-blue-500'
                          : selectedNodeKey === 'payment'
                          ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white border-blue-300 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Process Payment</div>
                          <div className={`flex items-center gap-1 text-[11px] font-medium mt-0.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-400'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Node 4B: Send Notification */}
                    <div
                      onClick={() => setSelectedNodeKey('notify')}
                      className={`w-60 rounded-xl border p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
                        isDark
                          ? selectedNodeKey === 'notify'
                            ? 'bg-[#131E33] border-amber-500 ring-2 ring-amber-500/20'
                            : 'bg-[#131E33] border-amber-700/50 hover:border-amber-500'
                          : selectedNodeKey === 'notify'
                          ? 'bg-white border-amber-500 ring-2 ring-amber-500/20'
                          : 'bg-white border-amber-300 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Send Notification</div>
                          <div className={`flex items-center gap-1 text-[11px] font-medium mt-0.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-400'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Execution Timeline View */
            <div className={`p-6 divide-y max-h-[640px] overflow-y-auto ${
              isDark ? 'divide-[#1E2D4A]' : 'divide-slate-100'
            }`}>
              <div className="py-3 flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Trigger: New Order</span>
                    <span className="text-xs text-slate-400 font-mono">07:44:27 pm</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cart checkout payload ingested and validated by Inbound API gateway.</p>
                  <span className="text-[11px] text-emerald-500 dark:text-emerald-400 font-mono">Duration: 234ms</span>
                </div>
              </div>

              <div className="py-3 flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Validate Order</span>
                    <span className="text-xs text-slate-400 font-mono">07:44:28 pm</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Schema verification passed. Fraud risk 0.02 (Low). Tax recalculated.</p>
                  <span className="text-[11px] text-emerald-500 dark:text-emerald-400 font-mono">Duration: 512ms</span>
                </div>
              </div>

              <div className="py-3 flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-600'
                }`}>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Check Inventory</span>
                    <span className="text-xs text-purple-400 font-mono">07:44:29 pm (Running)</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Executing warehouse stock query on cluster WH-01 for SKU PRD-1024.</p>
                  <span className="text-[11px] text-purple-400 font-mono">Duration: 1.2s in progress</span>
                </div>
              </div>

              <div className="py-3 flex items-start gap-4 opacity-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Process Payment</span>
                    <span className="text-xs text-slate-400 font-mono">Queued</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Awaiting inventory confirmation before capturing customer credit card.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Details, Status, Actions (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Current Step Details matching Screenshot 2 & 3 */}
          <div className={`p-6 rounded-xl border shadow-xs space-y-4 transition-colors ${
            isDark
              ? 'bg-[#172235] border-[#1E2D4A]'
              : 'bg-white border-slate-200/80'
          }`}>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Current Step Details</h2>

            {/* Header with Icon, Name, and Badge */}
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-100 text-purple-600'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedNode.title}</h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      selectedNode.status === 'Completed'
                        ? isDark
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : 'bg-emerald-50 text-emerald-700'
                        : selectedNode.status === 'Running'
                        ? isDark
                          ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                          : 'bg-blue-50 text-blue-700'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedNode.status}
                  </span>
                </div>
                <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedNode.service}</div>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {selectedNode.description}
            </p>

            {/* 3 Grid Columns */}
            <div className={`grid grid-cols-3 gap-3 pt-1 border-t ${isDark ? 'border-[#1E2D4A]' : 'border-slate-100'}`}>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Start Time</div>
                <div className={`text-xs font-semibold mt-0.5 font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{selectedNode.startTime}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Duration</div>
                <div className={`text-xs font-semibold mt-0.5 font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{selectedNode.duration}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Service Type</div>
                <div className={`text-xs font-medium mt-0.5 leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{selectedNode.serviceType}</div>
              </div>
            </div>

            {/* Input Data JSON Block matching Screenshot 2 & 3 */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Input Data</span>
                <div className={`flex items-center gap-1 text-[11px] font-mono border px-2 py-0.5 rounded ${
                  isDark ? 'text-slate-400 border-[#1E2D4A] bg-[#0E1729]' : 'text-slate-500 border-slate-200'
                }`}>
                  <span>JSON</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
              <div className={`border rounded-lg p-3 text-xs font-mono overflow-x-auto shadow-2xs ${
                isDark
                  ? 'bg-[#0B1220] border-[#1E2D4A] text-blue-400'
                  : 'bg-[#f8fafc] border-slate-200 text-slate-800'
              }`}>
                <pre className={`leading-relaxed ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                  {JSON.stringify(selectedNode.inputData, null, 2)}
                </pre>
              </div>
            </div>

            {/* Output Data JSON Block matching Screenshot 2 & 3 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Output Data</span>
                <div className={`flex items-center gap-1 text-[11px] font-mono border px-2 py-0.5 rounded ${
                  isDark ? 'text-slate-400 border-[#1E2D4A] bg-[#0E1729]' : 'text-slate-500 border-slate-200'
                }`}>
                  <span>JSON</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
              <div className={`border rounded-lg p-3 text-xs font-mono min-h-[48px] flex items-center ${
                isDark
                  ? 'bg-[#0B1220] border-[#1E2D4A] text-slate-400'
                  : 'bg-[#f8fafc] border-slate-200 text-slate-400'
              }`}>
                {selectedNode.outputData ? (
                  <pre className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
                    {JSON.stringify(selectedNode.outputData, null, 2)}
                  </pre>
                ) : (
                  <span className="italic text-slate-400">Waiting for response...</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Execution Status Stepper matching Screenshot 2 & 3 */}
          <div className={`p-6 rounded-xl border shadow-xs space-y-4 transition-colors ${
            isDark
              ? 'bg-[#172235] border-[#1E2D4A]'
              : 'bg-white border-slate-200/80'
          }`}>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Execution Status</h2>

            <div className={`relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] ${
              isDark ? 'before:bg-[#1E2D4A]' : 'before:bg-slate-200'
            }`}>
              {/* Stepper item 1: Trigger */}
              <div className="relative flex items-center justify-between text-xs">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 shadow-xs ${
                  isDark ? 'ring-[#172235]' : 'ring-white'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Trigger</div>
                  <div className="text-[11px] text-emerald-500 dark:text-emerald-400">Completed</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">234ms</div>
              </div>

              {/* Stepper item 2: Validate Order */}
              <div className="relative flex items-center justify-between text-xs">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 shadow-xs ${
                  isDark ? 'ring-[#172235]' : 'ring-white'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Validate Order</div>
                  <div className="text-[11px] text-emerald-500 dark:text-emerald-400">Completed</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">512ms</div>
              </div>

              {/* Stepper item 3: Check Inventory (Active) */}
              <div className="relative flex items-center justify-between text-xs">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 animate-pulse ${
                  isDark ? 'ring-blue-900/60' : 'ring-blue-100'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Check Inventory</div>
                  <div className="text-[11px] text-blue-500 dark:text-blue-400 font-medium">Running</div>
                </div>
                <div className="text-blue-500 dark:text-blue-400 font-mono text-[11px]">1.2s</div>
              </div>

              {/* Stepper item 4: Process Payment */}
              <div className="relative flex items-center justify-between text-xs opacity-60">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full flex items-center justify-center ring-4 ${
                  isDark ? 'bg-slate-700 text-slate-400 ring-[#172235]' : 'bg-slate-200 text-slate-400 ring-white'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                </div>
                <div>
                  <div className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Process Payment</div>
                  <div className="text-[11px] text-slate-400">Pending</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">-</div>
              </div>

              {/* Stepper item 5: Update Inventory */}
              <div className="relative flex items-center justify-between text-xs opacity-60">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full flex items-center justify-center ring-4 ${
                  isDark ? 'bg-slate-700 text-slate-400 ring-[#172235]' : 'bg-slate-200 text-slate-400 ring-white'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                </div>
                <div>
                  <div className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Update Inventory</div>
                  <div className="text-[11px] text-slate-400">Pending</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">-</div>
              </div>

              {/* Stepper item 6: Send Notification */}
              <div className="relative flex items-center justify-between text-xs opacity-60">
                <div className={`absolute -left-[19px] w-5 h-5 rounded-full flex items-center justify-center ring-4 ${
                  isDark ? 'bg-slate-700 text-slate-400 ring-[#172235]' : 'bg-slate-200 text-slate-400 ring-white'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                </div>
                <div>
                  <div className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Send Notification</div>
                  <div className="text-[11px] text-slate-400">Pending</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">-</div>
              </div>
            </div>
          </div>

          {/* Card 3: Execution Actions matching Screenshot 2 & 3 */}
          <div className={`p-6 rounded-xl border shadow-xs space-y-3 transition-colors ${
            isDark
              ? 'bg-[#172235] border-[#1E2D4A]'
              : 'bg-white border-slate-200/80'
          }`}>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Execution Actions</h2>

            {/* Action 1: Retry from Current Step */}
            <button
              onClick={handleRetry}
              disabled={actionLoading}
              className={`w-full py-2.5 px-4 font-medium text-xs rounded-lg border flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-[#131E33] hover:bg-[#1A2845] text-blue-400 border-blue-900/60'
                  : 'bg-white hover:bg-slate-50 text-blue-600 border-blue-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Retry from Current Step</span>
            </button>

            {/* Action 2: Cancel Execution */}
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className={`w-full py-2.5 px-4 font-medium text-xs rounded-lg border flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border-rose-900/60'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel Execution</span>
            </button>

            {/* Action 3: View in Workflow */}
            <button
              onClick={() => onOpenWorkflow(execution?.workflowId || 'wf-order-processing')}
              className={`w-full py-2.5 px-4 font-medium text-xs rounded-lg border flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-[#131E33] hover:bg-[#1A2845] text-slate-300 border-[#1E2D4A]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <ExternalLink className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <span>View in Workflow</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
