import { Router } from 'express';
import { db } from '../db.ts';
import {
  authenticateUser,
  identifyTenant,
  authorizeRole,
  AuthenticatedRequest,
} from '../middleware.ts';
import { workflowEngine } from '../engine/orchestrator.ts';

const router = Router();

router.use(authenticateUser);
router.use(identifyTenant);
router.use(authorizeRole(['TENANT_ADMIN', 'SUPER_ADMIN']));

// List DLQ jobs
router.get('/', (req: AuthenticatedRequest, res) => {
  const jobs = db.dlq.find({ tenantId: req.user!.tenantId });
  return res.json(jobs);
});

// Retry DLQ job
router.post('/:id/retry', async (req: AuthenticatedRequest, res) => {
  const job = db.dlq.findById(req.params.id, req.user!.tenantId);
  if (!job) {
    return res.status(404).json({ error: 'DLQ job not found' });
  }

  const workflow = db.workflows.findById(job.workflowId, req.user!.tenantId);
  if (!workflow) {
    return res.status(400).json({ error: 'Associated workflow no longer exists' });
  }

  // Update DLQ job status
  db.dlq.update(job.id, req.user!.tenantId, { status: 'RESOLVED' });

    // Enterprise DLQ Mutation: Allow operator to pass a corrected payload in req.body.payload
  const payloadToRun = req.body.payload && typeof req.body.payload === 'object'
    ? { ...job.payload, ...req.body.payload, _dlqRepaired: true }
    : (job.payload || {});

  const execution = await workflowEngine.startExecution(
    workflow,
    payloadToRun,
    req.user!.email,
    'MANUAL'
  );

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'DLQ_JOB_RETRIED',
    resource: 'DeadLetterJob',
    resourceId: job.id,
    metadata: { executionId: execution.id },
  });

  return res.json({
    message: 'DLQ job re-executed into workflow execution engine',
    newExecutionId: execution.id,
  });
});

// Delete or cancel DLQ job
router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const success = db.dlq.delete(req.params.id, req.user!.tenantId);
  if (!success) {
    return res.status(404).json({ error: 'DLQ job not found' });
  }

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'DLQ_JOB_DISCARDED',
    resource: 'DeadLetterJob',
    resourceId: req.params.id,
  });

  return res.json({ message: 'DLQ job discarded' });
});

export default router;
