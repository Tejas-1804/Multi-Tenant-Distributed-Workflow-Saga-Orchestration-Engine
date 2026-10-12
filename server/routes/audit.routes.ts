import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, identifyTenant, AuthenticatedRequest } from '../middleware.ts';

const router = Router();

router.use(authenticateUser);
router.use(identifyTenant);

router.get('/', (req: AuthenticatedRequest, res) => {
  const isSuper = req.user!.role === 'SUPER_ADMIN';
  const tenantId = isSuper ? undefined : req.user!.tenantId;
  const logs = db.auditLogs.find({ tenantId, limit: 100 });
  return res.json(logs);
});

export default router;
