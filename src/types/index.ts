export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER';

export type NodeType =
  | 'START'
  | 'HTTP_REQUEST'
  | 'CONDITION'
  | 'DELAY'
  | 'TRANSFORM'
  | 'WEBHOOK'
  | 'LOG'
  | 'END';

export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'COMPENSATING'
  | 'COMPENSATED'
  | 'CANCELLED';

export type NodeExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'SKIPPED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  rateLimitPerMinute: number;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  retryOnStatuses?: number[];
}

export interface CompensationAction {
  enabled: boolean;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;
  simulatedAction?: string;
}

export interface WorkflowNodeData {
  [key: string]: any;
  label: string;
  description?: string;
  // HTTP
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  compensation?: CompensationAction;
  simulateFailure?: boolean; // Demo failure switch!
  // CONDITION
  conditionField?: string;
  conditionOperator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'exists';
  conditionValue?: string;
  // TRANSFORM
  transformScript?: string;
  // DELAY
  delayMs?: number;
  // LOG
  logMessage?: string;
  logLevel?: 'INFO' | 'WARN' | 'ERROR';
  // WEBHOOK
  webhookEndpoint?: string;
  webhookSecret?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false' | 'default' | null;
  targetHandle?: string | null;
  label?: string;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  nodeLabel: string;
  status: NodeExecutionStatus;
  input?: any;
  output?: any;
  attempts: number;
  maxAttempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs: string[];
  compensationStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  compensationError?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  tenantId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  currentNodeId?: string;
  error?: string;
  contextData: Record<string, any>;
  nodeExecutions: Record<string, WorkflowNodeExecution>;
  compensationsExecuted: string[];
  trigger: 'MANUAL' | 'API' | 'WEBHOOK' | 'SCHEDULE' | 'CHANGE_STREAM';
  triggeredBy: string;
}

export interface APIKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface DeadLetterJob {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  nodeId: string;
  nodeLabel: string;
  payload: any;
  attempts: number;
  error: string;
  status: 'UNRESOLVED' | 'RESOLVED' | 'DISCARDED';
  createdAt: string;
}

export interface WorkerInfo {
  id: string;
  name: string;
  status: 'IDLE' | 'BUSY' | 'OFFLINE';
  currentJobId?: string;
  currentExecutionId?: string;
  completedJobs: number;
  failedJobs: number;
  latencyMs: number;
  startedAt: string;
  lastHeartbeat: string;
}

export interface SystemStats {
  totalTenants: number;
  activeUsers: number;
  totalWorkflows: number;
  activeWorkflows: number;
  runningExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  compensatedExecutions: number;
  totalRetries: number;
  dlqCount: number;
  averageWorkerLatencyMs: number;
  workers: WorkerInfo[];
}

export interface WebSocketEventPayload {
  type:
    | 'EXECUTION_STARTED'
    | 'EXECUTION_STATUS_CHANGED'
    | 'NODE_STATUS_CHANGED'
    | 'RETRY_ATTEMPT'
    | 'COMPENSATION_TRIGGERED'
    | 'COMPENSATION_NODE_STATUS'
    | 'EXECUTION_COMPLETED'
    | 'DLQ_JOB_ADDED'
    | 'WORKER_HEARTBEAT';
  tenantId: string;
  executionId?: string;
  nodeId?: string;
  data: any;
  timestamp: string;
}
