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
  Check,
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [executePayload, setExecutePayload] = useState(
    JSON.stringify({ orderId: 'ORD-5542', customer: 'Sarah Connor', amount: 249.99, status: 200 }, null, 2)
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
          style: { stroke: '#2563eb', strokeWidth: 2 },
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
          position: { x: 250, y: 50 },
          data: { label: 'Start Trigger', description: 'Receives initial event payload' },
        },
        {
          id: 'node-validate',
          type: 'TRANSFORM',
          position: { x: 250, y: 180 },
          data: { label: 'Validate Order', description: 'Verify schema and tax exemptions' },
        },
        {
          id: 'node-inventory',
          type: 'HTTP_REQUEST',
          position: { x: 250, y: 310 },
          data: { label: 'Check Inventory', description: 'Query warehouse stock levels' },
        },
        {
          id: 'node-payment',
          type: 'HTTP_REQUEST',
          position: { x: 100, y: 460 },
          data: { label: 'Process Payment', description: 'Authorize card transaction' },
        },
        {
          id: 'node-notify',
          type: 'LOG',
          position: { x: 400, y: 460 },
          data: { label: 'Send Notification', description: 'Dispatch customer alert' },
        },
      ];
      const initialEdges: Edge[] = [
        {
          id: 'e1',
          source: 'node-start',
          target: 'node-validate',
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
          style: { stroke: '#2563eb', strokeWidth: 2 },
        },
        {
          id: 'e2',
          source: 'node-validate',
          target: 'node-inventory',
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
          style: { stroke: '#2563eb', strokeWidth: 2 },
        },
        {
          id: 'e3',
          source: 'node-inventory',
          target: 'node-payment',
          label: 'In Stock',
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
        {
          id: 'e4',
          source: 'node-inventory',
          target: 'node-notify',
          label: 'Out of Stock',
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
          style: { stroke: '#ef4444', strokeWidth: 2 },
        },
      ];
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [workflowId]);

  // Connect edges
  const onConnect = useCallback(
    (params: Connection) => {
      const isConditionTrue = params.sourceHandle === 'true';
      const isConditionFalse = params.sourceHandle === 'false';

      const strokeColor = isConditionTrue ? '#10b981' : isConditionFalse ? '#ef4444' : '#2563eb';
      const label = isConditionTrue ? 'In Stock' : isConditionFalse ? 'Out of Stock' : undefined;

      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        type: 'smoothstep',
        animated: true,
        label,
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        style: { stroke: strokeColor, strokeWidth: 2 },
      };
      setEdges(eds => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Click on node
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Click on canvas background deselects
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Update node data from config drawer
  const handleUpdateNode = (nodeId: string, updatedData: Partial<WorkflowNodeData>) => {
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
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setNodes(nds => nds.filter(node => node.id !== nodeId));
    setEdges(eds => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
  };

  // Duplicate node
  const handleDuplicateNode = (nodeId: string) => {
    const nodeToDup = nodes.find(n => n.id === nodeId);
    if (!nodeToDup) return;

    const newId = `node-${Date.now()}`;
    const newNode: Node = {
      ...nodeToDup,
      id: newId,
      position: {
        x: nodeToDup.position.x + 40,
        y: nodeToDup.position.y + 40,
      },
      data: {
        ...nodeToDup.data,
        label: `${(nodeToDup.data as any).label || 'Node'} (Copy)`,
      },
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newId);
  };

  // Add new node from palette
  const addNode = (type: NodeType) => {
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: nodes.length * 100 + 40 },
      data: {
        label: `New ${type.replace('_', ' ')}`,
        ...(type === 'HTTP_REQUEST' && {
          method: 'POST',
          url: 'https://api.example.com/v1/resource',
          timeoutMs: 5000,
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
      if (res.data.valid) {
        showToast('DAG is strictly valid, acyclic, and ready for execution.');
      }
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
        showToast('Workflow saved successfully!');
      } else {
        const res = await api.post('/workflows', {
          name: workflowName,
          description: workflowDescription,
          nodes: formattedNodes,
          edges: formattedEdges,
          status: 'ACTIVE',
        });
        setWorkflow(res.data);
        showToast('Workflow created successfully!');
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

        const createRes = await api.post('/workflows', {
          name: workflowName,
          description: workflowDescription,
          nodes: formattedNodes,
          edges: formattedEdges,
          status: 'ACTIVE',
        });
        currentWfId = createRes.data.id;
        setWorkflow(createRes.data);
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white font-sans">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Builder Toolbar */}
      <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Back to workflows"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              className="text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1"
              placeholder="Workflow Name"
            />
            {workflow && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-semibold">
                v{workflow.version}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={validateDAG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Validate DAG</span>
          </button>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>{saving ? 'Saving...' : 'Save DAG'}</span>
          </button>

          <button
            onClick={() => setShowExecuteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs shadow-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute Workflow</span>
          </button>
        </div>
      </div>

      {/* Validation Result Notification Banner */}
      {validationResult && (
        <div
          className={`px-6 py-2 border-b text-xs flex items-center justify-between ${
            validationResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span className="font-medium">
              {validationResult.valid
                ? 'DAG is strictly valid, acyclic, and ready for execution engine.'
                : `Validation failed: ${validationResult.errors.map(e => e.message).join(' · ')}`}
            </span>
          </div>
          <button
            onClick={() => setValidationResult(null)}
            className="text-xs hover:underline text-slate-500 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace: Left Node Palette + Center React Flow + Right Config */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Node Library Palette */}
        <div className="w-60 border-r border-slate-200 bg-white p-4 space-y-4 shrink-0 overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Node Library
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Click to add nodes to your canvas. Connect ports to branch and direct execution.
          </p>

          <div className="space-y-2">
            {(
              [
                { type: 'START', label: 'Trigger Event', desc: 'Inbound webhook / manual trigger' },
                { type: 'TRANSFORM', label: 'Validate Order', desc: 'Schema & business rule checks' },
                { type: 'HTTP_REQUEST', label: 'Check Inventory', desc: 'Warehouse database query' },
                { type: 'HTTP_REQUEST', label: 'Process Payment', desc: 'Credit card capture API' },
                { type: 'HTTP_REQUEST', label: 'Update Inventory', desc: 'ERP SKU count decrement' },
                { type: 'CONDITION', label: 'Branch Condition', desc: 'In Stock / Out of Stock' },
                { type: 'LOG', label: 'Send Notification', desc: 'Email / SMS customer alert' },
                { type: 'END', label: 'End Transaction', desc: 'Closes execution successfully' },
              ] as { type: NodeType; label: string; desc: string }[]
            ).map(item => (
              <button
                key={`${item.type}-${item.label}`}
                onClick={() => addNode(item.type)}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                    {item.label}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 h-full bg-[#f8fafc] relative">
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
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="!bg-white !border-slate-200 !shadow-sm !rounded-lg" />
            <MiniMap
              className="!bg-white !border-slate-200 !shadow-sm !rounded-lg"
              nodeColor={n => (n.type === 'START' ? '#10b981' : n.type === 'CONDITION' ? '#f59e0b' : '#3b82f6')}
            />
          </ReactFlow>
        </div>

        {/* Right Configuration Drawer */}
        <NodeConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      {/* Execution Payload Modal */}
      {showExecuteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Trigger Workflow Execution</h3>
              <button
                onClick={() => setShowExecuteModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Provide input data JSON for the trigger node:
            </p>

            <textarea
              rows={8}
              value={executePayload}
              onChange={e => setExecutePayload(e.target.value)}
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg p-3 font-mono text-xs text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeCurrentWorkflow}
                disabled={executing}
                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{executing ? 'Executing...' : 'Run DAG'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
