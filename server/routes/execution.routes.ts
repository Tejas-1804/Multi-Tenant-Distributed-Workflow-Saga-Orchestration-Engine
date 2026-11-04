import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, identifyTenant, AuthenticatedRequest } from '../middleware.ts';
import { workflowEngine } from '../engine/orchestrator.ts';

const router = Router();

router.use(authenticateUser);
router.use(identifyTenant);

router.get('/', (req: AuthenticatedRequest, res) => {
  const { workflowId, status } = req.query as { workflowId?: string; status?: string };
  const executions = db.executions.find({
    tenantId: req.user!.tenantId,
    workflowId,
    status,
  });
  return res.json(executions);
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const execution = db.executions.findById(req.params.id, req.user!.tenantId);
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found or belongs to another tenant' });
  }
  return res.json(execution);
});

router.post('/:id/cancel', (req: AuthenticatedRequest, res) => {
  const execution = db.executions.findById(req.params.id, req.user!.tenantId);
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  const cancelled = workflowEngine.cancelExecution(req.params.id, req.user!.tenantId);
  if (!cancelled) {
    return res.status(400).json({ error: 'Execution cannot be cancelled (already finished or not found)' });
  }

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'EXECUTION_CANCELLED',
    resource: 'WorkflowExecution',
    resourceId: req.params.id,
  });

  return res.json({ message: 'Execution cancelled', executionId: req.params.id });
});

router.post('/:id/retry', async (req: AuthenticatedRequest, res) => {
  const execution = db.executions.findById(req.params.id, req.user!.tenantId);
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  // Spawn retry execution
  const workflow = db.workflows.findById(execution.workflowId, req.user!.tenantId);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  try {
    const newExec = await workflowEngine.startExecution(
      workflow,
      execution.contextData || {},
      req.user!.email,
      'MANUAL'
    );

    db.auditLogs.create({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'EXECUTION_RETRIED',
      resource: 'WorkflowExecution',
      resourceId: newExec.id,
    });

    return res.json({ message: 'Execution retried', execution: newExec });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retry execution' });
  }
});

export default router;
