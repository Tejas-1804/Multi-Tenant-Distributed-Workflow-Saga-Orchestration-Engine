import { dbEvents, db } from '../db.ts';
import { workflowEngine } from '../engine/orchestrator.ts';

export function initializeChangeStreamProcessor() {
  dbEvents.on('change', async (changeEvent: { collection: string; operationType: string; document: any }) => {
    // Check if event triggers a workflow
    if (changeEvent.collection === 'auditLogs' || changeEvent.collection === 'executions') {
      return; // prevent recursive triggering
    }

    // Example: When a webhook or event is logged or simulated order is inserted
    if (changeEvent.operationType === 'insert' && changeEvent.collection === 'events') {
      const tenantId = changeEvent.document.tenantId;
      const eventName = changeEvent.document.name;

      console.log(`[CHANGE_STREAM] Detected event '${eventName}' on tenant '${tenantId}'`);

      // Find workflows that listen to this event or have webhook trigger
      const workflows = db.workflows.find({ tenantId, status: 'ACTIVE' });
      for (const wf of workflows) {
        const hasTrigger = wf.nodes.some(n => n.type === 'START' || n.type === 'WEBHOOK');
        if (hasTrigger) {
          console.log(`[CHANGE_STREAM] Triggering workflow '${wf.name}' automatically.`);
          await workflowEngine.startExecution(
            wf,
            { changeStreamEvent: changeEvent.document },
            'MongoDB_Change_Stream',
            'CHANGE_STREAM'
          );
        }
      }
    }
  });

  console.log('📡 MongoDB Change Stream Event Processor initialized');
}
