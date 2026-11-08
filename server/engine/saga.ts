
import {
  Workflow,
  WorkflowExecution,
  WorkflowNode,
  WorkflowNodeExecution,
} from '../../src/types/index.ts';
import { db } from '../db.ts';
import { wsManager } from '../websocket.ts';

export interface SagaCompensationStepResult {
  nodeId: string;
  nodeLabel: string;
  success: boolean;
  actionTaken: string;
  error?: string;
}

export class SagaCompensationCoordinator {
  /**
   * Executes compensation actions in reverse order.
   *
   * Only successfully completed nodes with compensation enabled
   * are included in the rollback process.
   */
  public async executeCompensations(
    execution: WorkflowExecution,
    workflow: Workflow,
    triggeringError: string
  ): Promise<{
    success: boolean;
    steps: SagaCompensationStepResult[];
  }> {
    console.log(
      `[SAGA] Starting compensation for execution ${execution.id}`
    );

    execution.status = 'COMPENSATING';

    db.executions.update(execution.id, {
      status: 'COMPENSATING',
    });

    wsManager.broadcast({
      type: 'COMPENSATION_TRIGGERED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      data: {
        reason: triggeringError,
        status: 'COMPENSATING',
      },
      timestamp: new Date().toISOString(),
    });

    const nodesToCompensate: WorkflowNode[] = [];

    // Find successfully completed nodes that have compensation enabled.
    for (const nodeId of Object.keys(execution.nodeExecutions)) {
      const nodeExecution = execution.nodeExecutions[nodeId];

      if (nodeExecution.status !== 'SUCCESS') {
        continue;
      }

      const node = workflow.nodes.find(item => item.id === nodeId);

      if (!node || !node.data.compensation?.enabled) {
        continue;
      }

      nodesToCompensate.push(node);
    }

    // Saga compensation follows LIFO order.
    nodesToCompensate.reverse();

    const results: SagaCompensationStepResult[] = [];
    let overallSuccess = true;

    for (const node of nodesToCompensate) {
      const result = await this.compensateNode(execution, node);

      results.push(result);

      if (!result.success) {
        overallSuccess = false;
      }

      // Save the current state after every compensation step.
      db.executions.update(execution.id, {
        nodeExecutions: execution.nodeExecutions,
        compensationsExecuted: execution.compensationsExecuted,
      });
    }

    const finalStatus = overallSuccess ? 'COMPENSATED' : 'FAILED';
    const completedAt = new Date().toISOString();

    execution.status = finalStatus;
    execution.completedAt = completedAt;

    db.executions.update(execution.id, {
      status: finalStatus,
      completedAt,
      nodeExecutions: execution.nodeExecutions,
      compensationsExecuted: execution.compensationsExecuted,
    });

    wsManager.broadcast({
      type: 'EXECUTION_STATUS_CHANGED',
      tenantId: execution.tenantId,
      executionId: execution.id,
      data: {
        status: finalStatus,
        completedAt,
        sagaResults: results,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[SAGA] Finished compensation for execution ${execution.id} with status: ${finalStatus}`
    );

    return {
      success: overallSuccess,
      steps: results,
    };
  }

  /**
   * Runs compensation for a single workflow node.
   */
  private async compensateNode(
    execution: WorkflowExecution,
    node: WorkflowNode
  ): Promise<SagaCompensationStepResult> {
    const compensation = node.data.compensation;
    const nodeExecution =
      execution.nodeExecutions[node.id] as WorkflowNodeExecution;

    if (!compensation || !nodeExecution) {
      return {
        nodeId: node.id,
        nodeLabel: node.data.label,
        success: false,
        actionTaken: 'Failed to start compensation',
        error: 'Compensation configuration or node execution was not found',
      };
    }

    nodeExecution.status = 'COMPENSATING';
    nodeExecution.compensationStatus = 'PENDING';

    nodeExecution.logs.push(
      `[SAGA] Starting rollback compensation: ${
        compensation.name || `Compensate ${node.data.label}`
      }`
    );

    wsManager.broadcast({
      type: 'COMPENSATION_NODE_STATUS',
      tenantId: execution.tenantId,
      executionId: execution.id,
      nodeId: node.id,
      data: {
        nodeId: node.id,
        status: 'COMPENSATING',
        compensationName: compensation.name,
      },
      timestamp: new Date().toISOString(),
    });

    // Keep the small delay used by the demo compensation flow.
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      const actionTaken = await this.executeCompensation(
        execution,
        node,
        nodeExecution
      );

      nodeExecution.status = 'COMPENSATED';
      nodeExecution.compensationStatus = 'SUCCESS';

      nodeExecution.logs.push(
        `[SAGA SUCCESS] ${actionTaken}`
      );

      // Prevent duplicate entries if compensation is called again.
      if (!execution.compensationsExecuted.includes(node.id)) {
        execution.compensationsExecuted.push(node.id);
      }

      wsManager.broadcast({
        type: 'COMPENSATION_NODE_STATUS',
        tenantId: execution.tenantId,
        executionId: execution.id,
        nodeId: node.id,
        data: {
          nodeId: node.id,
          status: 'COMPENSATED',
          actionTaken,
        },
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id,
        nodeLabel: node.data.label,
        success: true,
        actionTaken,
      };
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      nodeExecution.compensationStatus = 'FAILED';
      nodeExecution.compensationError = errorMessage;

      nodeExecution.logs.push(
        `[SAGA FAILED] Rollback error: ${errorMessage}`
      );

      wsManager.broadcast({
        type: 'COMPENSATION_NODE_STATUS',
        tenantId: execution.tenantId,
        executionId: execution.id,
        nodeId: node.id,
        data: {
          nodeId: node.id,
          status: 'FAILED',
          error: errorMessage,
        },
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id,
        nodeLabel: node.data.label,
        success: false,
        actionTaken: 'Failed to compensate',
        error: errorMessage,
      };
    }
  }

  /**
   * Executes the configured compensation action.
   */
  private async executeCompensation(
    execution: WorkflowExecution,
    node: WorkflowNode,
    nodeExecution: WorkflowNodeExecution
  ): Promise<string> {
    const compensation = node.data.compensation!;

    // No real endpoint means this is a local/demo compensation.
    if (
      !compensation.url ||
      !compensation.url.startsWith('http')
    ) {
      return (
        compensation.simulatedAction ||
        `Rolled back successfully: ${compensation.name}`
      );
    }

    try {
      const method = compensation.method;

      let body: string | undefined;

      if (
        method === 'POST' ||
        method === 'PUT' ||
        method === 'PATCH'
      ) {
        body = JSON.stringify({
          originalOutput: nodeExecution.output,
          context: execution.contextData,
        });
      }

      const response = await fetch(compensation.url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(compensation.headers || {}),
        },
        body,
      });

      if (!response.ok) {
        throw new Error(
          `Compensation endpoint responded with status ${response.status}`
        );
      }

      return `Remote endpoint HTTP ${response.status} confirmed rollback`;
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.warn(
        `[SAGA] Remote compensation failed for ${node.data.label}: ${errorMessage}`
      );

      /*
       * Keep the existing demo behavior:
       * if the remote compensation endpoint is unavailable,
       * record a simulated rollback instead of stopping the
       * entire compensation process.
       */
      return (
        `Simulated rollback executed: ${
          compensation.simulatedAction || compensation.name
        } (${errorMessage})`
      );
    }
  }
}

export const sagaCoordinator =
  new SagaCompensationCoordinator();
