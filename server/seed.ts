import { db } from './db.ts';
import { hashPassword, hashApiKey } from './auth.ts';

export async function seedDatabase() {
  const store = db.getStore();

  console.log('🌱 Synchronizing NexusFlow multi-tenant database & Tenant Admins...');

  // 1. Ensure Tenants: Dharma, Acme Corp, TechNova, Global Systems, Quantum Dynamics, Helios Cloud, Cyberdyne
  let dharmaTenant = db.tenants.findOne({ slug: 'dharma' });
  if (!dharmaTenant) {
    dharmaTenant = db.tenants.create({
      name: 'Dharma',
      slug: 'dharma',
      domain: 'dharma.nexusflow.io',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  } else {
    db.tenants.update(dharmaTenant.id, {
      name: 'Dharma',
      slug: 'dharma',
      domain: 'dharma.nexusflow.io',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
  }

  let acmeTenant = db.tenants.findOne({ slug: 'acme-corp' }) || db.tenants.findOne({ slug: 'acme-logistics' });
  if (!acmeTenant) {
    acmeTenant = db.tenants.create({
      name: 'Acme Corp',
      slug: 'acme-corp',
      domain: 'acme.nexusflow.io',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 2000,
      status: 'ACTIVE',
    });
  } else {
    db.tenants.update(acmeTenant.id, {
      name: 'Acme Corp',
      slug: 'acme-corp',
      domain: 'acme.nexusflow.io',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
  }

  let techNovaTenant = db.tenants.findOne({ slug: 'technova' });
  if (!techNovaTenant) {
    techNovaTenant = db.tenants.create({
      name: 'TechNova',
      slug: 'technova',
      domain: 'technova.nexusflow.io',
      plan: 'PRO',
      rateLimitPerMinute: 1500,
      status: 'ACTIVE',
    });
  }

  let globalSystemsTenant = db.tenants.findOne({ slug: 'global-systems' });
  if (!globalSystemsTenant) {
    globalSystemsTenant = db.tenants.create({
      name: 'Global Systems',
      slug: 'global-systems',
      domain: 'global.nexusflow.io',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  }

  let quantumTenant = db.tenants.findOne({ slug: 'quantum-dynamics' });
  if (!quantumTenant) {
    quantumTenant = db.tenants.create({
      name: 'Quantum Dynamics',
      slug: 'quantum-dynamics',
      domain: 'quantum.nexusflow.io',
      plan: 'PRO',
      rateLimitPerMinute: 1000,
      status: 'ACTIVE',
    });
  }

  let heliosTenant = db.tenants.findOne({ slug: 'helios-cloud' });
  if (!heliosTenant) {
    heliosTenant = db.tenants.create({
      name: 'Helios Cloud',
      slug: 'helios-cloud',
      domain: 'helios.nexusflow.io',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  }

  let cyberTenant = db.tenants.findOne({ slug: 'cyberdyne' });
  if (!cyberTenant) {
    cyberTenant = db.tenants.create({
      name: 'Cyberdyne',
      slug: 'cyberdyne',
      domain: 'cyberdyne.nexusflow.io',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  }

  // 2. Ensure Password Hashes for Tenant Admins: Tejas Reddy, Amaan, Priyanka, Rinkle Sharma
  const tejasPasswordHash = await hashPassword('Tejas123!');
  const amaanPasswordHash = await hashPassword('Amaan123!');
  const priyankaPasswordHash = await hashPassword('Priyanka123!');
  const rinklePasswordHash = await hashPassword('Rinkle123!');
  const superPasswordHash = await hashPassword('Admin123!');

  // Master System Admin
  let superAdmin = db.users.findByEmail('superadmin@orchestration.engine');
  if (!superAdmin) {
    superAdmin = db.users.create({
      tenantId: dharmaTenant.id,
      name: 'Master System Administrator',
      email: 'superadmin@orchestration.engine',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: superPasswordHash,
    });
  }

  // Tejas Reddy (Tenant Admin for Dharma & Acme Corp)
  let tejasReddy = db.users.findByEmail('tejasreddy1808@gmail.com');
  if (!tejasReddy) {
    tejasReddy = db.users.create({
      tenantId: dharmaTenant.id,
      name: 'Tejas Reddy',
      email: 'tejasreddy1808@gmail.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: tejasPasswordHash,
    });
  } else {
    db.users.update(tejasReddy.id, { tenantId: dharmaTenant.id, name: 'Tejas Reddy', passwordHash: tejasPasswordHash });
  }

  // Tejas alias tejas@acme.com
  let tejasAdmin = db.users.findByEmail('tejas@acme.com');
  if (!tejasAdmin) {
    tejasAdmin = db.users.create({
      tenantId: acmeTenant.id,
      name: 'Tejas Reddy',
      email: 'tejas@acme.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: tejasPasswordHash,
    });
  } else {
    db.users.update(tejasAdmin.id, { name: 'Tejas Reddy', passwordHash: tejasPasswordHash });
  }

  let acmeAlias = db.users.findByEmail('admin@acme.com');
  if (acmeAlias) {
    db.users.update(acmeAlias.id, { name: 'Tejas Reddy', passwordHash: tejasPasswordHash });
  } else {
    db.users.create({
      tenantId: acmeTenant.id,
      name: 'Tejas Reddy',
      email: 'admin@acme.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: tejasPasswordHash,
    });
  }

  // Amaan (Tenant Admin for Cyberdyne / TechNova)
  let amaanAdmin = db.users.findByEmail('amaan@cyberdyne.com');
  if (!amaanAdmin) {
    amaanAdmin = db.users.create({
      tenantId: cyberTenant.id,
      name: 'Amaan',
      email: 'amaan@cyberdyne.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: amaanPasswordHash,
    });
  } else {
    db.users.update(amaanAdmin.id, { name: 'Amaan', passwordHash: amaanPasswordHash });
  }

  // Priyanka (Tenant Admin for Quantum Dynamics / Global Systems)
  let priyankaAdmin = db.users.findByEmail('priyanka@quantum.io');
  if (!priyankaAdmin) {
    priyankaAdmin = db.users.create({
      tenantId: quantumTenant.id,
      name: 'Priyanka',
      email: 'priyanka@quantum.io',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: priyankaPasswordHash,
    });
  } else {
    db.users.update(priyankaAdmin.id, { name: 'Priyanka', passwordHash: priyankaPasswordHash });
  }

  // Rinkle Sharma (Tenant Admin for Helios Cloud)
  let rinkleAdmin = db.users.findByEmail('rinkle@helios.net');
  if (!rinkleAdmin) {
    rinkleAdmin = db.users.create({
      tenantId: heliosTenant.id,
      name: 'Rinkle Sharma',
      email: 'rinkle@helios.net',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: rinklePasswordHash,
    });
  } else {
    db.users.update(rinkleAdmin.id, { name: 'Rinkle Sharma', passwordHash: rinklePasswordHash });
  }

  // Helper function to seed workflows & executions for a tenant
  const seedWorkflowsForTenant = (targetTenant: typeof dharmaTenant, creatorEmail: string) => {
    let orderWf = db.workflows.findOne({ tenantId: targetTenant.id, name: 'Order Processing' });
    if (!orderWf) {
      orderWf = db.workflows.create({
        tenantId: targetTenant.id,
        name: 'Order Processing',
        description: 'Distributed order orchestration pipeline executing validation, warehouse inventory check, payment capture, and notification fallback.',
        status: 'ACTIVE',
        createdBy: creatorEmail,
        nodes: [
          {
            id: 'node-trigger',
            type: 'START',
            position: { x: 280, y: 50 },
            data: {
              label: 'Trigger',
              sublabel: 'New Order',
              duration: '234ms',
              status: 'SUCCESS',
              description: 'Customer checkout webhook event received',
            },
          },
          {
            id: 'node-validate',
            type: 'TRANSFORM',
            position: { x: 280, y: 160 },
            data: {
              label: 'Validate Order',
              duration: '512ms',
              status: 'SUCCESS',
              description: 'Validate cart line items, pricing, and fraud risk token',
            },
          },
          {
            id: 'node-inventory',
            type: 'HTTP_REQUEST',
            position: { x: 280, y: 280 },
            data: {
              label: 'Check Inventory',
              duration: '1.2s',
              status: 'RUNNING',
              description: 'Query stock levels from inventory services.',
              serviceType: 'Inventory Services / Database Query',
              inputData: {
                productId: 'PRD-1024',
                quantity: 25,
                warehouse: 'WH-01',
              },
              outputData: null,
            },
          },
          {
            id: 'node-payment',
            type: 'HTTP_REQUEST',
            position: { x: 120, y: 440 },
            data: {
              label: 'Process Payment',
              status: 'PENDING',
              description: 'Capture pre-authorized credit card transaction',
            },
          },
          {
            id: 'node-update-inv',
            type: 'HTTP_REQUEST',
            position: { x: 120, y: 560 },
            data: {
              label: 'Update Inventory',
              status: 'PENDING',
              description: 'Decrement warehouse SKU quantity and lock safety stock',
            },
          },
          {
            id: 'node-notify',
            type: 'LOG',
            position: { x: 440, y: 440 },
            data: {
              label: 'Send Notification',
              status: 'PENDING',
              description: 'Notify operations team or send out-of-stock customer alert',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-trigger', target: 'node-validate' },
          { id: 'e2', source: 'node-validate', target: 'node-inventory' },
          { id: 'e3', source: 'node-inventory', target: 'node-payment', sourceHandle: 'true', label: 'In Stock' },
          { id: 'e4', source: 'node-inventory', target: 'node-notify', sourceHandle: 'false', label: 'Out of Stock' },
          { id: 'e5', source: 'node-payment', target: 'node-update-inv' },
        ],
      });
    }

    const otherWorkflows = [
      { name: 'Payment Processing', desc: 'Recurring subscription billing and settlement with Stripe' },
      { name: 'User Registration', desc: 'User signup verification, JWT token issuance, and CRM sync' },
      { name: 'Email Notification', desc: 'Transactional notifications, SMS alerts, and audit logging' },
      { name: 'Inventory Update', desc: 'Multi-warehouse stock replenishment and catalog reconciliation' },
    ];

    for (const item of otherWorkflows) {
      if (!db.workflows.findOne({ tenantId: targetTenant.id, name: item.name })) {
        db.workflows.create({
          tenantId: targetTenant.id,
          name: item.name,
          description: item.desc,
          status: 'ACTIVE',
          createdBy: creatorEmail,
          nodes: [
            { id: 'n1', type: 'START', position: { x: 200, y: 50 }, data: { label: 'Event Trigger' } },
            { id: 'n2', type: 'HTTP_REQUEST', position: { x: 200, y: 160 }, data: { label: 'Execute Task' } },
            { id: 'n3', type: 'END', position: { x: 200, y: 270 }, data: { label: 'Completed' } },
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2' },
            { id: 'e2', source: 'n2', target: 'n3' },
          ],
        });
      }
    }

    // Seed Executions EX-1001 through EX-1005
    const execDefs = [
      { id: `EX-1001-${targetTenant.slug}`, name: 'Order Processing', status: 'SUCCESS' as const, duration: '2.4s', deltaMin: 30 },
      { id: `EX-1002-${targetTenant.slug}`, name: 'Payment Processing', status: 'RUNNING' as const, duration: '1.8s', deltaMin: 2 },
      { id: `EX-1003-${targetTenant.slug}`, name: 'User Registration', status: 'FAILED' as const, duration: '3.2s', deltaMin: 180 },
      { id: `EX-1004-${targetTenant.slug}`, name: 'Email Notification', status: 'SUCCESS' as const, duration: '1.5s', deltaMin: 240 },
      { id: `EX-1005-${targetTenant.slug}`, name: 'Inventory Update', status: 'SUCCESS' as const, duration: '2.1s', deltaMin: 300 },
    ];

    for (const ed of execDefs) {
      if (!store.executions.find(e => e.id === ed.id || (e.tenantId === targetTenant.id && e.workflowName === ed.name))) {
        store.executions.unshift({
          id: ed.id.startsWith('EX-100') ? ed.id.substring(0, 7) : ed.id,
          workflowId: orderWf.id,
          workflowName: ed.name,
          tenantId: targetTenant.id,
          status: ed.status,
          startedAt: new Date(Date.now() - 1000 * 60 * ed.deltaMin).toISOString(),
          completedAt: ed.status === 'RUNNING' ? undefined : new Date(Date.now() - 1000 * 60 * ed.deltaMin + 2000).toISOString(),
          contextData: { productId: 'PRD-1024', quantity: 25, warehouse: 'WH-01' },
          nodeExecutions: {},
          compensationsExecuted: [],
          trigger: 'WEBHOOK',
          triggeredBy: creatorEmail,
          duration: ed.duration,
        });
      }
    }
  };

  // Seed both Dharma and Acme Corp
  seedWorkflowsForTenant(dharmaTenant, 'tejasreddy1808@gmail.com');
  seedWorkflowsForTenant(acmeTenant, 'tejas@acme.com');

  // Persist store update
  db.save();

  console.log('✅ NexusFlow database seeded with tenants: Dharma, Acme Corp, TechNova, Global Systems, Quantum Dynamics, Helios Cloud, Cyberdyne.');
  console.log('✅ Tejas Reddy (TR) initialized as Tenant Admin for Dharma.');
}
