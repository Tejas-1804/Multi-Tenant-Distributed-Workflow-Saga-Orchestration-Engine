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
      <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-6 flex flex-col items-center justify-center text-center text-zinc-500 font-mono text-xs">
        <Sliders className="w-8 h-8 text-zinc-700 mb-2" />
        <div>Select a node on the canvas to configure its properties, retries, and Saga compensations.</div>
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
    <div className="w-96 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full font-sans text-xs overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">
            CONFIGURATION
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
            {type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateNode(id)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Duplicate node"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteNode(id)}
            className="p-1 rounded hover:bg-rose-950/50 text-rose-400"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Basic Metadata */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1">Node Label</label>
            <input
              type="text"
              value={data.label || ''}
              onChange={e => handleChange('label', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Capture Payment"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={data.description || ''}
              onChange={e => handleChange('description', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-emerald-500"
              placeholder="Action summary or documentation"
            />
          </div>
        </div>

        {/* HTTP REQUEST NODE CONFIG */}
        {type === 'HTTP_REQUEST' && (
          <div className="space-y-4 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>HTTP REQUEST SPECIFICATION</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">Method</label>
                <select
                  value={data.method || 'GET'}
                  onChange={e => handleChange('method', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 font-mono text-xs"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">Endpoint URL</label>
                <input
                  type="text"
                  value={data.url || ''}
                  onChange={e => handleChange('url', e.target.value)}
                  placeholder="https://api.example.com/v1/..."
                  className="w-full px-2 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 font-mono text-xs"
                />
              </div>
            </div>

            {['POST', 'PUT', 'PATCH'].includes(data.method || 'GET') && (
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                  Request Body (JSON Template)
                </label>
                <textarea
                  rows={4}
                  value={data.body || ''}
                  onChange={e => handleChange('body', e.target.value)}
                  placeholder={'{\n  "orderId": "{{orderId}}",\n  "amount": 250\n}'}
                  className="w-full px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 font-mono text-[11px]"
                />
              </div>
            )}

            {/* Retry Policy Configuration */}
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-mono text-[11px] font-semibold">
                <Repeat className="w-3 h-3" />
                <span>EXPONENTIAL BACKOFF RETRY</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div>
                  <label className="text-zinc-400">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={data.retryPolicy?.maxAttempts ?? 3}
                    onChange={e => handleNestedChange('retryPolicy', 'maxAttempts', parseInt(e.target.value) || 1)}
                    className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-zinc-400">Initial (ms)</label>
                  <input
                    type="number"
                    step={500}
                    value={data.retryPolicy?.initialDelayMs ?? 1000}
                    onChange={e => handleNestedChange('retryPolicy', 'initialDelayMs', parseInt(e.target.value) || 500)}
                    className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-zinc-400">Multiplier</label>
                  <input
                    type="number"
                    step={0.5}
                    value={data.retryPolicy?.backoffMultiplier ?? 2}
                    onChange={e => handleNestedChange('retryPolicy', 'backoffMultiplier', parseFloat(e.target.value) || 2)}
                    className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                  />
                </div>
              </div>
            </div>

            {/* SAGA COMPENSATION CONFIGURATION */}
            <div className="p-3 rounded-lg border border-cyan-900/60 bg-cyan-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-[11px] font-semibold">
                  <RotateCcw className="w-3 h-3" />
                  <span>SAGA COMPENSATION ROLLBACK</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.compensation?.enabled || false}
                  onChange={e => handleNestedChange('compensation', 'enabled', e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {data.compensation?.enabled && (
                <div className="space-y-2 text-[10px] font-mono">
                  <div>
                    <label className="text-zinc-400">Rollback Action Name</label>
                    <input
                      type="text"
                      value={data.compensation.name || ''}
                      onChange={e => handleNestedChange('compensation', 'name', e.target.value)}
                      placeholder="e.g. Refund Payment Transaction"
                      className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400">Simulated Rollback Effect</label>
                    <input
                      type="text"
                      value={data.compensation.simulatedAction || ''}
                      onChange={e => handleNestedChange('compensation', 'simulatedAction', e.target.value)}
                      placeholder="e.g. Refund $249.99 to customer credit card"
                      className="w-full mt-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* INTENTIONAL FAILURE SIMULATOR SWITCH */}
            <div className="p-3 rounded-lg border border-rose-900/60 bg-rose-950/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-rose-300 font-mono text-[11px] font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>SIMULATE FAILURE (TESTING)</span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  Force this node to throw 500 error to test retries, DLQ, and Saga reversal.
                </div>
              </div>
              <input
                type="checkbox"
                checked={data.simulateFailure || false}
                onChange={e => handleChange('simulateFailure', e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-rose-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* CONDITION NODE CONFIG */}
        {type === 'CONDITION' && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/80">
            <div className="text-amber-400 font-mono text-[11px] font-semibold">
              BRANCH EVALUATION RULE
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">Variable Field</label>
              <input
                type="text"
                value={data.conditionField || ''}
                onChange={e => handleChange('conditionField', e.target.value)}
                placeholder="e.g. status or amount"
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">Operator</label>
                <select
                  value={data.conditionOperator || '=='}
                  onChange={e => handleChange('conditionOperator', e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                >
                  <option value="==">== (Equals)</option>
                  <option value="!=">!= (Not Equal)</option>
                  <option value=">">&gt; (Greater)</option>
                  <option value="<">&lt; (Less)</option>
                  <option value=">=">&gt;= (Greater or Equal)</option>
                  <option value="<=">&lt;= (Less or Equal)</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">Target Value</label>
                <input
                  type="text"
                  value={data.conditionValue || ''}
                  onChange={e => handleChange('conditionValue', e.target.value)}
                  placeholder="e.g. 200"
                  className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* TRANSFORM NODE CONFIG */}
        {type === 'TRANSFORM' && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-purple-400 font-mono text-[11px] font-semibold">
              <Code2 className="w-3.5 h-3.5" />
              <span>SANDBOX JAVASCRIPT TRANSFORM</span>
            </div>

            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Executed in an isolated Node.js context with 2-second timeout protection.
            </p>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">Script Function</label>
              <textarea
                rows={8}
                value={data.transformScript || ''}
                onChange={e => handleChange('transformScript', e.target.value)}
                placeholder={'// input is available globally\nreturn {\n  ...input,\n  tax: input.price * 0.18\n};'}
                className="w-full px-2.5 py-2 rounded bg-zinc-900 border border-zinc-800 text-purple-200 font-mono text-[11px]"
              />
            </div>
          </div>
        )}

        {/* DELAY NODE CONFIG */}
        {type === 'DELAY' && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>DELAY DURATION</span>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">Duration (milliseconds)</label>
              <input
                type="number"
                step={500}
                value={data.delayMs || 1000}
                onChange={e => handleChange('delayMs', parseInt(e.target.value) || 1000)}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* LOG NODE CONFIG */}
        {type === 'LOG' && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-blue-400 font-mono text-[11px] font-semibold">
              <FileText className="w-3.5 h-3.5" />
              <span>STRUCTURED AUDIT LOGGING</span>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">Log Level</label>
              <select
                value={data.logLevel || 'INFO'}
                onChange={e => handleChange('logLevel', e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              >
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">Message Template</label>
              <input
                type="text"
                value={data.logMessage || ''}
                onChange={e => handleChange('logMessage', e.target.value)}
                placeholder="Log message..."
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
