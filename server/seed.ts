import { db } from './db.ts';
import { hashPassword } from './auth.ts';

/* -------------------------------------------------------------------------- */
/*  Types (derived from the db API so they always match your schema)           */
/* -------------------------------------------------------------------------- */

type Db = typeof db;
type Tenant = NonNullable<ReturnType<Db['tenants']['findOne']>>;
type TenantInput = Parameters<Db['tenants']['create']>[0];
type UserInput = Parameters<Db['users']['create']>[0];
type UserPatch = Parameters<Db['users']['update']>[1];
type WorkflowInput = Parameters<Db['workflows']['create']>[0];
type WorkflowGraph = Pick<WorkflowInput, 'nodes' | 'edges'>;
type Execution = ReturnType<Db['getStore']>['executions'][number];

type PasswordKey = 'SUPER' | 'TEJAS' | 'AMAAN' | 'PRIYANKA' | 'RINKLE';

interface TenantSpec {
  name: string;
  slug: string;
  domain: string;
  plan: TenantInput['plan'];
  rateLimitPerMinute: number;
  /** Older slugs that should be adopted instead of creating a duplicate. */
  legacySlugs?: string[];
  /** If true, identity fields are re-synced on every seed run. */
  syncExisting?: boolean;
}

interface UserSpec {
  name: string;
  email: string;
  role: UserInput['role'];
  tenantSlug: string;
  passwordKey: PasswordKey;
}

interface ExecutionSpec {
  code: string;
  workflow: string;
  status: Execution['status'];
  duration: string;
  minutesAgo: number;
}

/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Development-only fallbacks. In production every password MUST be supplied
 * via the matching SEED_PASSWORD_<KEY> environment variable.
 */
const PASSWORD_DEFAULTS: Record<PasswordKey, string> = {
  SUPER: 'Admin123!',
  TEJAS: 'Tejas123!',
  AMAAN: 'Amaan123!',
  PRIYANKA: 'Priyanka123!',
  RINKLE: 'Rinkle123!',
};

/** Set SEED_RESET_PASSWORDS=true to overwrite existing users' passwords. */
const RESET_PASSWORDS = process.env.SEED_RESET_PASSWORDS === 'true';

const TENANT_SPECS: TenantSpec[] = [
  { name: 'Dharma', slug: 'dharma', domain: 'dharma.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000, syncExisting: true },
  { name: 'Acme Corp', slug: 'acme-corp', domain: 'acme.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 2000, legacySlugs: ['acme-logistics'], syncExisting: true },
  { name: 'TechNova', slug: 'technova', domain: 'technova.nexusflow.io', plan: 'PRO', rateLimitPerMinute: 1500 },
  { name: 'Global Systems', slug: 'global-systems', domain: 'global.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000 },
  { name: 'Quantum Dynamics', slug: 'quantum-dynamics', domain: 'quantum.nexusflow.io', plan: 'PRO', rateLimitPerMinute: 1000 },
  { name: 'Helios Cloud', slug: 'helios-cloud', domain: 'helios.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000 },
  { name: 'Cyberdyne', slug: 'cyberdyne', domain: 'cyberdyne.nexusflow.io', plan: 'ENTERPRISE', rateLimitPerMinute: 5000 },
];

const USER_SPECS: UserSpec[] = [
  { name: 'Master System Administrator', email: 'superadmin@orchestration.engine', role: 'SUPER_ADMIN', tenantSlug: 'dharma', passwordKey: 'SUPER' },
  { name: 'Tejas Reddy', email: 'tejasreddy1808@gmail.com', role: 'TENANT_ADMIN', tenantSlug: 'dharma', passwordKey: 'TEJAS' },
  { name: 'Tejas Reddy', email: 'tejas@acme.com', role: 'TENANT_ADMIN', tenantSlug: 'acme-corp', passwordKey: 'TEJAS' },
  { name: 'Tejas Reddy', email: 'admin@acme.com', role: 'TENANT_ADMIN', tenantSlug: 'acme-corp', passwordKey: 'TEJAS' },
  { name: 'Amaan', email: 'amaan@cyberdyne.com', role: 'TENANT_ADMIN', tenantSlug: 'cyberdyne', passwordKey: 'AMAAN' },
  { name: 'Priyanka', email: 'priyanka@quantum.io', role: 'TENANT_ADMIN', tenantSlug: 'quantum-dynamics', passwordKey: 'PRIYANKA' },
  { name: 'Rinkle Sharma', email: 'rinkle@helios.net', role: 'TENANT_ADMIN', tenantSlug: 'helios-cloud', passwordKey: 'RINKLE' },
];

/** Which tenants get demo workflows/executions, and who is recorded as creator. */
const DEMO_DATA_TENANTS: Array<{ slug: string; creatorEmail: string }> = [
  { slug: 'dharma', creatorEmail: 'tejasreddy1808@gmail.com' },
  { slug: 'acme-corp', creatorEmail: 'tejas@acme.com' },
];

const SIMPLE_WORKFLOWS: Array<{ name: string; description: string }> = [
  { name: 'Payment Processing', description: 'Recurring subscription billing and settlement with Stripe' },
  { name: 'User Registration', description: 'User signup verification, JWT token issuance, and CRM sync' },
  { name: 'Email Notification', description: 'Transactional notifications, SMS alerts, and audit logging' },
  { name: 'Inventory Update', description: 'Multi-warehouse stock replenishment and catalog reconciliation' },
];

const EXECUTION_SPECS: ExecutionSpec[] = [
  { code: 'EX-1001', workflow: 'Order Processing', status: 'SUCCESS', duration: '2.4s', minutesAgo: 30 },
  { code: 'EX-1002', workflow: 'Payment Processing', status: 'RUNNING', duration: '1.8s', minutesAgo: 2 },
  { code: 'EX-1003', workflow: 'User Registration', status: 'FAILED', duration: '3.2s', minutesAgo: 180 },
  { code: 'EX-1004', workflow: 'Email Notification', status: 'SUCCESS', duration: '1.5s', minutesAgo: 240 },
  { code: 'EX-1005', workflow: 'Inventory Update', status: 'SUCCESS', duration: '2.1s', minutesAgo: 300 },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function resolvePassword(key: PasswordKey): string {
  const fromEnv = process.env[`SEED_PASSWORD_${key}`];
  if (fromEnv) return fromEnv;

  if (IS_PRODUCTION) {
    throw new Error(
      `Refusing to seed with a default password in production. Set SEED_PASSWORD_${key}.`,
    );
  }
  return PASSWORD_DEFAULTS[key];
}

/** Create a tenant if missing; optionally keep identity fields in sync. */
function ensureTenant(spec: TenantSpec): Tenant {
  let existing: Tenant | null | undefined = db.tenants.findOne({ slug: spec.slug });

  if (!existing && spec.legacySlugs) {
    for (const legacy of spec.legacySlugs) {
      existing = db.tenants.findOne({ slug: legacy });
      if (existing) break;
    }
  }

  if (!existing) {
    return db.tenants.create({
      name: spec.name,
      slug: spec.slug,
      domain: spec.domain,
      plan: spec.plan,
      rateLimitPerMinute: spec.rateLimitPerMinute,
      status: 'ACTIVE',
    });
  }

  if (spec.syncExisting) {
    db.tenants.update(existing.id, {
      name: spec.name,
      slug: spec.slug,
      domain: spec.domain,
      plan: spec.plan,
      status: 'ACTIVE',
    });
  }
  return existing;
}

/**
 * Create a user if missing. Existing users keep their password unless
 * SEED_RESET_PASSWORDS=true, so re-running the seed never silently
 * overwrites credentials.
 */
async function ensureUser(
  spec: UserSpec,
  tenant: Tenant,
  hashFor: (key: PasswordKey) => Promise<string>,
): Promise<void> {
  const existing = db.users.findByEmail(spec.email);

  if (!existing) {
    db.users.create({
      tenantId: tenant.id,
      name: spec.name,
      email: spec.email,
      role: spec.role,
      status: 'ACTIVE',
      passwordHash: await hashFor(spec.passwordKey),
    });
    return;
  }

  const patch: UserPatch = { name: spec.name };
  if (RESET_PASSWORDS) patch.passwordHash = await hashFor(spec.passwordKey);
  db.users.update(existing.id, patch);
}

/* -------------------------------------------------------------------------- */
/*  Workflow definitions                                                       */
/* -------------------------------------------------------------------------- */

function buildOrderProcessingGraph(): WorkflowGraph {
  return {
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
          inputData: { productId: 'PRD-1024', quantity: 25, warehouse: 'WH-01' },
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
  };
}

function buildSimpleGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 'n1', type: 'START', position: { x: 200, y: 50 }, data: { label: 'Event Trigger' } },
      { id: 'n2', type: 'HTTP_REQUEST', position: { x: 200, y: 160 }, data: { label: 'Execute Task' } },
      { id: 'n3', type: 'END', position: { x: 200, y: 270 }, data: { label: 'Completed' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Demo data                                                                  */
/* -------------------------------------------------------------------------- */

function ensureWorkflow(
  tenant: Tenant,
  creatorEmail: string,
  name: string,
  description: string,
  graph: WorkflowGraph,
): { id: string } {
  const existing = db.workflows.findOne({ tenantId: tenant.id, name });
  if (existing) return existing;

  return db.workflows.create({
    tenantId: tenant.id,
    name,
    description,
    status: 'ACTIVE',
    createdBy: creatorEmail,
    nodes: graph.nodes,
    edges: graph.edges,
  });
}

function seedDemoDataForTenant(tenant: Tenant, creatorEmail: string): void {
  const store = db.getStore();
  const workflowsByName = new Map<string, { id: string }>();

  workflowsByName.set(
    'Order Processing',
    ensureWorkflow(
      tenant,
      creatorEmail,
      'Order Processing',
      'Distributed order orchestration pipeline executing validation, warehouse inventory check, payment capture, and notification fallback.',
      buildOrderProcessingGraph(),
    ),
  );

  for (const wf of SIMPLE_WORKFLOWS) {
    workflowsByName.set(
      wf.name,
      ensureWorkflow(tenant, creatorEmail, wf.name, wf.description, buildSimpleGraph()),
    );
  }

  // Executions: ids are tenant-scoped so they never collide across tenants,
  // and the existence check uses the same id, so re-running is idempotent.
  const now = Date.now();
  for (const spec of EXECUTION_SPECS) {
    const id = `${spec.code}-${tenant.slug}`;
    if (store.executions.some((e) => e.id === id)) continue;

    const workflow = workflowsByName.get(spec.workflow);
    if (!workflow) continue;

    const startedMs = now - spec.minutesAgo * 60_000;
    const execution: Execution = {
      id,
      workflowId: workflow.id,
      workflowName: spec.workflow,
      tenantId: tenant.id,
      status: spec.status,
      startedAt: new Date(startedMs).toISOString(),
      contextData: { productId: 'PRD-1024', quantity: 25, warehouse: 'WH-01' },
      nodeExecutions: {},
      compensationsExecuted: [],
      trigger: 'WEBHOOK',
      triggeredBy: creatorEmail,
      duration: spec.duration,
    };
    if (spec.status !== 'RUNNING') {
      execution.completedAt = new Date(startedMs + 2000).toISOString();
    }
    store.executions.unshift(execution);
  }
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                                */
/* -------------------------------------------------------------------------- */

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Synchronizing NexusFlow multi-tenant database & Tenant Admins...');

  // 1. Tenants
  const tenants = new Map<string, Tenant>();
  for (const spec of TENANT_SPECS) {
    tenants.set(spec.slug, ensureTenant(spec));
  }
  const getTenant = (slug: string): Tenant => {
    const tenant = tenants.get(slug);
    if (!tenant) throw new Error(`Seed config error: unknown tenant slug "${slug}"`);
    return tenant;
  };

  // 2. Users (hashes computed lazily, once per distinct password)
  const hashCache = new Map<PasswordKey, Promise<string>>();
  const hashFor = (key: PasswordKey): Promise<string> => {
    let pending = hashCache.get(key);
    if (!pending) {
      pending = hashPassword(resolvePassword(key));
      hashCache.set(key, pending);
    }
    return pending;
  };

  for (const spec of USER_SPECS) {
    await ensureUser(spec, getTenant(spec.tenantSlug), hashFor);
  }

  // 3. Demo workflows & executions
  for (const { slug, creatorEmail } of DEMO_DATA_TENANTS) {
    seedDemoDataForTenant(getTenant(slug), creatorEmail);
  }

  // 4. Persist
  db.save();

  console.log(`✅ NexusFlow database seeded with tenants: ${TENANT_SPECS.map((t) => t.name).join(', ')}.`);
  console.log(`✅ ${USER_SPECS.length} users ensured${RESET_PASSWORDS ? ' (passwords reset)' : ''}.`);
  if (!IS_PRODUCTION) {
    console.log('ℹ️  Using development default passwords unless SEED_PASSWORD_* env vars are set.');
  }
}