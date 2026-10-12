import { Router } from 'express';
import { db } from '../db.ts';
import {
  authenticateUser,
  identifyTenant,
  authorizeRole,
  AuthenticatedRequest,
} from '../middleware.ts';
import { generateApiKey } from '../auth.ts';

const router = Router();

router.use(authenticateUser);
router.use(identifyTenant);
router.use(authorizeRole(['TENANT_ADMIN']));

// List keys (never returning raw keys or key hashes)
router.get('/', (req: AuthenticatedRequest, res) => {
  const keys = db.apiKeys.find({ tenantId: req.user!.tenantId });
  const sanitized = keys.map(k => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    status: k.revokedAt ? 'REVOKED' : (k.expiresAt && new Date(k.expiresAt) < new Date() ? 'EXPIRED' : 'ACTIVE'),
  }));
  return res.json(sanitized);
});

// Create new API Key (Returns rawKey ONLY ONCE)
router.post('/', (req: AuthenticatedRequest, res) => {
  const { name, expiresInDays } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Key name is required' });
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  let expiresAt: string | undefined = undefined;
  if (expiresInDays && Number(expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 3600 * 1000).toISOString();
  }

  const record = db.apiKeys.create({
    tenantId: req.user!.tenantId,
    name,
    keyPrefix,
    keyHash,
    expiresAt,
  });

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'API_KEY_CREATED',
    resource: 'APIKey',
    resourceId: record.id,
    metadata: { name: record.name },
  });

  // Return the raw key this single time!
  return res.status(201).json({
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    rawKey, // IMPORTANT: Front end shows this once to user
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    warning: 'Save this secret API key now. You will not be able to see it again!',
  });
});

// Revoke key
router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const revoked = db.apiKeys.revoke(req.params.id, req.user!.tenantId);
  if (!revoked) {
    return res.status(404).json({ error: 'API key not found' });
  }

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'API_KEY_REVOKED',
    resource: 'APIKey',
    resourceId: req.params.id,
  });

  return res.json({ message: 'API key revoked successfully' });
});

// Rotate key
router.post('/:id/rotate', (req: AuthenticatedRequest, res) => {
  const oldKey = db.apiKeys.findById(req.params.id, req.user!.tenantId);
  if (!oldKey) {
    return res.status(404).json({ error: 'API key not found' });
  }

  // Revoke old
  db.apiKeys.revoke(oldKey.id, req.user!.tenantId);

  // Generate new
  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const newKey = db.apiKeys.create({
    tenantId: req.user!.tenantId,
    name: `${oldKey.name} (Rotated)`,
    keyPrefix,
    keyHash,
    expiresAt: oldKey.expiresAt,
  });

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'API_KEY_ROTATED',
    resource: 'APIKey',
    resourceId: newKey.id,
    metadata: { previousKeyId: oldKey.id },
  });

  return res.json({
    message: 'API Key rotated successfully',
    newKey: {
      id: newKey.id,
      name: newKey.name,
      keyPrefix: newKey.keyPrefix,
      rawKey,
      expiresAt: newKey.expiresAt,
      createdAt: newKey.createdAt,
    },
  });
});

export default router;
