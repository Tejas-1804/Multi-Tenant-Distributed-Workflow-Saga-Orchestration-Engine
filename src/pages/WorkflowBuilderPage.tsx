import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  ArrowLeft,
  Sliders,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import api from '../services/api.ts';
import { CustomWorkflowNode } from '../workflow/CustomWorkflowNode.tsx';
import { NodeConfigPanel } from '../workflow/NodeConfigPanel.tsx';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowNodeData,
} from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface WorkflowBuilderPageProps {
  workflowId?: string | null;
  onBack: () => void;
  onOpenExecutionDetail: (executionId: string) => void;
}

const nodeTypes = {
  START: CustomWorkflowNode,
  HTTP_REQUEST: CustomWorkflowNode,
  CONDITION: CustomWorkflowNode,
  DELAY: CustomWorkflowNode,
  TRANSFORM: CustomWorkflowNode,
  WEBHOOK: CustomWorkflowNode,
  LOG: CustomWorkflowNode,
  END: CustomWorkflowNode,
};

export const WorkflowBuilderPage: React.FC<WorkflowBuilderPageProps> = ({
  workflowId,
  onBack,
  onOpenExecutionDetail,
}) => {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('Orchestration DAG pipeline');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: any[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executePayload, setExecutePayload] = useState(
    JSON.stringify({ orderId: 'ORD-5542', customer: 'Sarah Connor', amount: 249.99, status: 200 }, null, 2)
  );

  // Load existing workflow or initialize starter nodes
  useEffect(() => {
    if (workflowId) {
      api.get(`/workflows/${workflowId}`).then(res => {
        const wf: Workflow = res.data;
        setWorkflow(wf);
        setWorkflowName(wf.name);
        setWorkflowDescription(wf.description);

        // Convert to React Flow format
        const rfNodes = wf.nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));

        const rfEdges = wf.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
          label: e.label,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
          style: { stroke: '#10b981', strokeWidth: 2 },
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
      }).catch(err => {
        console.error('Failed to load workflow:', err);
      });
    } else {
      // Initialize with default START and END
      const initialNodes: Node[] = [
        {
          id: 'node-start',
          type: 'START',
          position: { x: 100, y: 150 },
          data: { label: 'Start Trigger', description: 'Receives initial payload' },
        },
        {
          id: 'node-end',
          type: 'END',
          position: { x: 500, y: 150 },
          data: { label: 'End Transaction', description: 'Marks execution SUCCESS' },
        },
      ];
      const initialEdges: Edge[] = [
        {
          id: 'edge-1',
          source: 'node-start',
          target: 'node-end',
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
      ];
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [workflowId]);

  const onConnect = useCallback(
    (params: Connection) => {
      const isCondition = nodes.find(n => n.id === params.source)?.type === 'CONDITION';
      const edgeLabel = params.sourceHandle === 'true' ? 'True' : params.sourceHandle === 'false' ? 'False' : undefined;

      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${params.sourceHandle || 'def'}`,
        type: 'smoothstep',
        animated: true,
        label: edgeLabel,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        style: { stroke: '#10b981', strokeWidth: 2 },
      };
      setEdges(eds => addEdge(newEdge, eds));
    },
    [nodes, setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find(node => node.id === selectedNodeId);
    if (!n) return null;
    return {
      id: n.id,
      type: n.type as NodeType,
      position: n.position,
      data: n.data as unknown as WorkflowNodeData,
    };
  }, [selectedNodeId, nodes]);

  const handleUpdateNode = useCallback((nodeId: string, updatedData: Partial<WorkflowNodeData>) => {
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updatedData,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newId = `node_${Math.random().toString(36).substring(2, 7)}`;
    const duplicate: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: {
        ...JSON.parse(JSON.stringify(node.data)),
        label: `${(node.data as any).label} (Copy)`,
      },
      selected: false,
    };
    setNodes(nds => [...nds, duplicate]);
    setSelectedNodeId(newId);
  }, [nodes, setNodes]);

  // Add new node from Left Palette
  const addNode = (type: NodeType) => {
    const id = `node_${type.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;
    const labels: Record<NodeType, string> = {
      START: 'Start Trigger',
      HTTP_REQUEST: 'HTTP API Service',
      CONDITION: 'Conditional Branch',
      DELAY: 'Delay Timer',
      TRANSFORM: 'Transform Payload',
      WEBHOOK: 'Webhook Listener',
      LOG: 'Audit Event Log',
      END: 'Completion Node',
    };

    const newNode: Node = {
      id,
      type,
      position: { x: 300 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: {
        label: labels[type],
        description: `Configured ${type} task`,
        ...(type === 'HTTP_REQUEST' && {
          method: 'POST',
          url: 'https://api.example.com/v1/resource',
          retryPolicy: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 },
          compensation: { enabled: true, name: 'Rollback Action', method: 'DELETE', url: 'https://api.example.com/v1/rollback' },
        }),
        ...(type === 'CONDITION' && {
          conditionField: 'status',
          conditionOperator: '==',
          conditionValue: '200',
        }),
        ...(type === 'TRANSFORM' && {
          transformScript: 'return { ...input, timestamp: new Date().toISOString() };',
        }),
      },
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  // Validate DAG against backend
  const validateDAG = async () => {
    try {
      const payload = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          label: e.label,
        })),
      };

      const res = await api.post('/workflows/validate-raw', payload);
      setValidationResult(res.data);
    } catch (err: any) {
      console.error('Validation error:', err);
    }
  };

  // Save workflow
  const saveWorkflow = async () => {
    setSaving(true);
    try {
      const formattedNodes: WorkflowNode[] = nodes.map(n => ({
        id: n.id,
        type: n.type as NodeType,
        position: n.position,
        data: n.data as unknown as WorkflowNodeData,
      }));

      const formattedEdges: WorkflowEdge[] = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle as any,
        targetHandle: e.targetHandle as any,
        label: (e.label as string) || undefined,
      }));

      if (workflowId) {
        const res = await api.put(`/workflows/${workflowId}`, {
          name: workflowName,
          description: workflowDescription,
          nodes: formattedNodes,
          edges: formattedEdges,
        });
        setWorkflow(res.data);
        alert('Workflow saved successfully!');
      } else {
        const res = await api.post('/workflows', {
          name: workflowName,
          description: workflowDescription,
          nodes: formattedNodes,
          edges: formattedEdges,
          status: 'ACTIVE',
        });
        setWorkflow(res.data);
        alert('Workflow created successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  // Execute workflow
  const executeCurrentWorkflow = async () => {
    setExecuting(true);
    try {
      let currentWfId = workflow?.id;

      // If not yet saved to backend, save first
      if (!currentWfId) {
        const formattedNodes = nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));
        const formattedEdges = edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          label: e.label,
        }));
        const saveRes = await api.post('/workflows', {
          name: workflowName,
          description: workflowDescription,
          nodes: formattedNodes,
          edges: formattedEdges,
          status: 'ACTIVE',
        });
        currentWfId = saveRes.data.id;
        setWorkflow(saveRes.data);
      }

      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(executePayload);
      } catch {
        alert('Invalid JSON in Input Payload');
        return;
      }

      const execRes = await api.post(`/workflows/${currentWfId}/execute`, {
        inputPayload: parsedPayload,
        trigger: 'MANUAL',
      });

      setShowExecuteModal(false);
      onOpenExecutionDetail(execRes.data.executionId);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-sans">
      {/* Top Builder Toolbar */}
      <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-950 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Back to workflows list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              className="text-sm font-bold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none px-1"
              placeholder="Workflow Name"
            />
            {workflow && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                v{workflow.version}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={validateDAG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-850 text-xs font-mono text-zinc-200 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Validate DAG</span>
          </button>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-850 text-xs font-mono text-zinc-200 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-zinc-400" />
            <span>{saving ? 'Saving...' : 'Save DAG'}</span>
          </button>

          <button
            onClick={() => setShowExecuteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs font-mono shadow-sm shadow-emerald-950 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute Workflow</span>
          </button>
        </div>
      </div>

      {/* Validation Result Notification Banner */}
      {validationResult && (
        <div
          className={`px-6 py-2 border-b text-xs font-mono flex items-center justify-between ${
            validationResult.valid
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>
              {validationResult.valid
                ? 'DAG is strictly valid, acyclic, and ready for execution engine.'
                : `Validation failed: ${validationResult.errors.map(e => e.message).join(' · ')}`}
            </span>
          </div>
          <button
            onClick={() => setValidationResult(null)}
            className="text-xs hover:underline text-zinc-400 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace: Left Node Palette + Center React Flow + Right Config */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Node Library Palette */}
        <div className="w-56 border-r border-zinc-800 bg-zinc-950/90 p-4 space-y-4 shrink-0 overflow-y-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
            NODE LIBRARY
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Click to append nodes to your distributed DAG. Connect ports to direct execution flow.
          </p>

          <div className="space-y-2">
            {(
              [
                { type: 'START', label: 'Start Trigger', desc: 'Receives initial payload' },
                { type: 'HTTP_REQUEST', label: 'HTTP Request', desc: 'REST API call & Saga action' },
                { type: 'CONDITION', label: 'Condition Branch', desc: 'True/False routing' },
                { type: 'TRANSFORM', label: 'Transform Script', desc: 'Isolated JS VM sandbox' },
                { type: 'DELAY', label: 'Delay Pause', desc: 'Timer backoff delay' },
                { type: 'LOG', label: 'Audit Log', desc: 'Structured message' },
                { type: 'END', label: 'End Terminal', desc: 'Closes transaction' },
              ] as { type: NodeType; label: string; desc: string }[]
            ).map(item => (
              <button
                key={item.type}
                onClick={() => addNode(item.type)}
                className="w-full text-left p-2.5 rounded-lg border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-300">
                    {item.label}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400" />
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 h-full bg-zinc-900 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="#27272a" gap={20} size={1} />
            <Controls className="!bg-zinc-900 !border-zinc-800 !text-zinc-200" />
            <MiniMap
              className="!bg-zinc-950 !border-zinc-800"
              nodeColor={() => '#10b981'}
              maskColor="rgba(0, 0, 0, 0.7)"
            />
          </ReactFlow>
        </div>

        {/* Right Node Configuration Side Panel */}
        <NodeConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      {/* Execute Modal */}
      {showExecuteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-current" />
                <span>Execute Workflow Instance</span>
              </div>
              <button
                onClick={() => setShowExecuteModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Inject custom input payload into the START node. The workflow state machine will process the DAG, dispatch workers, and broadcast real-time WebSocket progress.
            </p>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Input Payload (JSON)</label>
              <textarea
                rows={6}
                value={executePayload}
                onChange={e => setExecutePayload(e.target.value)}
                className="w-full p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={executeCurrentWorkflow}
                disabled={executing}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-sm shadow-emerald-950"
              >
                {executing ? 'Starting Engine...' : 'Run Execution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
