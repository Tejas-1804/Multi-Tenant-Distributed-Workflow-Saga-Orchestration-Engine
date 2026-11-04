import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware.ts';
import { ServiceHealthItem } from '../../src/types/index.ts';

const router = Router();

router.use(authenticateUser);

router.get('/health', (req: AuthenticatedRequest, res) => {
  const healthItems: ServiceHealthItem[] = [
    {
      id: 'srv-api',
      name: 'API Server',
      status: 'Healthy',
      latencyMs: 120,
      uptime: '99.98%',
      details: 'Express REST & WebSocket Engine running on port 3000',
    },
    {
      id: 'srv-db',
      name: 'Database',
      status: 'Healthy',
      latencyMs: 45,
      uptime: '99.99%',
      details: 'JSON / Document store with change-streams active',
    },
    {
      id: 'srv-mq',
      name: 'Message Queue',
      status: 'Healthy',
      latencyMs: 32,
      uptime: '100%',
      details: 'In-memory / Redis execution event broker running',
    },
    {
      id: 'srv-workers',
      name: 'Workers',
      status: 'Healthy',
      latencyMs: 98,
      uptime: '99.95%',
      details: '3 distributed runner nodes connected with heartbeat',
    },
  ];

  return res.json({
    status: 'Healthy',
    services: healthItems,
    systemMetrics: {
      activeTenants: 6,
      throughputPerSec: 48,
      p99LatencyMs: 142,
      dlqUnresolved: 1,
    },
  });
});

export default router;
