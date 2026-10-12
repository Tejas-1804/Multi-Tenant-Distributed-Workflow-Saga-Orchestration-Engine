import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Play,
  Globe,
  GitBranch,
  Clock,
  Code2,
  Webhook,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { WorkflowNodeData, NodeType } from '../types/index.ts';

const nodeTypeConfig: Record<
  NodeType,
  { label: string; icon: any; color: string; border: string; bg: string }
> = {
  START: {
    label: 'Start Node',
    icon: Play,
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/40',
  },
  HTTP_REQUEST: {
    label: 'HTTP Request',
    icon: Globe,
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/40',
  },
  CONDITION: {
    label: 'Branch Condition',
    icon: GitBranch,
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/40',
  },
  TRANSFORM: {
    label: 'Sandbox Transform',
    icon: Code2,
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/40',
  },
  DELAY: {
    label: 'Delay Pause',
    icon: Clock,
    color: 'text-zinc-400',
    border: 'border-zinc-500/40',
    bg: 'bg-zinc-900/60',
  },
  LOG: {
    label: 'Audit Log',
    icon: FileText,
    color: 'text-blue-400',
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/40',
  },
  WEBHOOK: {
    label: 'Webhook Ingest',
    icon: Webhook,
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-950/40',
  },
  END: {
    label: 'End Node',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/40',
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
      className={`relative min-w-[220px] max-w-[280px] rounded-xl border p-3.5 shadow-xl transition-all font-sans ${
        selected ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-emerald-950/50' : config.border
      } ${config.bg} bg-zinc-950/90 backdrop-blur-md`}
    >
      {/* Target input handle (All nodes except START) */}
      {nodeType !== 'START' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-zinc-900 !-left-1.5 transition-transform hover:scale-125"
        />
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${config.color} bg-zinc-900/80 border border-zinc-800`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            {config.label}
          </span>
        </div>

        {/* Indicators for Saga / Failure */}
        <div className="flex items-center gap-1">
          {hasCompensation && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-0.5"
              title="Saga Compensation Configured"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>SAGA</span>
            </span>
          )}
          {willSimulateFailure && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-0.5 animate-pulse"
              title="Will Simulate Failure in Next Run"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>FAIL</span>
            </span>
          )}
        </div>
      </div>

      {/* Node Title & Description */}
      <div className="space-y-1">
        <div className="text-xs font-bold text-zinc-100 truncate">
          {nodeData.label || 'Untitled Node'}
        </div>
        {nodeData.description && (
          <div className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
            {nodeData.description}
          </div>
        )}
      </div>

      {/* Node Specific Metadata Badges */}
      <div className="mt-2.5 pt-2 border-t border-zinc-850 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
        {nodeType === 'HTTP_REQUEST' && (
          <div className="flex items-center gap-1.5 truncate">
            <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold">
              {nodeData.method || 'GET'}
            </span>
            <span className="truncate max-w-[130px] text-zinc-400">
              {nodeData.url || 'https://...'}
            </span>
          </div>
        )}

        {nodeType === 'CONDITION' && (
          <div className="text-amber-400 truncate">
            if {nodeData.conditionField || 'var'} {nodeData.conditionOperator || '=='} {nodeData.conditionValue || 'val'}
          </div>
        )}

        {nodeType === 'TRANSFORM' && (
          <div className="text-purple-400 truncate">
            JS Sandbox Evaluator
          </div>
        )}

        {nodeType === 'DELAY' && (
          <div className="text-zinc-400">
            Pause: {nodeData.delayMs || 1000}ms
          </div>
        )}

        {nodeType === 'START' && (
          <div className="text-emerald-400 font-mono">
            Trigger: Input Payload
          </div>
        )}

        {nodeType === 'END' && (
          <div className="text-emerald-400 font-mono">
            Terminal State
          </div>
        )}
      </div>

      {/* Output handles */}
      {nodeType === 'CONDITION' ? (
        <>
          {/* True Handle */}
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: '35%' }}
            className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900 !-right-1.5 transition-transform hover:scale-125"
          />
          <div className="absolute -right-12 top-[24%] text-[9px] font-mono text-emerald-400 font-bold pointer-events-none">
            TRUE →
          </div>

          {/* False Handle */}
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '65%' }}
            className="!w-3 !h-3 !bg-rose-400 !border-2 !border-zinc-900 !-right-1.5 transition-transform hover:scale-125"
          />
          <div className="absolute -right-14 top-[58%] text-[9px] font-mono text-rose-400 font-bold pointer-events-none">
            FALSE →
          </div>
        </>
      ) : nodeType !== 'END' ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900 !-right-1.5 transition-transform hover:scale-125"
        />
      ) : null}
    </div>
  );
});
