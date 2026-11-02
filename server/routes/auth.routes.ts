import { Router } from 'express';
import { db } from '../db.ts';
import { hashPassword, comparePassword, signJwt } from '../auth.ts';
import { authenticateUser, AuthenticatedRequest } from '../middleware.ts';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, organizationName, plan } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = db.users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Create Tenant if new organization name is provided
    let tenant = null;
    let tenantId = 'tenant_acme';
    if (organizationName) {
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const selectedPlan = (plan === 'ENTERPRISE' || plan === 'PRO') ? plan : 'FREE';
      const rateLimit = selectedPlan === 'ENTERPRISE' ? 5000 : (selectedPlan === 'PRO' ? 1000 : 100);
      tenant = db.tenants.create({
        name: organizationName,
        slug,
        plan: selectedPlan,
        rateLimitPerMinute: rateLimit,
        status: 'ACTIVE',
      });
      tenantId = tenant.id;
    } else {
      tenant = db.tenants.findById(tenantId);
    }

    const passwordHash = await hashPassword(password);
    const user = db.users.create({
      tenantId,
      name,
      email,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash,
    });

    const token = signJwt({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    });

    db.auditLogs.create({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'USER_REGISTERED',
      resource: 'User',
      resourceId: user.id,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or credentials' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or credentials' });
    }

    const token = signJwt({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    });

    db.auditLogs.create({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'USER_LOGIN',
      resource: 'User',
      resourceId: user.id,
    });

    const tenant = db.tenants.findById(user.tenantId);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

router.get('/me', authenticateUser, (req: AuthenticatedRequest, res) => {
  const user = db.users.findById(req.user!.id);
  const tenant = db.tenants.findById(req.user!.tenantId);

  return res.json({
    user: req.user,
    tenant,
  });
});

router.post('/logout', authenticateUser, (req: AuthenticatedRequest, res) => {
  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'USER_LOGOUT',
    resource: 'User',
  });
  return res.json({ message: 'Logged out successfully' });
});

export default router;
