import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { seedDatabase } from './server/seed.ts';
import { wsManager } from './server/websocket.ts';
import { initializeChangeStreamProcessor } from './server/events/changeStreamProcessor.ts';

// Route imports
import authRoutes from './server/routes/auth.routes.ts';
import tenantRoutes from './server/routes/tenant.routes.ts';
import workflowRoutes from './server/routes/workflow.routes.ts';
import executionRoutes from './server/routes/execution.routes.ts';
import apiKeyRoutes from './server/routes/apikey.routes.ts';
import dlqRoutes from './server/routes/dlq.routes.ts';
import adminRoutes from './server/routes/admin.routes.ts';
import auditRoutes from './server/routes/audit.routes.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Security & Body parsing
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Attach WebSocket Server
  wsManager.initialize(server);

  // Initialize DB Seeds & Change Streams
  await seedDatabase();
  initializeChangeStreamProcessor();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/executions', executionRoutes);
  app.use('/api/api-keys', apiKeyRoutes);
  app.use('/api/dlq', dlqRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/audit-logs', auditRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'Workflow & Saga Orchestration Engine',
      timestamp: new Date().toISOString(),
    });
  });

  // Frontend integration: Vite middleware in dev, static files in prod
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Multi-Tenant Workflow & Saga Engine running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
