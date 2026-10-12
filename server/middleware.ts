import { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { verifyJwt, hashApiKey } from './auth.ts';
import { UserRole, Tenant } from '../src/types/index.ts';

// Extend Express Request
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
}

// In-memory rate limiter tracking by tenantId
const rateLimitTracker = new Map<string, { count: number; windowStart: number }>();

export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string;

  // 1. Try Bearer JWT
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyJwt(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired authorization token' });
    }

    const user = db.users.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User is inactive or not found' });
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

  // 2. Try API Key
  if (apiKeyHeader) {
    const hash = hashApiKey(apiKeyHeader);
    const apiKey = db.apiKeys.findByHash(hash);
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    db.apiKeys.updateLastUsed(apiKey.id);

    req.apiKeyId = apiKey.id;
    // API key acts on behalf of TENANT_ADMIN for the key's tenant
    req.user = {
      id: 'apikey_' + apiKey.id,
      email: `apikey@${apiKey.tenantId}.system`,
      tenantId: apiKey.tenantId,
      role: 'TENANT_ADMIN',
      name: `API Key: ${apiKey.name}`,
    };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required. Provide Bearer token or x-api-key header.' });
}

export function identifyTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // SUPER_ADMIN can optionally specify x-tenant-id to inspect another tenant
  const targetTenantId = (req.user.role === 'SUPER_ADMIN' && req.headers['x-target-tenant-id']) 
    ? (req.headers['x-target-tenant-id'] as string)
    : req.user.tenantId;

  const tenant = db.tenants.findById(targetTenantId);
  if (!tenant) {
    return res.status(404).json({ error: `Tenant ${targetTenantId} not found` });
  }

  if (tenant.status !== 'ACTIVE' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Tenant account is suspended' });
  }

  req.tenant = tenant;
  // If SUPER_ADMIN inspected another tenant, override req.user.tenantId for isolation
  if (req.user.role === 'SUPER_ADMIN' && req.headers['x-target-tenant-id']) {
    req.user.tenantId = targetTenantId;
  }

  next();
}

export function authorizeRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // SUPER_ADMIN has access to all resources
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: role '${req.user.role}' lacks permission for this resource. Required: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

export function tenantRateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.tenant) return next();

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const limit = req.tenant.rateLimitPerMinute || (req.tenant.plan === 'PRO' ? 1000 : 100);

  const tracker = rateLimitTracker.get(req.tenant.id) || { count: 0, windowStart: now };

  if (now - tracker.windowStart > windowMs) {
    // Reset window
    tracker.count = 1;
    tracker.windowStart = now;
  } else {
    tracker.count += 1;
  }

  rateLimitTracker.set(req.tenant.id, tracker);

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - tracker.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil((tracker.windowStart + windowMs) / 1000).toString());

  if (tracker.count > limit) {
    return res.status(429).json({
      error: `Rate limit exceeded. Plan: ${req.tenant.plan} limit is ${limit} requests/minute. Try again in ${Math.ceil((tracker.windowStart + windowMs - now) / 1000)}s.`,
    });
  }

  next();
}
