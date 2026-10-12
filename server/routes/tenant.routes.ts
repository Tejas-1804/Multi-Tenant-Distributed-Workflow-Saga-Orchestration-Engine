import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, authorizeRole, AuthenticatedRequest } from '../middleware.ts';

const router = Router();

// Only SUPER_ADMIN can view all tenants
router.get('/', authenticateUser, authorizeRole(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const tenants = db.tenants.find();
  return res.json(tenants);
});

// SUPER_ADMIN creates tenants
router.post('/', authenticateUser, authorizeRole(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { name, slug, plan = 'PRO', rateLimitPerMinute = 1000 } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  const tenant = db.tenants.create({
    name,
    slug,
    plan,
    rateLimitPerMinute,
    status: 'ACTIVE',
  });

  db.auditLogs.create({
    tenantId: tenant.id,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'TENANT_CREATED',
    resource: 'Tenant',
    resourceId: tenant.id,
  });

  return res.status(201).json(tenant);
});

router.get('/:id', authenticateUser, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  // Non-super-admins can only view their own tenant
  if (req.user!.role !== 'SUPER_ADMIN' && req.user!.tenantId !== id) {
    return res.status(403).json({ error: 'Forbidden: Cannot access other tenant data' });
  }

  const tenant = db.tenants.findById(id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  return res.json(tenant);
});

export default router;
