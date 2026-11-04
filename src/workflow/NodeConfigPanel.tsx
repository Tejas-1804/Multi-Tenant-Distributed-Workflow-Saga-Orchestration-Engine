import React from 'react';
import {
  X,
  Trash2,
  Copy,
  Globe,
  RotateCcw,
  Repeat,
  AlertTriangle,
  Code2,
  Clock,
  FileText,
  Sliders,
} from 'lucide-react';
import { WorkflowNode, WorkflowNodeData, NodeType } from '../types/index.ts';

interface NodeConfigPanelProps {
  selectedNode: WorkflowNode | null;
  onUpdateNode: (nodeId: string, updatedData: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onClose: () => void;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onClose,
}) => {
  if (!selectedNode) {
    return (
      <div className="w-84 border-l border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center text-slate-400 font-sans text-xs">
        <Sliders className="w-8 h-8 text-slate-300 mb-2" />
        <div className="font-medium text-slate-500">No node selected</div>
        <div className="text-[11px] text-slate-400 mt-1">Click a node on the canvas to configure properties, retries, and conditional branches.</div>
      </div>
    );
  }

  const { id, type, data } = selectedNode;

  const handleChange = (field: keyof WorkflowNodeData, value: any) => {
    onUpdateNode(id, { [field]: value });
  };

  const handleNestedChange = (parent: 'retryPolicy' | 'compensation', field: string, value: any) => {
    const current = (data[parent] as any) || {};
    handleChange(parent, { ...current, [field]: value });
  };

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col h-full font-sans text-xs overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 text-sm">
            Node Configuration
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
            {type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateNode(id)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Duplicate Node"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteNode(id)}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="p-4 space-y-4">
        {/* Label */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Display Label</label>
          <input
            type="text"
            value={data.label || ''}
            onChange={e => handleChange('label', e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g. Check Inventory"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Description</label>
          <textarea
            rows={2}
            value={data.description || ''}
            onChange={e => handleChange('description', e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Document what this node does..."
          />
        </div>

        {/* Demo failure switch */}
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Simulate Downstream Failure</span>
            </div>
            <div className="text-[10px] text-rose-700 mt-0.5">
              Force node failure to test Saga compensation and retry policies
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!data.simulateFailure}
            onChange={e => handleChange('simulateFailure', e.target.checked)}
            className="w-4 h-4 text-rose-600 rounded cursor-pointer"
          />
        </div>

        {/* Node Type Specific Fields */}
        {type === 'HTTP_REQUEST' && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px]">
              <Globe className="w-3.5 h-3.5" />
              <span>HTTP Endpoint Configuration</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Method</label>
                <select
                  value={data.method || 'POST'}
                  onChange={e => handleChange('method', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Timeout (ms)</label>
                <input
                  type="number"
                  value={data.timeoutMs || 5000}
                  onChange={e => handleChange('timeoutMs', parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">Target URL</label>
              <input
                type="text"
                value={data.url || ''}
                onChange={e => handleChange('url', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                placeholder="https://api.example.com/v1/stock"
              />
            </div>
          </div>
        )}

        {/* CONDITION Fields */}
        {type === 'CONDITION' && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="font-bold text-[11px] text-amber-700">Conditional Evaluation</div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">Field in Context</label>
              <input
                type="text"
                value={data.conditionField || 'status'}
                onChange={e => handleChange('conditionField', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                placeholder="status, quantity, inStock..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Operator</label>
                <select
                  value={data.conditionOperator || '=='}
                  onChange={e => handleChange('conditionOperator', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="==">== (Equals)</option>
                  <option value="!=">!= (Not Equal)</option>
                  <option value=">">&gt; (Greater than)</option>
                  <option value="<">&lt; (Less than)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Expected Value</label>
                <input
                  type="text"
                  value={data.conditionValue || '200'}
                  onChange={e => handleChange('conditionValue', e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
              Left Handle = True ("In Stock"), Right Handle = False ("Out of Stock")
            </div>
          </div>
        )}

        {/* Retry Policy Section */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
            <Repeat className="w-3.5 h-3.5 text-blue-600" />
            <span>Exponential Backoff Retry Policy</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Max Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={data.retryPolicy?.maxAttempts ?? 3}
                onChange={e => handleNestedChange('retryPolicy', 'maxAttempts', parseInt(e.target.value, 10))}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Delay (ms)</label>
              <input
                type="number"
                value={data.retryPolicy?.initialDelayMs ?? 1000}
                onChange={e => handleNestedChange('retryPolicy', 'initialDelayMs', parseInt(e.target.value, 10))}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
