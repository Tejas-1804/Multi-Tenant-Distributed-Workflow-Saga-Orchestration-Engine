import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, identifyTenant, AuthenticatedRequest } from '../middleware.ts';
import { SystemAlert } from '../../src/types/index.ts';

const router = Router();

// In-memory / initial alerts
let alertsStore: SystemAlert[] = [
  {
    id: 'alt-001',
    title: 'Database Query Latency Elevated',
    message: 'Check Inventory service database query latency peaked at 480ms on cluster shard us-east-2.',
    severity: 'WARNING',
    service: 'Database',
    status: 'ACTIVE',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    workflowId: 'wf_order_processing',
  },
  {
    id: 'alt-002',
    title: 'Payment Gateway Timeout',
    message: 'Stripe webhook listener reported 2 connection timeouts in the last 15 minutes. Exponential backoff retry engaged.',
    severity: 'CRITICAL',
    service: 'API Server',
    status: 'ACTIVE',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    executionId: 'EX-1003',
  },
  {
    id: 'alt-003',
    title: 'Worker Node-03 Memory Reached 78%',
    message: 'Execution worker node memory utilization reached threshold (78%). Auto-scaling replica queued.',
    severity: 'INFO',
    service: 'Workers',
    status: 'ACTIVE',
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
  },
  {
    id: 'alt-004',
    title: 'Message Queue Backlog Cleared',
    message: 'RabbitMQ / BullMQ execution queue backlog drained successfully. 142 tasks delivered.',
    severity: 'INFO',
    service: 'Message Queue',
    status: 'RESOLVED',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

router.use(authenticateUser);

router.get('/', (req: AuthenticatedRequest, res) => {
  return res.json(alertsStore);
});

router.post('/:id/acknowledge', (req: AuthenticatedRequest, res) => {
  alertsStore = alertsStore.map(a => (a.id === req.params.id ? { ...a, status: 'ACKNOWLEDGED' } : a));
  return res.json({ success: true, alert: alertsStore.find(a => a.id === req.params.id) });
});

router.post('/:id/resolve', (req: AuthenticatedRequest, res) => {
  alertsStore = alertsStore.map(a => (a.id === req.params.id ? { ...a, status: 'RESOLVED' } : a));
  return res.json({ success: true, alert: alertsStore.find(a => a.id === req.params.id) });
});

export default router;
