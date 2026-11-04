
import express, { type Request, type Response, type NextFunction } from 'express';
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
import templateRoutes from './server/routes/template.routes.ts';
import alertRoutes from './server/routes/alert.routes.ts';
import workerRoutes from './server/routes/worker.routes.ts';
import monitoringRoutes from './server/routes/monitoring.routes.ts';
import dashboardRoutes from './server/routes/dashboard.routes.ts';

// Environment configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Configure allowed frontend origins using CORS_ORIGIN.
// Multiple origins can be separated by commas.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Keep track of server instances for graceful shutdown.
let viteServer: Awaited<ReturnType<typeof createViteServer>> | null = null;
let httpServer: http.Server | null = null;
let isShuttingDown = false;

// Main server initialization
async function startServer(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  httpServer = server;

  // Security configuration
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Preserve support for requests without an Origin header.
        if (!origin) {
          return callback(null, true);
        }

        // If no CORS_ORIGIN is configured, preserve the previous
        // permissive behavior for compatibility.
        if (allowedOrigins.length === 0) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        const error = new Error('CORS origin not allowed') as Error & {
          status?: number;
        };

        error.status = 403;
        return callback(error);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // WebSocket initialization
  wsManager.initialize(server);

  // Database initialization
  console.log('Initializing database...');

  await seedDatabase();

  console.log('Database initialization completed.');

  // Initialize database change stream processor
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
  app.use('/api/templates', templateRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: 'Workflow & Saga Orchestration Engine',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Handle unknown API endpoints
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      path: req.originalUrl,
    });
  });

  // Frontend integration
  if (!isProduction) {
    // Development: Vite middleware
    viteServer = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(viteServer.middlewares);
  } else {
    // Production: Serve compiled frontend files
    const distPath = path.resolve(process.cwd(), 'dist');

    app.use(express.static(distPath));

    // SPA fallback
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Centralized error handling
  app.use(
    (
      err: Error & { status?: number },
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (res.headersSent) {
        return next(err);
      }

      const statusCode =
        err.status ||
        (err instanceof SyntaxError ? 400 : 500);

      console.error('Server error:', {
        message: err.message,
        path: req.originalUrl,
        method: req.method,
        statusCode,
      });

      res.status(statusCode).json({
        success: false,
        message:
          statusCode >= 500
            ? 'Internal server error'
            : err.message,
      });
    }
  );

  // Handle HTTP server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('HTTP server error:', error.message);

    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    }

    if (error.code === 'EACCES') {
      console.error(`Permission denied for port ${PORT}.`);
    }
  });

  // Start server
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('==========================================');
    console.log(' Multi-Tenant Workflow & Saga Engine');
    console.log('==========================================');
    console.log(` Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(` Server URL  : http://localhost:${PORT}`);
    console.log(` Health URL  : http://localhost:${PORT}/api/health`);
    console.log(` Host        : ${HOST}`);
    console.log('==========================================');
    console.log(' Server started successfully!');
    console.log('');
  });
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down server...`);

  if (!httpServer) {
    process.exit(0);
  }

  httpServer.close(async (error) => {
    if (error) {
      console.error('Error while closing HTTP server:', error);
      process.exitCode = 1;
    } else {
      console.log('HTTP server closed successfully.');
    }

    try {
      if (viteServer) {
        await viteServer.close();
        console.log('Vite server closed successfully.');
      }
    } catch (viteError) {
      console.error('Error closing Vite server:', viteError);
      process.exitCode = 1;
    }

    process.exit();
  });
}

// Process shutdown signals
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Start application
startServer().catch((error: unknown) => {
  console.error('Failed to start server:', error);

  process.exit(1);
});
