import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, authorizeRole, AuthenticatedRequest } from '../middleware.ts';
import { workerPool } from '../engine/workerPool.ts';
import { SystemStats } from '../../src/types/index.ts';

const router = Router();

router.use(authenticateUser);

// System statistics (SUPER_ADMIN sees global, TENANT_ADMIN sees tenant-specific)
router.get('/statistics', (req: AuthenticatedRequest, res) => {
  const isSuper = req.user!.role === 'SUPER_ADMIN';
  const tenantId = req.user!.tenantId;

  const workflows = isSuper ? db.workflows.find() : db.workflows.find({ tenantId });
  const executions = isSuper ? db.executions.find() : db.executions.find({ tenantId });
  const dlqJobs = isSuper ? db.dlq.find() : db.dlq.find({ tenantId });
  const users = isSuper ? db.users.find() : db.users.find({ tenantId });
  const tenants = db.tenants.find();

  let totalRetries = 0;
  executions.forEach(e => {
    Object.values(e.nodeExecutions).forEach(ne => {
      if (ne.attempts > 1) {
        totalRetries += (ne.attempts - 1);
      }
    });
  });

  const workers = workerPool.getAllWorkers();
  const avgLatency = workers.length > 0 
    ? Math.round(workers.reduce((acc, w) => acc + w.latencyMs, 0) / workers.length)
    : 20;

  const stats: SystemStats = {
    totalTenants: tenants.length,
    activeUsers: users.length,
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter(w => w.status === 'ACTIVE').length,
    runningExecutions: executions.filter(e => e.status === 'RUNNING' || e.status === 'RETRYING' || e.status === 'COMPENSATING').length,
    successfulExecutions: executions.filter(e => e.status === 'SUCCESS').length,
    failedExecutions: executions.filter(e => e.status === 'FAILED').length,
    compensatedExecutions: executions.filter(e => e.status === 'COMPENSATED').length,
    totalRetries,
    dlqCount: dlqJobs.filter(d => d.status === 'UNRESOLVED').length,
    averageWorkerLatencyMs: avgLatency,
    workers,
  };

  return res.json(stats);
});

// Failures inspection
router.get('/failures', (req: AuthenticatedRequest, res) => {
  const isSuper = req.user!.role === 'SUPER_ADMIN';
  const tenantId = req.user!.tenantId;

  const failedExecutions = isSuper
    ? db.executions.find({ status: 'FAILED' })
    : db.executions.find({ tenantId, status: 'FAILED' });

  const dlqJobs = isSuper
    ? db.dlq.find()
    : db.dlq.find({ tenantId });

  return res.json({
    failedExecutions,
    dlqJobs,
  });
});

// Workers status
router.get('/workers', (req: AuthenticatedRequest, res) => {
  const workers = workerPool.getAllWorkers();
  return res.json(workers);
});

export default router;
