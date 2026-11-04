import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Zap,
  Globe,
  GitBranch,
  Clock,
  Code2,
  Webhook,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Database,
  CreditCard,
  Mail,
} from 'lucide-react';
import { WorkflowNodeData, NodeType } from '../types/index.ts';

const nodeTypeConfig: Record<
  NodeType,
  { label: string; icon: any; color: string; border: string; bg: string }
> = {
  START: {
    label: 'Trigger Event',
    icon: Zap,
    color: 'text-emerald-600',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/60',
  },
  HTTP_REQUEST: {
    label: 'API / Service Call',
    icon: Globe,
    color: 'text-blue-600',
    border: 'border-blue-300',
    bg: 'bg-blue-50/60',
  },
  CONDITION: {
    label: 'Branch Condition',
    icon: GitBranch,
    color: 'text-amber-600',
    border: 'border-amber-300',
    bg: 'bg-amber-50/60',
  },
  TRANSFORM: {
    label: 'Transform & Validate',
    icon: Code2,
    color: 'text-purple-600',
    border: 'border-purple-300',
    bg: 'bg-purple-50/60',
  },
  DELAY: {
    label: 'Timer Delay',
    icon: Clock,
    color: 'text-slate-600',
    border: 'border-slate-300',
    bg: 'bg-slate-50',
  },
  LOG: {
    label: 'Notification / Log',
    icon: Mail,
    color: 'text-amber-600',
    border: 'border-amber-300',
    bg: 'bg-amber-50/60',
  },
  WEBHOOK: {
    label: 'Webhook Ingest',
    icon: Webhook,
    color: 'text-pink-600',
    border: 'border-pink-300',
    bg: 'bg-pink-50/60',
  },
  END: {
    label: 'Complete Node',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/60',
  },
};

export const CustomWorkflowNode: React.FC<NodeProps> = memo(({ id, data, selected, type }) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const nodeType = (type || 'HTTP_REQUEST') as NodeType;
  const config = nodeTypeConfig[nodeType] || nodeTypeConfig.HTTP_REQUEST;
  const Icon = config.icon;

  const hasCompensation = nodeData.compensation?.enabled;
  const willSimulateFailure = nodeData.simulateFailure;

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl border p-4 shadow-sm transition-all font-sans bg-white ${
        selected ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' : config.border
      }`}
    >
      {/* Target input handle (All nodes except START) */}
      {nodeType !== 'START' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !-top-1.5 transition-transform hover:scale-125"
        />
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config.color} ${config.bg} border border-slate-200/60`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            {config.label}
          </span>
        </div>

        {/* Indicators for Saga / Failure */}
        <div className="flex items-center gap-1">
          {hasCompensation && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5 font-semibold"
              title="Saga Compensation Configured"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>SAGA</span>
            </span>
          )}
          {willSimulateFailure && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5 animate-pulse font-semibold"
              title="Will Simulate Failure in Next Run"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>FAIL</span>
            </span>
          )}
        </div>
      </div>

      {/* Node Label & Description */}
      <div className="space-y-1">
        <div className="text-xs font-bold text-slate-900 leading-tight">
          {nodeData.label || 'Untitled Node'}
        </div>
        {nodeData.description && (
          <div className="text-[11px] text-slate-500 leading-snug line-clamp-2">
            {nodeData.description}
          </div>
        )}
      </div>

      {/* Node specific metadata badges */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
        {nodeType === 'HTTP_REQUEST' && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
            {nodeData.method || 'POST'}
          </span>
        )}
        {nodeType === 'CONDITION' && (
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
            IF {nodeData.conditionField || 'status'}
          </span>
        )}
        {nodeType === 'TRANSFORM' && (
          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">
            VM SANDBOX
          </span>
        )}
        {nodeType === 'START' && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
            TRIGGER
          </span>
        )}
        {nodeType === 'END' && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
            TERMINAL
          </span>
        )}

        {nodeData.retryPolicy && (
          <span className="text-[10px] text-slate-400">
            {nodeData.retryPolicy.maxAttempts}x retry
          </span>
        )}
      </div>

      {/* Source output handles */}
      {nodeType === 'CONDITION' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white !-bottom-1.5 !left-1/4 transition-transform hover:scale-125"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white !-bottom-1.5 !left-3/4 transition-transform hover:scale-125"
          />
        </>
      ) : nodeType !== 'END' ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white !-bottom-1.5 transition-transform hover:scale-125"
        />
      ) : null}
    </div>
  );
});

CustomWorkflowNode.displayName = 'CustomWorkflowNode';
