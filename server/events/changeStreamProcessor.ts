import { dbEvents, db } from '../db.ts';
import { workflowEngine } from '../engine/orchestrator.ts';

type ChangeEvent = {
  collection: string;
  operationType: string;
  document?: Record<string, unknown>;
};

const IGNORED_COLLECTIONS = new Set(['auditLogs', 'executions']);
const TRIGGER_COLLECTION = 'events';
const TRIGGER_OPERATION = 'insert';

export function initializeChangeStreamProcessor(): void {
  dbEvents.on('change', async (changeEvent: ChangeEvent) => {
    try {
      // Ignore malformed events.
      if (
        !changeEvent ||
        typeof changeEvent.collection !== 'string' ||
        typeof changeEvent.operationType !== 'string'
      ) {
        console.warn('[CHANGE_STREAM] Ignoring malformed change event.');
        return;
      }

      // Prevent recursive workflow execution.
      if (IGNORED_COLLECTIONS.has(changeEvent.collection)) {
        return;
      }

      // Only "insert" events from the events collection can trigger workflows.
      if (
        changeEvent.collection !== TRIGGER_COLLECTION ||
        changeEvent.operationType !== TRIGGER_OPERATION
      ) {
        return;
      }

      const document = changeEvent.document;

      if (!document) {
        console.warn(
          '[CHANGE_STREAM] Ignoring event because the document is missing.'
        );
        return;
      }

      const tenantId = document.tenantId;
      const eventName = document.name;

      if (
        typeof tenantId !== 'string' ||
        tenantId.trim().length === 0
      ) {
        console.warn(
          '[CHANGE_STREAM] Ignoring event because tenantId is missing or invalid.'
        );
        return;
      }

      if (
        typeof eventName !== 'string' ||
        eventName.trim().length === 0
      ) {
        console.warn(
          `[CHANGE_STREAM] Ignoring event for tenant '${tenantId}' because event name is missing or invalid.`
        );
        return;
      }

      console.log(
        `[CHANGE_STREAM] Detected event '${eventName}' on tenant '${tenantId}'`
      );

      // Find only active workflows belonging to the affected tenant.
      const workflows = db.workflows.find({
        tenantId,
        status: 'ACTIVE',
      });

      if (!workflows || workflows.length === 0) {
        console.log(
          `[CHANGE_STREAM] No active workflows found for tenant '${tenantId}'.`
        );
        return;
      }

      for (const workflow of workflows) {
        try {
          // A workflow must contain a valid trigger node to be started
          // automatically by the change-stream processor.
          const hasTrigger = workflow.nodes?.some(
            (node) => node.type === 'START' || node.type === 'WEBHOOK'
          );

          if (!hasTrigger) {
            continue;
          }

          console.log(
            `[CHANGE_STREAM] Triggering workflow '${workflow.name}' automatically.`
          );

          await workflowEngine.startExecution(
            workflow,
            {
              changeStreamEvent: document,
            },
            'MongoDB_Change_Stream',
            'CHANGE_STREAM'
          );

          console.log(
            `[CHANGE_STREAM] Workflow '${workflow.name}' started successfully.`
          );
        } catch (error) {
          // Do not allow one failed workflow to stop other workflows
          // from being triggered for the same event.
          console.error(
            `[CHANGE_STREAM] Failed to start workflow '${workflow.name}'.`,
            error
          );
        }
      }
    } catch (error) {
      // Protect the change-stream listener from unexpected failures.
      console.error(
        '[CHANGE_STREAM] Error processing change event:',
        error
      );
    }
  });

  console.log('📡 MongoDB Change Stream Event Processor initialized');
}