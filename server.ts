import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { seedDatabase } from './server/seed.ts';
import { wsManager } from './server/websocket.ts';
import { initializeChangeStreamProcessor } from './server/events/changeStreamProcessor.ts';

// Routes
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

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '10mb';

const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ORIGIN,
);

function parseAllowedOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Server state                                                               */
/* -------------------------------------------------------------------------- */

let viteServer: Awaited<
  ReturnType<typeof createViteServer>
> | null = null;

let httpServer: http.Server | null = null;
let isShuttingDown = false;

/* -------------------------------------------------------------------------- */
/* Utility functions                                                          */
/* -------------------------------------------------------------------------- */

function logStartupInfo(): void {
  console.log('');
  console.log('==========================================');
  console.log(' Multi-Tenant Workflow & Saga Engine');
  console.log('==========================================');
  console.log(` Environment : ${NODE_ENV}`);
  console.log(` Server URL  : http://localhost:${PORT}`);
  console.log(` Health URL  : http://localhost:${PORT}/api/health`);
  console.log(` Host        : ${HOST}`);
  console.log('==========================================');
  console.log(' Server started successfully!');
  console.log('');
}

function validateConfiguration(): void {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  if (IS_PRODUCTION && allowedOrigins.length === 0) {
    console.warn(
      '[Security] CORS_ORIGIN is not configured in production. ' +
        'All origins will currently be accepted.',
    );
  }

  if (!IS_PRODUCTION) {
    console.warn(
      `[Environment] Running in ${NODE_ENV} mode.`,
    );
  }
}

function createSecurityMiddleware(
  app: express.Express,
): void {
  app.disable('x-powered-by');

  app.use(
    (
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader(
        'Referrer-Policy',
        'strict-origin-when-cross-origin',
      );

      next();
    },
  );
}

function createCorsMiddleware(
  app: express.Express,
): void {
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser/server-to-server requests may not send Origin.
        if (!origin) {
          callback(null, true);
          return;
        }

        // Preserve development compatibility when CORS_ORIGIN
        // is not explicitly configured.
        if (allowedOrigins.length === 0) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error(
          `CORS origin not allowed: ${origin}`,
        ) as Error & { status?: number };

        error.status = 403;

        callback(error);
      },

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
      ],
    }),
  );
}

function createBodyParserMiddleware(
  app: express.Express,
): void {
  app.use(
    express.json({
      limit: JSON_BODY_LIMIT,
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: JSON_BODY_LIMIT,
    }),
  );
}

function registerApiRoutes(
  app: express.Express,
): void {
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
}

function registerHealthRoute(
  app: express.Express,
): void {
  app.get(
    '/api/health',
    (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'UP',
        service: 'Workflow & Saga Orchestration Engine',
        environment: NODE_ENV,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    },
  );
}

function registerApiFallback(
  app: express.Express,
): void {
  app.use(
    '/api',
    (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl,
      });
    },
  );
}

async function configureFrontend(
  app: express.Express,
): Promise<void> {
  if (!IS_PRODUCTION) {
    viteServer = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(viteServer.middlewares);

    return;
  }

  const distPath = path.resolve(
    process.cwd(),
    'dist',
  );

  app.use(express.static(distPath));

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(
      path.join(distPath, 'index.html'),
    );
  });
}

function registerErrorHandler(
  app: express.Express,
): void {
  app.use(
    (
      err: Error & { status?: number },
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }

      const statusCode =
        err.status ??
        (err instanceof SyntaxError ? 400 : 500);

      const isServerError = statusCode >= 500;

      console.error('[Server Error]', {
        message: err.message,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        stack:
          process.env.NODE_ENV === 'development'
            ? err.stack
            : undefined,
      });

      res.status(statusCode).json({
        success: false,
        message: isServerError
          ? 'Internal server error'
          : err.message,
      });
    },
  );
}

function registerServerErrorHandlers(
  server: http.Server,
): void {
  server.on(
    'error',
    (error: NodeJS.ErrnoException) => {
      console.error(
        '[HTTP Server Error]',
        error.message,
      );

      if (error.code === 'EADDRINUSE') {
        console.error(
          `[Server] Port ${PORT} is already in use.`,
        );
      }

      if (error.code === 'EACCES') {
        console.error(
          `[Server] Permission denied for port ${PORT}.`,
        );
      }
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Application startup                                                        */
/* -------------------------------------------------------------------------- */

async function startServer(): Promise<void> {
  validateConfiguration();

  const app = express();
  const server = http.createServer(app);

  httpServer = server;

  createSecurityMiddleware(app);
  createCorsMiddleware(app);
  createBodyParserMiddleware(app);

  // WebSocket must share the same HTTP server as Express.
  wsManager.initialize(server);

  console.log('[Startup] Initializing database...');

  await seedDatabase();

  console.log(
    '[Startup] Database initialization completed.',
  );

  // Start database event processing after the database
  // is ready.
  initializeChangeStreamProcessor();

  registerApiRoutes(app);
  registerHealthRoute(app);
  registerApiFallback(app);

  await configureFrontend(app);

  // Error middleware must be registered after routes.
  registerErrorHandler(app);

  registerServerErrorHandlers(server);

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.removeListener('error', handleError);
      reject(error);
    };

    server.once('error', handleError);

    server.listen(PORT, HOST, () => {
      server.removeListener('error', handleError);
      resolve();
    });
  });

  logStartupInfo();
}

/* -------------------------------------------------------------------------- */
/* Graceful shutdown                                                          */
/* -------------------------------------------------------------------------- */

async function closeViteServer(): Promise<void> {
  if (!viteServer) {
    return;
  }

  try {
    await viteServer.close();
    console.log(
      '[Shutdown] Vite server closed successfully.',
    );
  } catch (error) {
    console.error(
      '[Shutdown] Failed to close Vite server:',
      error,
    );

    process.exitCode = 1;
  } finally {
    viteServer = null;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\n[Shutdown] ${signal} received. ` +
      'Shutting down server...',
  );

  await closeViteServer();

  if (!httpServer) {
    console.log(
      '[Shutdown] No HTTP server is running.',
    );

    process.exit(0);
  }

  const server = httpServer;

  await new Promise<void>((resolve) => {
    server.close((error) => {
      if (error) {
        console.error(
          '[Shutdown] Error closing HTTP server:',
          error,
        );

        process.exitCode = 1;
      } else {
        console.log(
          '[Shutdown] HTTP server closed successfully.',
        );
      }

      httpServer = null;
      resolve();
    });
  });

  console.log('[Shutdown] Shutdown complete.');
  process.exit();
}

/* -------------------------------------------------------------------------- */
/* Process signal handlers                                                    */
/* -------------------------------------------------------------------------- */

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

/* -------------------------------------------------------------------------- */
/* Start application                                                          */
/* -------------------------------------------------------------------------- */

void startServer().catch((error: unknown) => {
  console.error(
    '[Startup] Failed to start server:',
    error,
  );

  process.exit(1);
});
