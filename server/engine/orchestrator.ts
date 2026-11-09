import { randomUUID } from 'node:crypto';
import type {
  Workflow,
  WorkflowExecution,
  WorkflowNode,
  WorkflowNodeExecution,
} from '../../src/types/index.ts';
import { db } from '../db.ts';
import { wsManager } from '../websocket.ts';
import { workerPool } from './workerPool.ts';
import { executeSandboxedTransform } from './sandbox.ts';
import { isRetryableError, calculateBackoffDelay } from './retry.ts';
import { sagaCoordinator } from './saga.ts';

/* -------------------------------------------------------------------------- */
/*  Configuration (all overridable through environment variables)             */
/* -------------------------------------------------------------------------- */

const envInt = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Artificial per-node delay so the UI can animate progress (set 0 in prod). */
const STEP_DELAY_MS = envInt('WORKFLOW_STEP_DELAY_MS', 400);
/** Upper bound for retry backoff sleeps. */
const MAX_BACKOFF_MS = envInt('WORKFLOW_MAX_BACKOFF_MS', 2500);
/** Upper bound for DELAY nodes. */
const MAX_DELAY_NODE_MS = envInt('WORKFLOW_MAX_DELAY_NODE_MS', 5000);
/** How many independent branches of one execution may run in parallel. */
const MAX_CONCURRENCY = Math.max(1, envInt('WORKFLOW_MAX_CONCURRENCY', 5));
/** Set to "true" to allow HTTP nodes to call private / loopback addresses. */
const ALLOW_PRIVATE_HTTP = process.env.WORKFLOW_ALLOW_PRIVATE_HTTP === 'true';

const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type WorkflowEdge = Workflow['edges'][number];
type BroadcastMessage = Parameters<typeof wsManager.broadcast>[0];
type NodeLogger = (message: string) => void;

interface NodeResult {
  success: boolean;
  output?: any;
  error?: string;
}

interface NodeRun {
  node: WorkflowNode;
  result: NodeResult;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

const errorMessage = (err: unknown, fallback = 'Execution error'): string =>
  err instanceof Error && err.message ? err.message : typeof err === 'string' ? err : fallback;

const httpError = (message: string, status: number): Error & { status: number } => {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Sleep in small slices so a cancellation is noticed quickly. */
async function cancellableSleep(ms: number, isCancelled: () => boolean): Promise<void> {
  const slice = 200;
  let remaining = ms;
  while (remaining > 0 && !isCancelled()) {
    const step = Math.min(slice, remaining);
    await sleep(step);
    remaining -= step;
  }
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Resolve "a.b.c" against an object, refusing prototype-polluting keys. */
function getByPath(source: unknown, path: string): any {
  if (!path) return undefined;
  let current: any = source;
  for (const part of path.split('.')) {
    if (UNSAFE_KEYS.has(part)) return undefined;
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Replaces {{ path.to.value }} placeholders. Unresolved placeholders are left
 * untouched (same as the original behaviour).
 */
function interpolate(template: string, context: Record<string, any>, urlEncode = false): string {
  return template.replace(/\{\{\s*([\w$.-]+)\s*\}\}/g, (match, path: string) => {
    const value = getByPath(context, path);
    if (value === undefined || value === null) return match;
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return urlEncode ? encodeURIComponent(text) : text;
  });
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  if (host.includes(':')) {
    // IPv6 literal: loopback, unspecified, unique-local, link-local, mapped IPv4
    return (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:')
    );
  }

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return false;
}

function assertSafeHttpTarget(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw httpError(`Invalid URL: ${rawUrl}`, 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw httpError(`Unsupported URL protocol: ${url.protocol}`, 400);
  }
  if (!ALLOW_PRIVATE_HTTP && isPrivateHost(url.hostname)) {
    throw httpError('Requests to private or internal addresses are blocked', 403);
  }
  return url;
}

const isMockHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase();
  return h === 'example.com' || h.endsWith('.example.com') || h === 'test.api' || h.endsWith('.test.api');
};

/* -------------------------------------------------------------------------- */
/*  Engine                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Strict Finite State Machine (FSM) Transition Table (Task 4)
 */
export const VALID_EXECUTION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['SUCCESS', 'FAILED', 'CANCELLED', 'COMPENSATING'],
  COMPENSATING: ['COMPENSATED', 'FAILED'],
  SUCCESS: [],
  FAILED: [],
  CANCELLED: [],
  COMPENSATED: [],
};

export class WorkflowOrchestrationEngine {
  private activeExecutions = new Map<
    string,
    { cancelled: boolean; timeoutTimer?: ReturnType<typeof setTimeout> }
  >();

  /**
   * Deterministic State Machine Transition Guard
   */
  private transitionExecutionState(
    execution: WorkflowExecution,
    nextStatus: WorkflowExecution['status'],
    additionalFields: Partial<WorkflowExecution> = {}
  ): boolean {
    const currentStatus = execution.status;
    const allowed = VALID_EXECUTION_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(nextStatus)) {
      console.warn(`[STATE_MACHINE] Prevented illegal transition from '${currentStatus}' to '${nextStatus}' on execution ${execution.id}`);
      return false;
    }

    execution.status = nextStatus;
    Object.assign(execution, additionalFields);
    db.executions.update(execution.id, { status: nextStatus, ...additionalFields });
    return true;
  }

  /**
   * Starts asynchronous workflow execution.
   */
  public async startExecution(
    workflow: Workflow,
    inputPayload: Record<string, any> = {},
    triggeredBy: string = 'system',
    trigger: WorkflowExecution['trigger'] = 'MANUAL'
  ): Promise<WorkflowExecution> {
    // 1. Initialise node execution records
    const nodeExecutions: Record<string, WorkflowNodeExecution> = {};
    for (const node of workflow.nodes) {
      nodeExecutions[node.id] = {
        id: 'nexec_' + randomUUID().replace(/-/g, '').substring(0, 12),
        executionId: '',
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.data.label || node.id,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: node.data.retryPolicy?.maxAttempts || 1,
        logs: [],
      };
    }

    // 2. Create the execution record
    const execution = db.executions.create({
      workflowId: workflow.id,
      workflowName: workflow.name,
      tenantId: workflow.tenantId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      contextData: { ...inputPayload },
      nodeExecutions,
      compensationsExecuted: [],
      trigger,
      triggeredBy,
    });

    // Backfill executionId, and make sure the in-memory object we mutate later
    // is the very same object we persist.
    for (const key of Object.keys(nodeExecutions)) {
      nodeExecutions[key].executionId = execution.id;
    }
    execution.nodeExecutions = nodeExecutions;
    db.executions.update(execution.id, { nodeExecutions });

    this.activeExecutions.set(execution.id, { cancelled: false });

    // Global Workflow Execution Timeout Guard (Task 4: Deadlock Prevention)
    const MAX_WORKFLOW_TIMEOUT_MS = envInt('WORKFLOW_GLOBAL_TIMEOUT_MS', 120_000); // 2 minutes
    const timer = setTimeout(async () => {
      const current = await db.executions.findById(execution.id, workflow.tenantId);
      if (current && current.status === 'RUNNING') {
        console.warn(`[TIMEOUT] Execution ${execution.id} exceeded deadline of ${MAX_WORKFLOW_TIMEOUT_MS}ms. Aborting...`);
        await this.cancelExecution(execution.id, workflow.tenantId);
        this.failExecution(execution, `Workflow execution timed out after ${MAX_WORKFLOW_TIMEOUT_MS / 1000}s`);
      }
    }, MAX_WORKFLOW_TIMEOUT_MS);

    this.activeExecutions.set(execution.id, { cancelled: false, timeoutTimer: timer });
    
    // 3. Broadcast
    this.emit('EXECUTION_STARTED', execution, { execution });

    // 4. Run in the background; runWorkflowAsync handles its own errors.
    void this.runWorkflowAsync(workflow, execution).catch(err => {
      console.error(`Unhandled error in workflow execution ${execution.id}:`, err);
    });

    return execution;
  }

  public async cancelExecution(executionId: string, tenantId: string): Promise<boolean> {
    // Tenant check FIRST - never touch another tenant's execution handle.
    const execution = await db.executions.findById(executionId, tenantId);
    if (!execution || execution.completedAt) return false;

    const handle = this.activeExecutions.get(executionId);
    if (handle) handle.cancelled = true;

    const completedAt = new Date().toISOString();
    execution.status = 'CANCELLED';
    execution.completedAt = completedAt;
    db.executions.update(execution.id, { status: 'CANCELLED', completedAt });

    this.emit('EXECUTION_STATUS_CHANGED', execution, { status: 'CANCELLED' });
    return true;
  }

  /* ------------------------------ validation ------------------------------ */

  private validateWorkflow(workflow: Workflow): string | null {
    if (!workflow.nodes.some(n => n.type === 'START')) return 'Workflow lacks START node';

    const ids = new Set<string>();
    for (const node of workflow.nodes) {
      if (ids.has(node.id)) return `Duplicate node id '${node.id}'`;
      ids.add(node.id);
    }

    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
      indegree.set(id, 0);
      adjacency.set(id, []);
    }
    for (const edge of workflow.edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) {
        return `Edge references unknown node (${edge.source} -> ${edge.target})`;
      }
      indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
      adjacency.get(edge.source)!.push(edge.target);
    }

    // Kahn's algorithm - detect cycles (they would otherwise hang the run).
    const queue = Array.from(ids).filter(id => indegree.get(id) === 0);
    let visited = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      visited++;
      for (const next of adjacency.get(id) || []) {
        const remaining = (indegree.get(next) || 0) - 1;
        indegree.set(next, remaining);
        if (remaining === 0) queue.push(next);
      }
    }
    if (visited !== ids.size) return 'Workflow contains a cycle';

    return null;
  }

  /* ------------------------------ scheduling ------------------------------ */

  private async runWorkflowAsync(workflow: Workflow, execution: WorkflowExecution) {
    try {
      const problem = this.validateWorkflow(workflow);
      if (problem) {
        this.failExecution(execution, problem);
        return;
      }
      await this.runGraph(workflow, execution);
    } catch (err) {
      console.error(`[ORCHESTRATOR] Execution ${execution.id} crashed:`, err);
      this.failExecution(execution, `Orchestrator error: ${errorMessage(err)}`);
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  /**
   * Dead-path-elimination scheduler:
   *  - a node becomes runnable once ALL its incoming edges are resolved
   *  - it runs if at least one incoming edge is active, otherwise it is skipped
   *    and its outgoing edges are marked dead (so skips propagate correctly
   *    through joins / diamonds)
   *  - independent ready nodes run in parallel (bounded by MAX_CONCURRENCY)
   */
  private async runGraph(workflow: Workflow, execution: WorkflowExecution) {
    const startNode = workflow.nodes.find(n => n.type === 'START')!;
    const nodeById = new Map(workflow.nodes.map(n => [n.id, n] as const));

    const incoming = new Map<string, number[]>();
    const outgoing = new Map<string, number[]>();
    workflow.edges.forEach((edge, idx) => {
      (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)!).push(idx);
      (incoming.get(edge.target) ?? incoming.set(edge.target, []).get(edge.target)!).push(idx);
    });

    const edgeState = new Map<number, 'active' | 'dead'>();
    const scheduled = new Set<string>([startNode.id]); // queued, run, or skipped
    const ready: string[] = [startNode.id];
    const running = new Map<string, Promise<NodeRun>>();
    let failure: { node: WorkflowNode; error: string } | null = null;

    const isCancelled = () => this.isCancelled(execution.id);
    const stopped = () => failure !== null || isCancelled();

    /** Resolve the outgoing edges of a finished/skipped node and cascade. */
    const settle = (nodeId: string, isActive: (edge: WorkflowEdge) => boolean) => {
      const stack: Array<[string, (edge: WorkflowEdge) => boolean]> = [[nodeId, isActive]];
      while (stack.length > 0) {
        const [id, predicate] = stack.pop()!;
        for (const idx of outgoing.get(id) ?? []) {
          const edge = workflow.edges[idx];
          edgeState.set(idx, predicate(edge) ? 'active' : 'dead');

          const targetId = edge.target;
          if (scheduled.has(targetId)) continue;

          const targetIncoming = incoming.get(targetId) ?? [];
          if (!targetIncoming.every(i => edgeState.has(i))) continue; // still waiting

          scheduled.add(targetId);
          if (targetIncoming.some(i => edgeState.get(i) === 'active')) {
            ready.push(targetId);
          } else {
            const target = nodeById.get(targetId);
            if (target) this.markNodeSkipped(execution, target);
            stack.push([targetId, () => false]);
          }
        }
      }
    };

    while (true) {
      // Launch as many ready nodes as concurrency allows
      while (!stopped() && ready.length > 0 && running.size < MAX_CONCURRENCY) {
        const nodeId = ready.shift()!;
        const node = nodeById.get(nodeId);
        if (!node) continue;

        execution.currentNodeId = nodeId;
        db.executions.update(execution.id, { currentNodeId: nodeId });
        running.set(nodeId, this.runNode(workflow, execution, node));
      }

      if (running.size === 0) break;

      const finished = await Promise.race(running.values());
      running.delete(finished.node.id);

      if (!finished.result.success) {
        failure ??= {
          node: finished.node,
          error: finished.result.error || 'Node execution failed',
        };
        continue; // let in-flight nodes settle, launch nothing new
      }

      if (stopped()) continue;

      const { node, result } = finished;
      if (node.type === 'CONDITION') {
        const outcome = Boolean(result.output?.conditionPassed);
        const matches = (e: WorkflowEdge, want: 'true' | 'false') =>
          e.sourceHandle === want || String(e.label ?? '').toLowerCase() === want;
        settle(node.id, edge => {
          const isBranch = matches(edge, 'true') || matches(edge, 'false');
          // Unlabelled edges act as an always-on default branch.
          return !isBranch || matches(edge, outcome ? 'true' : 'false');
        });
      } else {
        settle(node.id, () => true);
      }
    }

    // ---- Finalisation ----
    if (isCancelled()) return; // cancelExecution already persisted the status

    if (failure) {
      await this.handleNodeFailure(workflow, execution, failure.node, failure.error);
      return;
    }

    // Anything never reached (orphan nodes) is reported as skipped.
    for (const node of workflow.nodes) {
      if (execution.nodeExecutions[node.id]?.status === 'PENDING') {
        this.markNodeSkipped(execution, node, 'Node was unreachable from the START node.');
      }
    }

    execution.status = 'SUCCESS';
    execution.completedAt = new Date().toISOString();
    db.executions.update(execution.id, {
      status: 'SUCCESS',
      completedAt: execution.completedAt,
      nodeExecutions: execution.nodeExecutions,
    });
    this.emit('EXECUTION_COMPLETED', execution, { status: 'SUCCESS', execution });
  }

  private isCancelled(executionId: string): boolean {
    return this.activeExecutions.get(executionId)?.cancelled === true;
  }

  /** Never rejects: converts any thrown error into a failed NodeRun. */
  private async runNode(
    workflow: Workflow,
    execution: WorkflowExecution,
    node: WorkflowNode
  ): Promise<NodeRun> {
    try {
      const result = await this.executeNodeWithRetries(workflow, execution, node);
      return { node, result };
    } catch (err) {
      return { node, result: { success: false, error: errorMessage(err) } };
    }
  }

  private markNodeSkipped(
    execution: WorkflowExecution,
    node: WorkflowNode,
    reason = 'Node skipped because prior conditional branch did not execute.'
  ) {
    const nodeExec = execution.nodeExecutions[node.id];
    if (!nodeExec || nodeExec.status === 'SKIPPED') return;

    nodeExec.status = 'SKIPPED';
    nodeExec.logs.push(reason);
    this.persistNodes(execution);
    this.emit('NODE_STATUS_CHANGED', execution, { status: 'SKIPPED' }, node.id);
  }

  /* ------------------------------ node running ---------------------------- */

  private async executeNodeWithRetries(
    workflow: Workflow,
    execution: WorkflowExecution,
    node: WorkflowNode
  ): Promise<NodeResult> {
    const nodeExec = execution.nodeExecutions[node.id];
    const retryPolicy = node.data.retryPolicy || {
      maxAttempts: 1,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
    };
    const maxAttempts = Math.max(1, retryPolicy.maxAttempts || 1);
    const isCancelled = () => this.isCancelled(execution.id);

    let attempt = 0;
    let lastError = 'Unknown error';
    let lastDuration = 0;

    const worker = workerPool.getAvailableWorker();
    const workerId = worker ? worker.id : 'worker-local';
    if (worker) {
      workerPool.assignJob(worker.id, nodeExec.id, execution.id);
    }

    let succeeded = false;
    const overallStart = Date.now();

    try {
      while (attempt < maxAttempts) {
        if (isCancelled()) {
          lastError = 'Execution cancelled';
          break;
        }

        attempt++;
        nodeExec.attempts = attempt;
        nodeExec.status = attempt > 1 ? 'RETRYING' : 'RUNNING';
        nodeExec.startedAt = nodeExec.startedAt || new Date().toISOString();

        if (attempt > 1) {
          nodeExec.logs.push(`[RETRY] Attempt ${attempt} of ${maxAttempts}...`);
          this.emit(
            'RETRY_ATTEMPT',
            execution,
            { attempt, maxAttempts, status: 'RETRYING' },
            node.id
          );
        } else {
          nodeExec.logs.push(
            `[EXEC] Executing node: ${node.data.label || node.id} (Worker: ${worker?.name || workerId})`
          );
          this.emit('NODE_STATUS_CHANGED', execution, { status: 'RUNNING', workerId }, node.id);
        }
        this.persistNodes(execution);

        const attemptStart = Date.now();
        try {
          const stepOutput = await this.executeSingleNode(node, execution.contextData, msg =>
            nodeExec.logs.push(msg)
          );

          lastDuration = Date.now() - attemptStart;
          nodeExec.status = 'SUCCESS';
          nodeExec.output = stepOutput;
          nodeExec.error = undefined;
          nodeExec.completedAt = new Date().toISOString();
          nodeExec.logs.push(`[SUCCESS] Completed successfully in ${lastDuration}ms.`);

          execution.contextData = this.mergeIntoContext(execution.contextData, node.id, stepOutput);

          db.executions.update(execution.id, {
            nodeExecutions: execution.nodeExecutions,
            contextData: execution.contextData,
          });
          this.emit(
            'NODE_STATUS_CHANGED',
            execution,
            { status: 'SUCCESS', output: stepOutput },
            node.id
          );

          succeeded = true;
          return { success: true, output: stepOutput };
        } catch (err: any) {
          lastDuration = Date.now() - attemptStart;
          lastError = errorMessage(err);
          nodeExec.error = lastError;
          nodeExec.logs.push(`[ERROR] Attempt ${attempt} failed: ${lastError}`);

          const retryable = Boolean(isRetryableError(err, retryPolicy) || node.data.simulateFailure);
          if (attempt >= maxAttempts || !retryable) break;

          const delay = calculateBackoffDelay(attempt + 1, retryPolicy);
          nodeExec.logs.push(`[BACKOFF] Waiting ${delay}ms before retry ${attempt + 1}...`);
          this.persistNodes(execution);

          await cancellableSleep(Math.min(delay, MAX_BACKOFF_MS), isCancelled);
        }
      }

      // All attempts exhausted (or cancelled / non-retryable)
      nodeExec.status = 'FAILED';
      nodeExec.completedAt = new Date().toISOString();
      nodeExec.error = lastError;
      nodeExec.logs.push(`[FAILED] Node permanently failed after ${attempt} attempt(s).`);
      this.persistNodes(execution);
      this.emit('NODE_STATUS_CHANGED', execution, { status: 'FAILED', error: lastError }, node.id);

      return { success: false, error: lastError };
    } finally {
      // Always give the worker back, even if persistence/broadcast threw.
      if (worker) {
        workerPool.releaseJob(
          worker.id,
          succeeded,
          succeeded ? lastDuration : Date.now() - overallStart
        );
      }
    }
  }

  private mergeIntoContext(
    context: Record<string, any>,
    nodeId: string,
    output: unknown
  ): Record<string, any> {
    if (output === undefined) return context;
    const next: Record<string, any> = { ...context, [nodeId]: output };
    if (isPlainObject(output)) {
      for (const [key, value] of Object.entries(output)) {
        if (!UNSAFE_KEYS.has(key)) next[key] = value;
      }
    }
    return next;
  }

  private async executeSingleNode(
    node: WorkflowNode,
    contextData: Record<string, any>,
    log: NodeLogger
  ): Promise<any> {
    // Artificial small delay for visual feedback in UI
    if (STEP_DELAY_MS > 0) await sleep(STEP_DELAY_MS);

    // DEMO FAILURE TRIGGER
    if (node.data.simulateFailure) {
      throw httpError(`Simulated Failure Triggered on '${node.data.label}' (status: 500)`, 500);
    }

    switch (node.type) {
      case 'START':
        return { startedAt: new Date().toISOString(), initialPayload: contextData };

      case 'HTTP_REQUEST':
        return this.executeHttpRequest(node, contextData);

      case 'CONDITION':
        return this.evaluateCondition(node, contextData);

      case 'TRANSFORM': {
        const script = node.data.transformScript || 'return input;';
        const result = executeSandboxedTransform(script, contextData, 2000);
        if (!result.success) {
          throw new Error(`Transform Sandbox Error: ${result.error}`);
        }
        return result.output;
      }

      case 'DELAY': {
        const delay = Math.min(Math.max(Number(node.data.delayMs) || 1000, 0), MAX_DELAY_NODE_MS);
        await sleep(delay);
        return { delayedMs: delay };
      }

      case 'LOG': {
        const message = interpolate(node.data.logMessage || 'Execution checkpoint', contextData);
        log(`[LOG] ${message}`);
        return { logged: message, timestamp: new Date().toISOString() };
      }

      case 'WEBHOOK':
        return { webhookReceived: true, payload: contextData };

      case 'END':
        return { finishedAt: new Date().toISOString(), status: 'SUCCESS' };

      default:
        return { executed: true };
    }
  }

  private evaluateCondition(node: WorkflowNode, contextData: Record<string, any>) {
    const { conditionField, conditionOperator = '==', conditionValue } = node.data;
    if (!conditionField) {
      return { conditionPassed: true };
    }

    // Resolve from context (supports dot paths), falling back to context.data
    let actualValue = getByPath(contextData, conditionField);
    if (actualValue === undefined) actualValue = getByPath(contextData?.data, conditionField);

    const target: any = conditionValue;
    const numeric = (fn: (a: number, b: number) => boolean): boolean => {
      const a = Number(actualValue);
      const b = Number(target);
      return !Number.isNaN(a) && !Number.isNaN(b) && fn(a, b);
    };

    let passed: boolean;
    switch (conditionOperator) {
      case '==':
        passed = String(actualValue) === String(target);
        break;
      case '!=':
        passed = String(actualValue) !== String(target);
        break;
      case '>':
        passed = numeric((a, b) => a > b);
        break;
      case '<':
        passed = numeric((a, b) => a < b);
        break;
      case '>=':
        passed = numeric((a, b) => a >= b);
        break;
      case '<=':
        passed = numeric((a, b) => a <= b);
        break;
      case 'contains':
        passed = String(actualValue).toLowerCase().includes(String(target).toLowerCase());
        break;
      case 'exists':
        passed = actualValue !== undefined && actualValue !== null && actualValue !== '';
        break;
      default:
        throw httpError(`Unsupported condition operator '${String(conditionOperator)}'`, 400);
    }

    return {
      conditionField,
      actualValue,
      operator: conditionOperator,
      targetVal: target,
      conditionPassed: passed,
    };
  }

  private async executeHttpRequest(node: WorkflowNode, contextData: Record<string, any>) {
    const { method = 'GET', url, headers = {}, body, timeoutMs = 8000 } = node.data as any;
    if (!url) throw httpError('Missing URL for HTTP Request', 400);

    const upperMethod = String(method).toUpperCase();
    const interpolatedUrl = interpolate(String(url), contextData, true);

    let interpolatedBody: string | undefined;
    if (body !== undefined && body !== null && body !== '') {
      interpolatedBody =
        typeof body === 'string' ? interpolate(body, contextData) : JSON.stringify(body);
    }

    let currentHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      currentHeaders[key] = typeof value === 'string' ? interpolate(value, contextData) : String(value);
    }

    // Demo fallback for mock domains / unroutable example URLs
    const initial = assertSafeHttpTarget(interpolatedUrl);
    if (isMockHost(initial.hostname)) {
      return {
        status: 200,
        statusText: 'OK (Mocked Distributed Service)',
        endpoint: interpolatedUrl,
        method: upperMethod,
        data: {
          success: true,
          timestamp: new Date().toISOString(),
          resourceId: 'res_' + randomUUID().replace(/-/g, '').substring(0, 6),
          processed: true,
          echo: contextData,
        },
      };
    }

    let currentUrl = interpolatedUrl;
    let currentMethod = upperMethod;
    let currentBody = interpolatedBody;

    // Redirects are followed manually so every hop is re-validated (SSRF guard).
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = assertSafeHttpTarget(currentUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(target.toString(), {
          method: currentMethod,
          headers: currentHeaders,
          body: BODY_METHODS.has(currentMethod) ? currentBody : undefined,
          signal: controller.signal,
          redirect: 'manual',
        });

        if (REDIRECT_STATUSES.has(resp.status)) {
          const location = resp.headers.get('location');
          if (!location) throw httpError(`Redirect ${resp.status} without Location header`, resp.status);
          if (hop === MAX_REDIRECTS) throw httpError('Too many redirects', 310);

          const nextUrl = new URL(location, target);
          if (nextUrl.origin !== target.origin) {
            // Never leak credentials across origins
            currentHeaders = Object.fromEntries(
              Object.entries(currentHeaders).filter(
                ([k]) => !['authorization', 'cookie', 'proxy-authorization'].includes(k.toLowerCase())
              )
            );
          }
          if (resp.status === 303 || ((resp.status === 301 || resp.status === 302) && currentMethod === 'POST')) {
            currentMethod = 'GET';
            currentBody = undefined;
          }
          currentUrl = nextUrl.toString();
          continue;
        }

        const contentType = resp.headers.get('content-type') || '';
        const respData: any = contentType.includes('application/json')
          ? await resp.json()
          : await resp.text();

        if (!resp.ok) {
          const err: any = httpError(`HTTP Error ${resp.status}: ${resp.statusText}`, resp.status);
          err.data = respData;
          throw err;
        }

        return { status: resp.status, data: respData };
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          throw httpError(`Request timed out after ${timeoutMs}ms`, 408);
        }
        throw fetchErr;
      } finally {
        clearTimeout(timer); // also covers the body-read phase
      }
    }

    throw httpError('Too many redirects', 310);
  }

  /* ------------------------------ failure path ---------------------------- */

  private async handleNodeFailure(
    workflow: Workflow,
    execution: WorkflowExecution,
    failedNode: WorkflowNode,
    reason: string = 'Node execution failed'
  ) {
    console.log(
      `[ORCHESTRATOR] Node '${failedNode.data.label}' failed. Enqueuing to DLQ and starting SAGA rollback...`
    );

    // 1. Dead Letter Queue
    try {
      const dlqJob = db.dlq.create({
        tenantId: execution.tenantId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        executionId: execution.id,
        nodeId: failedNode.id,
        nodeLabel: failedNode.data.label || failedNode.id,
        payload: execution.contextData,
        attempts: execution.nodeExecutions[failedNode.id]?.attempts || 1,
        error: reason,
        status: 'UNRESOLVED',
      });

      this.safeBroadcast({
        type: 'DLQ_JOB_ADDED',
        tenantId: execution.tenantId,
        data: dlqJob,
        timestamp: new Date().toISOString(),
      } as BroadcastMessage);
    } catch (err) {
      console.error(`[ORCHESTRATOR] Failed to enqueue DLQ job for ${execution.id}:`, err);
    }

    // 2. Saga compensation - must never leave the execution stuck in RUNNING
    try {
      await sagaCoordinator.executeCompensations(execution, workflow, reason);
    } catch (err) {
      console.error(`[ORCHESTRATOR] Saga compensation failed for ${execution.id}:`, err);
      reason = `${reason} (compensation error: ${errorMessage(err)})`;
    } finally {
      const latest = await db.executions.findById(execution.id, execution.tenantId);
      const status = latest ? latest.status : execution.status;
      if (status === 'RUNNING') {
        this.failExecution(execution, reason);
      }
    }
  }

  private failExecution(execution: WorkflowExecution, reason: string) {
    if (this.isCancelled(execution.id)) return; // don't overwrite CANCELLED

    execution.status = 'FAILED';
    execution.completedAt = new Date().toISOString();
    execution.error = reason;
    db.executions.update(execution.id, {
      status: 'FAILED',
      completedAt: execution.completedAt,
      error: reason,
    });

    this.emit('EXECUTION_STATUS_CHANGED', execution, { status: 'FAILED', error: reason });
  }

  /* ------------------------------ utilities ------------------------------- */

  private persistNodes(execution: WorkflowExecution) {
    db.executions.update(execution.id, { nodeExecutions: execution.nodeExecutions });
  }

  private emit(
    type: BroadcastMessage['type'],
    execution: WorkflowExecution,
    data: unknown,
    nodeId?: string
  ) {
    this.safeBroadcast({
      type,
      tenantId: execution.tenantId,
      executionId: execution.id,
      ...(nodeId ? { nodeId } : {}),
      data,
      timestamp: new Date().toISOString(),
    } as BroadcastMessage);
  }

  /** A broken websocket must never fail a workflow. */
  private safeBroadcast(message: BroadcastMessage) {
    try {
      wsManager.broadcast(message);
    } catch (err) {
      console.error('[ORCHESTRATOR] Broadcast failed:', err);
    }
  }
}

export const workflowEngine = new WorkflowOrchestrationEngine();