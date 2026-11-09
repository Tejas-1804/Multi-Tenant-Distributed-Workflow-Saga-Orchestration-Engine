
import { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { verifyJwt, hashApiKey } from './auth.ts';
import { UserRole, Tenant } from '../src/types/index.ts';

// Extend Express Request with authenticated user and tenant context
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: UserRole;
    name?: string;
  };
  tenant?: Tenant;
  apiKeyId?: string;
  apiKeyScopes?: string[];
}

// Rate limiter configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 100;
const PRO_RATE_LIMIT = 1000;
const CLEANUP_INTERVAL = 1024;

// In-memory rate limiter tracking by tenant
const rateLimitTracker = new Map<
  string,
  { count: number; windowStart: number }
>();

let rateLimitRequestCount = 0;

/**
 * Safely extracts a single string header.
 * Rejects array values to avoid ambiguous header handling.
 */
function getHeaderValue(
  req: Request,
  headerName: string
): string | undefined {
  const value = req.headers[headerName.toLowerCase()];

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Removes expired rate-limit entries periodically.
 * Prevents the in-memory tracker from growing indefinitely.
 */
function cleanupRateLimitTracker(now: number): void {
  rateLimitRequestCount++;

  if (rateLimitRequestCount < CLEANUP_INTERVAL) {
    return;
  }

  rateLimitRequestCount = 0;

  for (const [tenantId, tracker] of rateLimitTracker.entries()) {
    if (now - tracker.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitTracker.delete(tenantId);
    }
  }
}

/**
 * 1. AUTHENTICATION
 *
 * Supports JWT Bearer tokens and API keys.
 * JWT authentication takes precedence when a Bearer token is supplied.
 */
export function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = getHeaderValue(req, 'authorization');
    const apiKeyHeader = getHeaderValue(req, 'x-api-key');

    // Authenticate using JWT
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return res.status(401).json({
          error: 'Authorization token is missing',
        });
      }

      const decoded = verifyJwt(token);

      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          error: 'Invalid or expired authorization token',
        });
      }

      const user = db.users.findById(decoded.userId);

      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({
          error: 'User is inactive or not found',
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
      };

      return next();
    }

    // Authenticate using API key
    if (apiKeyHeader) {
      const hash = hashApiKey(apiKeyHeader);
      const apiKey = db.apiKeys.findByHash(hash);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Invalid or revoked API key',
        });
      }

      // Validate API key expiration
      if (apiKey.expiresAt) {
        const expirationTime = new Date(apiKey.expiresAt).getTime();

        if (
          !Number.isFinite(expirationTime) ||
          expirationTime <= Date.now()
        ) {
          return res.status(401).json({
            error: 'API key has expired or has an invalid expiration date',
          });
        }
      }

                  req.apiKeyId = apiKey.id;

      // Extract granular scopes
      const assignedScopes = (apiKey as any).scopes && Array.isArray((apiKey as any).scopes)
        ? (apiKey as any).scopes
        : ['workflows:read', 'workflows:execute', 'executions:read'];

      req.apiKeyScopes = assignedScopes;

      // Least-privilege role assignment: only 'admin:*' gets TENANT_ADMIN
      req.user = {
        id: `apikey_${apiKey.id}`,
        email: `apikey@${apiKey.tenantId}.system`,
        tenantId: apiKey.tenantId,
        role: assignedScopes.includes('admin:*') ? 'TENANT_ADMIN' : 'TENANT_USER',
        name: `API Key: ${apiKey.name}`,
      };

      return next();

    return res.status(401).json({
      error: 'Authentication required. Provide a Bearer token or x-api-key header.',
    });
  } catch (error) {
    console.error('[AUTH] Authentication failed:', error);

    return res.status(500).json({
      error: 'Authentication service temporarily unavailable',
    });
  }
}

/**
 * 2. TENANT IDENTIFICATION
 *
 * Resolves the tenant associated with the authenticated user.
 * SUPER_ADMIN can inspect another tenant using x-target-tenant-id.
 */
export function identifyTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'User not authenticated',
      });
    }

    const requestedTenantId = getHeaderValue(
      req,
      'x-target-tenant-id'
    );

    // Only SUPER_ADMIN can select another tenant
    if (requestedTenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'You are not authorized to access another tenant',
      });
    }

    const targetTenantId =
      req.user.role === 'SUPER_ADMIN' && requestedTenantId
        ? requestedTenantId
        : req.user.tenantId;

    const tenant = db.tenants.findById(targetTenantId);

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    // Suspended tenants cannot access the platform
    if (
      tenant.status !== 'ACTIVE' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        error: 'Tenant account is suspended',
      });
    }

    req.tenant = tenant;

    // Preserve the original user identity.
    // The selected tenant is available through req.tenant.
    return next();
  } catch (error) {
    console.error('[TENANT] Tenant identification failed:', error);

    return res.status(500).json({
      error: 'Unable to identify tenant',
    });
  }
}

/**
 * 3. ROLE-BASED AUTHORIZATION
 *
 * Restricts resources to specified user roles.
 */
export function authorizeRole(allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required',
      });
    }

    // SUPER_ADMIN has global access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions',
        role: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

        return next();
  };
}

/**
 * 3.1 GRANULAR SCOPE ENFORCEMENT (Task 3)
 * Verifies that the API key carries the required permission scope.
 */
export function requireScope(requiredScope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Session-based user logins (JWT) carry full role permissions
    if (!req.apiKeyId) return next();

    const scopes = req.apiKeyScopes || [];
    const hasScope = scopes.includes('*') || scopes.includes('admin:*') || scopes.includes(requiredScope);

    if (!hasScope) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient API key scope',
        requiredScope,
        assignedScopes: scopes,
      });
    }
    return next();
  };
}

/**
 * 3.2 IDEMPOTENCY GUARD (Task 4)
 * Prevents duplicate workflow executions from duplicate network requests.
 */
const idempotencyStore = new Map<string, { timestamp: number; response: any }>();

export function checkIdempotency(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey || typeof idempotencyKey !== 'string') return next();

  const tenantId = req.user?.tenantId || 'global';
  const compositeKey = `${tenantId}:${idempotencyKey.trim()}`;
  const now = Date.now();

  const existing = idempotencyStore.get(compositeKey);
  if (existing && now - existing.timestamp < 10 * 60 * 1000) {
    res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
    return res.status(200).json(existing.response);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(compositeKey, { timestamp: Date.now(), response: body });
    }
    return originalJson(body);
  };

  return next();
}

/**
 * 4. TENANT RATE LIMITER
 *
 * Applies request limits independently to each tenant.
 * Uses a fixed 60-second window.
 */
export function tenantRateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.tenant) {
    return next();
  }

  const now = Date.now();
  const tenantId = req.tenant.id;

  // Resolve the tenant's configured request limit
  const configuredLimit = req.tenant.rateLimitPerMinute;

  const limit =
    typeof configuredLimit === 'number' &&
    Number.isSafeInteger(configuredLimit) &&
    configuredLimit > 0
      ? configuredLimit
      : req.tenant.plan === 'PRO'
        ? PRO_RATE_LIMIT
        : DEFAULT_RATE_LIMIT;

  // Periodically remove expired tracker entries
  cleanupRateLimitTracker(now);

  let tracker = rateLimitTracker.get(tenantId);

  // Initialize or reset the current rate-limit window
  if (
    !tracker ||
    now - tracker.windowStart >= RATE_LIMIT_WINDOW_MS
  ) {
    tracker = {
      count: 0,
      windowStart: now,
    };
  }

  // Count the current request
  tracker.count++;

  rateLimitTracker.set(tenantId, tracker);

  const remaining = Math.max(0, limit - tracker.count);

  const resetTime = Math.ceil(
    (tracker.windowStart + RATE_LIMIT_WINDOW_MS) / 1000
  );

  // Rate-limit response headers
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', resetTime.toString());

  // Reject requests exceeding the tenant's limit
  if (tracker.count > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (tracker.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000
      )
    );

    res.setHeader('Retry-After', retryAfter.toString());

    return res.status(429).json({
      error: 'Rate limit exceeded',
      plan: req.tenant.plan,
      limit,
      window: '60 seconds',
      retryAfter,
      message: `Your tenant has exceeded its limit of ${limit} requests per minute.`,
    });
  }

  return next();
}
