import { db } from './db.ts';
import { hashPassword, hashApiKey } from './auth.ts';

export async function seedDatabase() {
  const store = db.getStore();

  console.log('🌱 Synchronizing multi-tenant database & Tenant Admins...');

  // 1. Ensure Tenants
  let acmeTenant = db.tenants.findOne({ slug: 'acme-logistics' });
  if (!acmeTenant) {
    acmeTenant = db.tenants.create({
      name: 'Acme Logistics Global',
      slug: 'acme-logistics',
      plan: 'PRO',
      rateLimitPerMinute: 1000,
      status: 'ACTIVE',
    });
  }

  let cyberTenant = db.tenants.findOne({ slug: 'cyberdyne' });
  if (!cyberTenant) {
    cyberTenant = db.tenants.create({
      name: 'Cyberdyne Systems Corp',
      slug: 'cyberdyne',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  }

  let quantumTenant = db.tenants.findOne({ slug: 'quantum-dynamics' });
  if (!quantumTenant) {
    quantumTenant = db.tenants.create({
      name: 'Quantum Dynamics Corp',
      slug: 'quantum-dynamics',
      plan: 'PRO',
      rateLimitPerMinute: 1000,
      status: 'ACTIVE',
    });
  }

  let heliosTenant = db.tenants.findOne({ slug: 'helios-cloud' });
  if (!heliosTenant) {
    heliosTenant = db.tenants.create({
      name: 'Helios Cloud Systems',
      slug: 'helios-cloud',
      plan: 'ENTERPRISE',
      rateLimitPerMinute: 5000,
      status: 'ACTIVE',
    });
  }

  // 2. Ensure Password Hashes
  const tejasPasswordHash = await hashPassword('Tejas123!');
  const amaanPasswordHash = await hashPassword('Amaan123!');
  const priyankaPasswordHash = await hashPassword('Priyanka123!');
  const rinklePasswordHash = await hashPassword('Rinkle123!');
  const superPasswordHash = await hashPassword('Admin123!');

  // Master System Admin
  let superAdmin = db.users.findByEmail('superadmin@orchestration.engine');
  if (!superAdmin) {
    superAdmin = db.users.create({
      tenantId: acmeTenant.id,
      name: 'Master System Administrator',
      email: 'superadmin@orchestration.engine',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: superPasswordHash,
    });
  }

  // 1. Tejas (Tenant Admin)
  let tejasAdmin = db.users.findByEmail('tejas@acme.com');
  if (!tejasAdmin) {
    tejasAdmin = db.users.create({
      tenantId: acmeTenant.id,
      name: 'Tejas (Tenant Admin)',
      email: 'tejas@acme.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: tejasPasswordHash,
    });
  } else {
    db.users.update(tejasAdmin.id, { name: 'Tejas (Tenant Admin)', passwordHash: tejasPasswordHash });
  }

  // Also update or create admin@acme.com alias for Tejas
  let acmeAlias = db.users.findByEmail('admin@acme.com');
  if (acmeAlias) {
    db.users.update(acmeAlias.id, { name: 'Tejas', passwordHash: tejasPasswordHash });
  } else {
    db.users.create({
      tenantId: acmeTenant.id,
      name: 'Tejas',
      email: 'admin@acme.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: tejasPasswordHash,
    });
  }

  // 2. Amaan (Tenant Admin)
  let amaanAdmin = db.users.findByEmail('amaan@cyberdyne.com');
  if (!amaanAdmin) {
    amaanAdmin = db.users.create({
      tenantId: cyberTenant.id,
      name: 'Amaan (Tenant Admin)',
      email: 'amaan@cyberdyne.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: amaanPasswordHash,
    });
  } else {
    db.users.update(amaanAdmin.id, { name: 'Amaan (Tenant Admin)', passwordHash: amaanPasswordHash });
  }

  // Also update or create admin@cyberdyne.com alias for Amaan
  let cyberAlias = db.users.findByEmail('admin@cyberdyne.com');
  if (cyberAlias) {
    db.users.update(cyberAlias.id, { name: 'Amaan', passwordHash: amaanPasswordHash });
  } else {
    db.users.create({
      tenantId: cyberTenant.id,
      name: 'Amaan',
      email: 'admin@cyberdyne.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: amaanPasswordHash,
    });
  }

  // 3. Priyanka (Tenant Admin)
  let priyankaAdmin = db.users.findByEmail('priyanka@quantum.io');
  if (!priyankaAdmin) {
    priyankaAdmin = db.users.create({
      tenantId: quantumTenant.id,
      name: 'Priyanka (Tenant Admin)',
      email: 'priyanka@quantum.io',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: priyankaPasswordHash,
    });
  } else {
    db.users.update(priyankaAdmin.id, { name: 'Priyanka (Tenant Admin)', passwordHash: priyankaPasswordHash });
  }

  // 4. Rinkle Sharma (Tenant Admin)
  let rinkleAdmin = db.users.findByEmail('rinkle@helios.net');
  if (!rinkleAdmin) {
    rinkleAdmin = db.users.create({
      tenantId: heliosTenant.id,
      name: 'Rinkle Sharma (Tenant Admin)',
      email: 'rinkle@helios.net',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: rinklePasswordHash,
    });
  } else {
    db.users.update(rinkleAdmin.id, { name: 'Rinkle Sharma (Tenant Admin)', passwordHash: rinklePasswordHash });
  }

  // If workflows already exist, skip workflow re-creation
  if (store.workflows.length > 0) {
    console.log('✅ Tenant Admins synchronized: Tejas, Amaan, Priyanka, and Rinkle Sharma.');
    return;
  }

  // 3. API Keys
  const demoRawKey = 'wk_live_acme_prod_99f38e4a77194602';
  db.apiKeys.create({
    tenantId: acmeTenant.id,
    name: 'Production Ingestion Gateway Key',
    keyPrefix: 'wk_live_acme...',
    keyHash: hashApiKey(demoRawKey),
  });

  // 4. Default Sample Workflow for Acme (Order Processing with Saga)
  const orderSagaWorkflow = db.workflows.create({
    tenantId: acmeTenant.id,
    name: 'E-Commerce Order Processing & Saga Compensation',
    description: 'Mission-critical distributed transaction executing Payment Capture, Warehouse Inventory Reservation, and Carrier Dispatch with automatic backward Saga rollback upon downstream failure.',
    status: 'ACTIVE',
    createdBy: tejasAdmin.email,
    nodes: [
      {
        id: 'node-start',
        type: 'START',
        position: { x: 80, y: 160 },
        data: {
          label: 'Receive Order Event',
          description: 'Triggers on incoming customer order event with cart payload',
        },
      },
      {
        id: 'node-payment',
        type: 'HTTP_REQUEST',
        position: { x: 340, y: 160 },
        data: {
          label: 'Authorize & Capture Payment',
          description: 'Charges customer payment method via Stripe/Adyen API',
          method: 'POST',
          url: 'https://api.example.com/v1/payments/capture',
          body: JSON.stringify({ orderId: '{{orderId}}', amount: '{{amount}}', currency: 'USD' }, null, 2),
          timeoutMs: 5000,
          retryPolicy: {
            maxAttempts: 2,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            retryOnStatuses: [500, 502, 503],
          },
          compensation: {
            enabled: true,
            name: 'Refund Payment Transaction',
            method: 'POST',
            url: 'https://api.example.com/v1/payments/refund',
            simulatedAction: 'Refund $249.99 to customer credit card via payment gateway',
          },
        },
      },
      {
        id: 'node-inventory',
        type: 'HTTP_REQUEST',
        position: { x: 620, y: 160 },
        data: {
          label: 'Reserve Warehouse Inventory',
          description: 'Locks physical SKU units in inventory management system',
          method: 'POST',
          url: 'https://api.example.com/v1/inventory/reserve',
          body: JSON.stringify({ sku: 'SKU-QUANTUM-X', quantity: 1 }, null, 2),
          timeoutMs: 5000,
          retryPolicy: {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
          },
          compensation: {
            enabled: true,
            name: 'Release Reserved Inventory',
            method: 'POST',
            url: 'https://api.example.com/v1/inventory/release',
            simulatedAction: 'Released 1 unit of SKU-QUANTUM-X back to active inventory pool',
          },
        },
      },
      {
        id: 'node-condition',
        type: 'CONDITION',
        position: { x: 900, y: 160 },
        data: {
          label: 'Evaluate Inventory Status',
          description: 'Checks if warehouse response confirmed physical stock availability',
          conditionField: 'status',
          conditionOperator: '==',
          conditionValue: '200',
        },
      },
      {
        id: 'node-shipment',
        type: 'HTTP_REQUEST',
        position: { x: 1180, y: 100 },
        data: {
          label: 'Create Carrier Shipment & Waybill',
          description: 'Dispatches parcel via FedEx/DHL logistics API',
          method: 'POST',
          url: 'https://api.example.com/v1/logistics/shipments',
          body: JSON.stringify({ service: 'PRIORITY_OVERNIGHT', weightKg: 1.2 }, null, 2),
          timeoutMs: 5000,
          retryPolicy: {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            retryOnStatuses: [500, 502, 503, 504],
          },
          compensation: {
            enabled: true,
            name: 'Void Carrier Shipping Label',
            method: 'DELETE',
            url: 'https://api.example.com/v1/logistics/shipments/cancel',
            simulatedAction: 'Voided carrier shipping label and cancelled pickup dispatch',
          },
          simulateFailure: false, // User can toggle this on to test Saga rollback!
        },
      },
      {
        id: 'node-transform',
        type: 'TRANSFORM',
        position: { x: 1450, y: 100 },
        data: {
          label: 'Generate Order Invoice & Telemetry',
          description: 'Calculates tax, discounts and formats executive summary in VM sandbox',
          transformScript: `// Safe sandboxed calculation
const subtotal = input.amount || 249.99;
const taxRate = 0.0825;
const tax = Math.round(subtotal * taxRate * 100) / 100;
const total = Math.round((subtotal + tax) * 100) / 100;

return {
  invoiceId: "INV-" + Math.floor(100000 + Math.random() * 900000),
  subtotal: subtotal,
  tax: tax,
  totalCharged: total,
  fulfillmentCenter: "FC-AUSTIN-04",
  generatedAt: new Date().toISOString()
};`,
        },
      },
      {
        id: 'node-log-fallback',
        type: 'LOG',
        position: { x: 1180, y: 300 },
        data: {
          label: 'Log Out-of-Stock Alert',
          description: 'Publishes notification when inventory check fails',
          logMessage: 'Order entered backorder state: warehouse allocation unsuccessful',
          logLevel: 'WARN',
        },
      },
      {
        id: 'node-end',
        type: 'END',
        position: { x: 1720, y: 160 },
        data: {
          label: 'Order Processing Complete',
          description: 'Workflow execution succeeded and customer transaction closed',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-payment' },
      { id: 'e2', source: 'node-payment', target: 'node-inventory' },
      { id: 'e3', source: 'node-inventory', target: 'node-condition' },
      { id: 'e4', source: 'node-condition', target: 'node-shipment', sourceHandle: 'true', label: 'In Stock (True)' },
      { id: 'e5', source: 'node-condition', target: 'node-log-fallback', sourceHandle: 'false', label: 'Out of Stock (False)' },
      { id: 'e6', source: 'node-shipment', target: 'node-transform' },
      { id: 'e7', source: 'node-transform', target: 'node-end' },
      { id: 'e8', source: 'node-log-fallback', target: 'node-end' },
    ],
  });

  // 5. Seed historical executions for Acme to show immediate analytics
  const historicExec1 = db.executions.create({
    workflowId: orderSagaWorkflow.id,
    workflowName: orderSagaWorkflow.name,
    tenantId: acmeTenant.id,
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2 + 3200).toISOString(),
    contextData: { orderId: 'ORD-8821', amount: 189.50, status: 200 },
    nodeExecutions: {},
    compensationsExecuted: [],
    trigger: 'MANUAL',
    triggeredBy: tejasAdmin.email,
  });

  const historicExec2 = db.executions.create({
    workflowId: orderSagaWorkflow.id,
    workflowName: orderSagaWorkflow.name,
    tenantId: acmeTenant.id,
    status: 'COMPENSATED',
    startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 5 + 4100).toISOString(),
    contextData: { orderId: 'ORD-7742', amount: 499.00 },
    nodeExecutions: {},
    compensationsExecuted: ['node-inventory', 'node-payment'],
    error: 'Carrier API responded with 503 Service Unavailable after 3 attempts',
    trigger: 'API',
    triggeredBy: 'api_client',
  });

  // Seed sample Dead Letter Queue entry
  db.dlq.create({
    tenantId: acmeTenant.id,
    workflowId: orderSagaWorkflow.id,
    workflowName: orderSagaWorkflow.name,
    executionId: historicExec2.id,
    nodeId: 'node-shipment',
    nodeLabel: 'Create Carrier Shipment & Waybill',
    payload: { orderId: 'ORD-7742', customer: 'David Bishop', amount: 499.00 },
    attempts: 3,
    error: 'Carrier Dispatch Gateway timed out after max retries (3/3)',
    status: 'UNRESOLVED',
  });

  // Audit log entries
  db.auditLogs.create({
    tenantId: acmeTenant.id,
    userId: tejasAdmin.id,
    userEmail: tejasAdmin.email,
    action: 'SYSTEM_BOOTSTRAPPED',
    resource: 'Tenant',
    metadata: { tenant: acmeTenant.name },
  });

  console.log('✅ Seed completed successfully with 4 tenants and tenant admins: Tejas, Amaan, Priyanka, and Rinkle Sharma.');
}
