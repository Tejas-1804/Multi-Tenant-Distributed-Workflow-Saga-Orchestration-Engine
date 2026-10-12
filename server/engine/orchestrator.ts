import {
  Workflow,
  WorkflowExecution,
  WorkflowNode,
  WorkflowNodeExecution,
  NodeType,
} from '../../src/types/index.ts';
import { db } from '../db.ts';
import { wsManager } from '../websocket.ts';
import { workerPool } from './workerPool.ts';
import { executeSandboxedTransform } from './sandbox.ts';
import { isRetryableError, calculateBackoffDelay } from './retry.ts';
import { sagaCoordinator } from './saga.ts';

export class WorkflowOrchestrationEngine {
  private activeExecutions = new Map<string, { cancelled: boolean }>();

  /**
   * Starts asynchronous workflow execution
   */
  public async startExecution(
    workflow: Workflow,
    inputPayload: Record<string, any> = {},
    triggeredBy: string = 'system',
    trigger: WorkflowExecution['trigger'] = 'MANUAL'
  ): Promise<WorkflowExecution> {
    // 1. Initialize node executions record
    const nodeExecutions: Record<string, WorkflowNodeExecution> = {};
    for (const node of workflow.nodes) {
      nodeExecutions[node.id] = {
        id: 'nexec_' + Math.random().toString(36).substring(2, 10),
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

    // 2. Create Execution Record in DB
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

    // Backfill executionId in nodeExecutions
    for (const key of Object.keys(nodeExecutions)) {
      nodeExecutions[key].executionId = execution.id;
    }
    db.executions.update(execution.id, { nodeExecutions });

    this.activeExecutions.set(execution.id, { cancelled: false });

    // 3. Broadcast execution started
    wsManager.broadcast({
      type: 'EXECUTION_STARTED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      data: { execution },
      timestamp: new Date().toISOString(),
    });

    // 4. Run execution asynchronously in background worker
    this.runWorkflowAsync(workflow, execution).catch(err => {
      console.error(`Unhandled error in workflow execution ${execution.id}:`, err);
    });

    return execution;
  }

  public cancelExecution(executionId: string, tenantId: string): boolean {
    const handle = this.activeExecutions.get(executionId);
    if (handle) {
      handle.cancelled = true;
    }
    const execution = db.executions.findById(executionId, tenantId);
    if (!execution || execution.completedAt) return false;

    execution.status = 'CANCELLED';
    execution.completedAt = new Date().toISOString();
    db.executions.update(execution.id, {
      status: 'CANCELLED',
      completedAt: execution.completedAt,
    });

    wsManager.broadcast({
      type: 'EXECUTION_STATUS_CHANGED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      data: { status: 'CANCELLED' },
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  private async runWorkflowAsync(workflow: Workflow, execution: WorkflowExecution) {
    const startNode = workflow.nodes.find(n => n.type === 'START');
    if (!startNode) {
      this.failExecution(execution, 'Workflow lacks START node', workflow);
      return;
    }

    // Queue of nodes ready to be processed
    const readyQueue: string[] = [startNode.id];
    const completedNodeIds = new Set<string>();
    const skippedNodeIds = new Set<string>();

    while (readyQueue.length > 0) {
      const handle = this.activeExecutions.get(execution.id);
      if (handle?.cancelled) {
        return;
      }

      const currentNodeId = readyQueue.shift()!;
      const currentNode = workflow.nodes.find(n => n.id === currentNodeId);
      if (!currentNode) continue;

      if (skippedNodeIds.has(currentNodeId)) {
        continue;
      }

      // Check if all non-skipped incoming dependencies are completed
      const incomingEdges = workflow.edges.filter(e => e.target === currentNodeId);
      const dependenciesMet = incomingEdges.every(e => {
        return completedNodeIds.has(e.source) || skippedNodeIds.has(e.source);
      });

      if (!dependenciesMet) {
        // Re-queue until dependencies finish
        readyQueue.push(currentNodeId);
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      // If all incoming edges came from skipped paths, skip this node too
      const activeIncomingEdges = incomingEdges.filter(e => completedNodeIds.has(e.source));
      if (incomingEdges.length > 0 && activeIncomingEdges.length === 0) {
        this.markNodeSkipped(execution, currentNode);
        skippedNodeIds.add(currentNodeId);
        continue;
      }

      // Update current node in execution
      execution.currentNodeId = currentNodeId;
      db.executions.update(execution.id, { currentNodeId });

      // Execute this node
      const nodeResult = await this.executeNodeWithRetries(workflow, execution, currentNode);

      if (!nodeResult.success) {
        // Node failed permanently after all retries!
        await this.handleNodeFailure(workflow, execution, currentNode, nodeResult.error);
        return;
      }

      completedNodeIds.add(currentNodeId);

      // Determine next nodes
      if (currentNode.type === 'END') {
        // Complete execution
        execution.status = 'SUCCESS';
        execution.completedAt = new Date().toISOString();
        db.executions.update(execution.id, {
          status: 'SUCCESS',
          completedAt: execution.completedAt,
        });

        wsManager.broadcast({
          type: 'EXECUTION_COMPLETED',
          tenantId: execution.tenantId,
          executionId: execution.id,
          data: { status: 'SUCCESS', execution },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Branching resolution
      const outgoingEdges = workflow.edges.filter(e => e.source === currentNodeId);

      if (currentNode.type === 'CONDITION') {
        const conditionOutcome = Boolean(nodeResult.output?.conditionPassed);
        const selectedEdge = outgoingEdges.find(e => 
          conditionOutcome 
            ? (e.sourceHandle === 'true' || e.label?.toLowerCase() === 'true')
            : (e.sourceHandle === 'false' || e.label?.toLowerCase() === 'false')
        );
        const rejectedEdge = outgoingEdges.find(e => e !== selectedEdge);

        if (selectedEdge && !readyQueue.includes(selectedEdge.target)) {
          readyQueue.push(selectedEdge.target);
        }

        if (rejectedEdge) {
          this.markSubtreeSkipped(workflow, rejectedEdge.target, skippedNodeIds, execution);
        }
      } else {
        // Sequential / fan-out
        for (const edge of outgoingEdges) {
          if (!readyQueue.includes(edge.target) && !skippedNodeIds.has(edge.target)) {
            readyQueue.push(edge.target);
          }
        }
      }
    }

    // If loop finished and status is still RUNNING
    if (execution.status === 'RUNNING') {
      execution.status = 'SUCCESS';
      execution.completedAt = new Date().toISOString();
      db.executions.update(execution.id, { status: 'SUCCESS', completedAt: execution.completedAt });
    }
  }

  private markNodeSkipped(execution: WorkflowExecution, node: WorkflowNode) {
    const nodeExec = execution.nodeExecutions[node.id];
    if (nodeExec) {
      nodeExec.status = 'SKIPPED';
      nodeExec.logs.push('Node skipped because prior conditional branch did not execute.');
      db.executions.update(execution.id, { nodeExecutions: execution.nodeExecutions });

      wsManager.broadcast({
        type: 'NODE_STATUS_CHANGED',
        tenantId: execution.tenantId,
        executionId: execution.id,
        nodeId: node.id,
        data: { status: 'SKIPPED' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private markSubtreeSkipped(
    workflow: Workflow,
    startNodeId: string,
    skippedSet: Set<string>,
    execution: WorkflowExecution
  ) {
    const queue = [startNodeId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (skippedSet.has(id)) continue;
      skippedSet.add(id);

      const node = workflow.nodes.find(n => n.id === id);
      if (node && node.type !== 'END') {
        this.markNodeSkipped(execution, node);
        const out = workflow.edges.filter(e => e.source === id);
        for (const edge of out) {
          queue.push(edge.target);
        }
      }
    }
  }

  private async executeNodeWithRetries(
    workflow: Workflow,
    execution: WorkflowExecution,
    node: WorkflowNode
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    const nodeExec = execution.nodeExecutions[node.id];
    const retryPolicy = node.data.retryPolicy || {
      maxAttempts: 1,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
    };
    const maxAttempts = retryPolicy.maxAttempts || 1;

    let attempt = 0;
    let lastError = 'Unknown error';

    // Assign worker from distributed pool
    const worker = workerPool.getAvailableWorker();
    const workerId = worker ? worker.id : 'worker-local';
    if (worker) {
      workerPool.assignJob(worker.id, nodeExec.id, execution.id);
    }

    const startTime = Date.now();

    while (attempt < maxAttempts) {
      attempt++;
      nodeExec.attempts = attempt;
      nodeExec.status = attempt > 1 ? 'RETRYING' : 'RUNNING';
      nodeExec.startedAt = nodeExec.startedAt || new Date().toISOString();

      if (attempt > 1) {
        nodeExec.logs.push(`[RETRY] Attempt ${attempt} of ${maxAttempts}...`);
        wsManager.broadcast({
          type: 'RETRY_ATTEMPT',
          tenantId: execution.tenantId,
          executionId: execution.id,
          nodeId: node.id,
          data: {
            attempt,
            maxAttempts,
            status: 'RETRYING',
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        nodeExec.logs.push(`[EXEC] Executing node: ${node.data.label || node.id} (Worker: ${worker?.name || workerId})`);
        wsManager.broadcast({
          type: 'NODE_STATUS_CHANGED',
          tenantId: execution.tenantId,
          executionId: execution.id,
          nodeId: node.id,
          data: { status: 'RUNNING', workerId },
          timestamp: new Date().toISOString(),
        });
      }

      db.executions.update(execution.id, { nodeExecutions: execution.nodeExecutions });

      try {
        const stepOutput = await this.executeSingleNode(node, execution.contextData);

        // Success!
        const duration = Date.now() - startTime;
        nodeExec.status = 'SUCCESS';
        nodeExec.output = stepOutput;
        nodeExec.completedAt = new Date().toISOString();
        nodeExec.logs.push(`[SUCCESS] Completed successfully in ${duration}ms.`);

        // Merge output into contextData
        if (typeof stepOutput === 'object' && stepOutput !== null) {
          execution.contextData = {
            ...execution.contextData,
            [node.id]: stepOutput,
            ...stepOutput,
          };
        }

        db.executions.update(execution.id, {
          nodeExecutions: execution.nodeExecutions,
          contextData: execution.contextData,
        });

        wsManager.broadcast({
          type: 'NODE_STATUS_CHANGED',
          tenantId: execution.tenantId,
          executionId: execution.id,
          nodeId: node.id,
          data: { status: 'SUCCESS', output: stepOutput },
          timestamp: new Date().toISOString(),
        });

        if (worker) {
          workerPool.releaseJob(worker.id, true, duration);
        }

        return { success: true, output: stepOutput };
      } catch (err: any) {
        lastError = err.message || 'Execution error';
        nodeExec.error = lastError;
        nodeExec.logs.push(`[ERROR] Attempt ${attempt} failed: ${lastError}`);

        const duration = Date.now() - startTime;

        const isRetryable = isRetryableError(err, retryPolicy) || node.data.simulateFailure;

        if (attempt < maxAttempts && isRetryable) {
          const delay = calculateBackoffDelay(attempt + 1, retryPolicy);
          nodeExec.logs.push(`[BACKOFF] Waiting ${delay}ms before retry ${attempt + 1}...`);
          db.executions.update(execution.id, { nodeExecutions: execution.nodeExecutions });

          // Sleep exponential backoff delay (capped for responsive UI demo: min(delay, 2500ms))
          const actualDelay = Math.min(delay, 2500);
          await new Promise(r => setTimeout(r, actualDelay));
        } else {
          // No more retries or non-retryable
          break;
        }
      }
    }

    // If we reach here, node failed all attempts
    const totalDuration = Date.now() - startTime;
    nodeExec.status = 'FAILED';
    nodeExec.completedAt = new Date().toISOString();
    nodeExec.error = lastError;
    nodeExec.logs.push(`[FAILED] Node permanently failed after ${attempt} attempts.`);

    db.executions.update(execution.id, { nodeExecutions: execution.nodeExecutions });

    wsManager.broadcast({
      type: 'NODE_STATUS_CHANGED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      nodeId: node.id,
      data: { status: 'FAILED', error: lastError },
      timestamp: new Date().toISOString(),
    });

    if (worker) {
      workerPool.releaseJob(worker.id, false, totalDuration);
    }

    return { success: false, error: lastError };
  }

  private async executeSingleNode(node: WorkflowNode, contextData: any): Promise<any> {
    // Artificial small delay for visual feedback in UI
    await new Promise(r => setTimeout(r, 400));

    // DEMO FAILURE TRIGGER
    if (node.data.simulateFailure) {
      const err: any = new Error(`Simulated Failure Triggered on '${node.data.label}' (status: 500)`);
      err.status = 500;
      throw err;
    }

    switch (node.type) {
      case 'START': {
        return { startedAt: new Date().toISOString(), initialPayload: contextData };
      }

      case 'HTTP_REQUEST': {
        const { method = 'GET', url, headers = {}, body, timeoutMs = 8000 } = node.data;
        if (!url) throw new Error('Missing URL for HTTP Request');

        // Interpolate context variables in URL and body, e.g. {{orderId}}
        let interpolatedUrl = url;
        let interpolatedBody = body;
        for (const [k, v] of Object.entries(contextData)) {
          if (typeof v === 'string' || typeof v === 'number') {
            interpolatedUrl = interpolatedUrl.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            if (interpolatedBody) {
              interpolatedBody = interpolatedBody.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            }
          }
        }

        // Demo fallback for mock domains or unroutable example URLs
        if (interpolatedUrl.includes('example.com') || interpolatedUrl.includes('test.api')) {
          // Provide realistic enterprise mock output for demo testing
          return {
            status: 200,
            statusText: 'OK (Mocked Distributed Service)',
            endpoint: interpolatedUrl,
            method,
            data: {
              success: true,
              timestamp: new Date().toISOString(),
              resourceId: 'res_' + Math.random().toString(36).substring(2, 8),
              processed: true,
              echo: contextData,
            },
          };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const resp = await fetch(interpolatedUrl, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: ['POST', 'PUT', 'PATCH'].includes(method) ? interpolatedBody : undefined,
            signal: controller.signal,
          });

          clearTimeout(timer);

          let respData: any = null;
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            respData = await resp.json();
          } else {
            respData = await resp.text();
          }

          if (!resp.ok) {
            const err: any = new Error(`HTTP Error ${resp.status}: ${resp.statusText}`);
            err.status = resp.status;
            err.data = respData;
            throw err;
          }

          return {
            status: resp.status,
            data: respData,
          };
        } catch (fetchErr: any) {
          clearTimeout(timer);
          if (fetchErr.name === 'AbortError') {
            const err: any = new Error(`Request timed out after ${timeoutMs}ms`);
            err.status = 408;
            throw err;
          }
          throw fetchErr;
        }
      }

      case 'CONDITION': {
        const { conditionField, conditionOperator = '==', conditionValue } = node.data;
        if (!conditionField) {
          return { conditionPassed: true };
        }

        // Resolve value from context
        const actualValue = contextData[conditionField] !== undefined
          ? contextData[conditionField]
          : contextData?.data?.[conditionField];

        let passed = false;
        const targetVal = conditionValue;

        switch (conditionOperator) {
          case '==':
            passed = String(actualValue) === String(targetVal);
            break;
          case '!=':
            passed = String(actualValue) !== String(targetVal);
            break;
          case '>':
            passed = Number(actualValue) > Number(targetVal);
            break;
          case '<':
            passed = Number(actualValue) < Number(targetVal);
            break;
          case '>=':
            passed = Number(actualValue) >= Number(targetVal);
            break;
          case '<=':
            passed = Number(actualValue) <= Number(targetVal);
            break;
          case 'contains':
            passed = String(actualValue).toLowerCase().includes(String(targetVal).toLowerCase());
            break;
          case 'exists':
            passed = actualValue !== undefined && actualValue !== null && actualValue !== '';
            break;
        }

        return {
          conditionField,
          actualValue,
          operator: conditionOperator,
          targetVal,
          conditionPassed: passed,
        };
      }

      case 'TRANSFORM': {
        const script = node.data.transformScript || 'return input;';
        const result = executeSandboxedTransform(script, contextData, 2000);
        if (!result.success) {
          throw new Error(`Transform Sandbox Error: ${result.error}`);
        }
        return result.output;
      }

      case 'DELAY': {
        const delay = Math.min(node.data.delayMs || 1000, 5000); // capped at 5s for demo responsiveness
        await new Promise(r => setTimeout(r, delay));
        return { delayedMs: delay };
      }

      case 'LOG': {
        const msg = node.data.logMessage || 'Execution checkpoint';
        return { logged: msg, timestamp: new Date().toISOString() };
      }

      case 'WEBHOOK': {
        return { webhookReceived: true, payload: contextData };
      }

      case 'END': {
        return { finishedAt: new Date().toISOString(), status: 'SUCCESS' };
      }

      default:
        return { executed: true };
    }
  }

  private async handleNodeFailure(
    workflow: Workflow,
    execution: WorkflowExecution,
    failedNode: WorkflowNode,
    errorMessage: string = 'Node execution failed'
  ) {
    console.log(`[ORCHESTRATOR] Node '${failedNode.data.label}' failed. Enqueuing to DLQ and starting SAGA rollback...`);

    // 1. Move to Dead Letter Queue (DLQ)
    const dlqJob = db.dlq.create({
      tenantId: execution.tenantId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      executionId: execution.id,
      nodeId: failedNode.id,
      nodeLabel: failedNode.data.label || failedNode.id,
      payload: execution.contextData,
      attempts: execution.nodeExecutions[failedNode.id]?.attempts || 1,
      error: errorMessage,
      status: 'UNRESOLVED',
    });

    wsManager.broadcast({
      type: 'DLQ_JOB_ADDED',
      tenantId: execution.tenantId,
      data: dlqJob,
      timestamp: new Date().toISOString(),
    });

    // 2. Trigger Saga Compensation Rollback
    await sagaCoordinator.executeCompensations(execution, workflow, errorMessage);
  }

  private failExecution(execution: WorkflowExecution, reason: string, workflow?: Workflow) {
    execution.status = 'FAILED';
    execution.completedAt = new Date().toISOString();
    execution.error = reason;
    db.executions.update(execution.id, {
      status: 'FAILED',
      completedAt: execution.completedAt,
      error: reason,
    });

    wsManager.broadcast({
      type: 'EXECUTION_STATUS_CHANGED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      data: { status: 'FAILED', error: reason },
      timestamp: new Date().toISOString(),
    });
  }
}

export const workflowEngine = new WorkflowOrchestrationEngine();
