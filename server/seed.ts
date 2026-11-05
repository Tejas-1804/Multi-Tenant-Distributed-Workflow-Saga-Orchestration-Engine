
import { db } from './db.ts';
import { hashPassword } from './auth.ts';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Db = typeof db;

type Tenant = NonNullable<ReturnType<Db['tenants']['findOne']>>;
type TenantInput = Parameters<Db['tenants']['create']>[0];
type TenantPatch = Parameters<Db['tenants']['update']>[1];

type UserInput = Parameters<Db['users']['create']>[0];
type UserPatch = Parameters<Db['users']['update']>[1];

type WorkflowInput = Parameters<Db['workflows']['create']>[0];
type WorkflowGraph = Pick<WorkflowInput, 'nodes' | 'edges'>;

type Store = ReturnType<Db['getStore']>;
type Execution = Store['executions'][number];

type PasswordKey = 'SUPER' | 'TEJAS' | 'AMAAN' | 'PRIYANKA' | 'RINKLE';

interface TenantSpec {
  name: string;
  slug: string;
  domain: string;
  plan: TenantInput['plan'];
  rateLimitPerMinute: number;
  legacySlugs?: string[];
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
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const RESET_PASSWORDS =
  process.env.SEED_RESET_PASSWORDS === 'true';

const PASSWORD_DEFAULTS: Record<PasswordKey, string> = {
  SUPER: 'Admin123!',
  TEJAS: 'Tejas123!',
  AMAAN: 'Amaan123!',
  PRIYANKA: 'Priyanka123!',
  RINKLE: 'Rinkle123!',
};

const TENANT_SPECS: TenantSpec[] = [
  {
    name: 'Dharma',
    slug: 'dharma',
    domain: 'dharma.nexusflow.io',
    plan: 'ENTERPRISE',
    rateLimitPerMinute: 5000,
    syncExisting: true,
  },
  {
    name: 'Acme Corp',
    slug: 'acme-corp',
    domain: 'acme.nexusflow.io',
    plan: 'ENTERPRISE',
    rateLimitPerMinute: 2000,
    legacySlugs: ['acme-logistics'],
    syncExisting: true,
  },
  {
    name: 'TechNova',
    slug: 'technova',
    domain: 'technova.nexusflow.io',
    plan: 'PRO',
    rateLimitPerMinute: 1500,
  },
  {
    name: 'Global Systems',
    slug: 'global-systems',
    domain: 'global.nexusflow.io',
    plan: 'ENTERPRISE',
    rateLimitPerMinute: 5000,
  },
  {
    name: 'Quantum Dynamics',
    slug: 'quantum-dynamics',
    domain: 'quantum.nexusflow.io',
    plan: 'PRO',
    rateLimitPerMinute: 1000,
  },
  {
    name: 'Helios Cloud',
    slug: 'helios-cloud',
    domain: 'helios.nexusflow.io',
    plan: 'ENTERPRISE',
    rateLimitPerMinute: 5000,
  },
  {
    name: 'Cyberdyne',
    slug: 'cyberdyne',
    domain: 'cyberdyne.nexusflow.io',
    plan: 'ENTERPRISE',
    rateLimitPerMinute: 5000,
  },
];

const USER_SPECS: UserSpec[] = [
  {
    name: 'Master System Administrator',
    email: 'superadmin@orchestration.engine',
    role: 'SUPER_ADMIN',
    tenantSlug: 'dharma',
    passwordKey: 'SUPER',
  },
  {
    name: 'Tejas Reddy',
    email: 'tejasreddy1808@gmail.com',
    role: 'TENANT_ADMIN',
    tenantSlug: 'dharma',
    passwordKey: 'TEJAS',
  },
  {
    name: 'Tejas Reddy',
    email: 'tejas@acme.com',
    role: 'TENANT_ADMIN',
    tenantSlug: 'acme-corp',
    passwordKey: 'TEJAS',
  },
  {
    name: 'Tejas Reddy',
    email: 'admin@acme.com',
    role: 'TENANT_ADMIN',
    tenantSlug: 'acme-corp',
    passwordKey: 'TEJAS',
  },
  {
    name: 'Amaan',
    email: 'amaan@cyberdyne.com',
    role: 'TENANT_ADMIN',
    tenantSlug: 'cyberdyne',
    passwordKey: 'AMAAN',
  },
  {
    name: 'Priyanka',
    email: 'priyanka@quantum.io',
    role: 'TENANT_ADMIN',
    tenantSlug: 'quantum-dynamics',
    passwordKey: 'PRIYANKA',
  },
  {
    name: 'Rinkle Sharma',
    email: 'rinkle@helios.net',
    role: 'TENANT_ADMIN',
    tenantSlug: 'helios-cloud',
    passwordKey: 'RINKLE',
  },
];

const DEMO_DATA_TENANTS = [
  {
    slug: 'dharma',
    creatorEmail: 'tejasreddy1808@gmail.com',
  },
  {
    slug: 'acme-corp',
    creatorEmail: 'tejas@acme.com',
  },
];

const SIMPLE_WORKFLOWS = [
  {
    name: 'Payment Processing',
    description: 'Recurring subscription billing and settlement with Stripe',
  },
  {
    name: 'User Registration',
    description: 'User signup verification, JWT token issuance, and CRM sync',
  },
  {
    name: 'Email Notification',
    description: 'Transactional notifications, SMS alerts, and audit logging',
  },
  {
    name: 'Inventory Update',
    description: 'Multi-warehouse stock replenishment and catalog reconciliation',
  },
];

const EXECUTION_SPECS: ExecutionSpec[] = [
  {
    code: 'EX-1001',
    workflow: 'Order Processing',
    status: 'SUCCESS',
    duration: '2.4s',
    minutesAgo: 30,
  },
  {
    code: 'EX-1002',
    workflow: 'Payment Processing',
    status: 'RUNNING',
    duration: '1.8s',
    minutesAgo: 2,
  },
  {
    code: 'EX-1003',
    workflow: 'User Registration',
    status: 'FAILED',
    duration: '3.2s',
    minutesAgo: 180,
  },
  {
    code: 'EX-1004',
    workflow: 'Email Notification',
    status: 'SUCCESS',
    duration: '1.5s',
    minutesAgo: 240,
  },
  {
    code: 'EX-1005',
    workflow: 'Inventory Update',
    status: 'SUCCESS',
    duration: '2.1s',
    minutesAgo: 300,
  },
];

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateSeedConfiguration(): void {
  const tenantSlugs = new Set<string>();
  const userEmails = new Set<string>();

  for (const tenant of TENANT_SPECS) {
    if (tenantSlugs.has(tenant.slug)) {
      throw new Error(`Duplicate tenant slug: ${tenant.slug}`);
    }

    tenantSlugs.add(tenant.slug);

    if (
      !tenant.name.trim() ||
      !tenant.domain.trim() ||
      tenant.rateLimitPerMinute <= 0
    ) {
      throw new Error(`Invalid tenant configuration: ${tenant.slug}`);
    }
  }

  for (const user of USER_SPECS) {
    const email = user.email.trim().toLowerCase();

    if (userEmails.has(email)) {
      throw new Error(`Duplicate seed user email: ${email}`);
    }

    userEmails.add(email);

    if (!tenantSlugs.has(user.tenantSlug)) {
      throw new Error(
        `Unknown tenant "${user.tenantSlug}" for user ${email}`,
      );
    }

    if (IS_PRODUCTION) {
      resolvePassword(user.passwordKey);
    }
  }

  for (const demo of DEMO_DATA_TENANTS) {
    if (!tenantSlugs.has(demo.slug)) {
      throw new Error(`Unknown demo tenant: ${demo.slug}`);
    }
  }

  for (const execution of EXECUTION_SPECS) {
    const knownWorkflow =
      execution.workflow === 'Order Processing' ||
      SIMPLE_WORKFLOWS.some(
        (workflow) => workflow.name === execution.workflow,
      );

    if (!knownWorkflow) {
      throw new Error(
        `Unknown workflow in execution configuration: ${execution.workflow}`,
      );
    }

    if (execution.minutesAgo < 0) {
      throw new Error(
        `Invalid execution age: ${execution.code}`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Authentication helpers                                                     */
/* -------------------------------------------------------------------------- */

function resolvePassword(key: PasswordKey): string {
  const envKey = `SEED_PASSWORD_${key}`;
  const environmentPassword = process.env[envKey];

  if (environmentPassword?.length) {
    return environmentPassword;
  }

  if (IS_PRODUCTION) {
    throw new Error(
      `Production seeding requires the ${envKey} environment variable.`,
    );
  }

  return PASSWORD_DEFAULTS[key];
}

/* -------------------------------------------------------------------------- */
/* Tenant management                                                          */
/* -------------------------------------------------------------------------- */

function ensureTenant(spec: TenantSpec): Tenant {
  let existing: Tenant | null | undefined =
    db.tenants.findOne({ slug: spec.slug });

  // Adopt legacy tenant records instead of creating duplicates.
  if (!existing && spec.legacySlugs?.length) {
    for (const legacySlug of spec.legacySlugs) {
      existing = db.tenants.findOne({ slug: legacySlug });

      if (existing) {
        break;
      }
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

  if (!spec.syncExisting) {
    return existing;
  }

  const patch: TenantPatch = {
    name: spec.name,
    slug: spec.slug,
    domain: spec.domain,
    plan: spec.plan,
    rateLimitPerMinute: spec.rateLimitPerMinute,
    status: 'ACTIVE',
  };

  db.tenants.update(existing.id, patch);

  // Re-fetch so legacy slug migrations return the updated record.
  return db.tenants.findOne({ slug: spec.slug }) ?? existing;
}

/* -------------------------------------------------------------------------- */
/* User management                                                            */
/* -------------------------------------------------------------------------- */

async function ensureUser(
  spec: UserSpec,
  tenant: Tenant,
  hashFor: (key: PasswordKey) => Promise<string>,
): Promise<void> {
  const email = spec.email.trim().toLowerCase();

  const existing = db.users.findByEmail(email);

  if (!existing) {
    const passwordHash = await hashFor(spec.passwordKey);

    const user: UserInput = {
      tenantId: tenant.id,
      name: spec.name,
      email,
      role: spec.role,
      status: 'ACTIVE',
      passwordHash,
    };

    db.users.create(user);

    console.log(`  + Created admin: ${email}`);
    return;
  }

  // Synchronize account metadata without silently resetting credentials.
  const patch: UserPatch = {
    tenantId: tenant.id,
    name: spec.name,
    role: spec.role,
    status: 'ACTIVE',
  };

  if (RESET_PASSWORDS) {
    patch.passwordHash = await hashFor(spec.passwordKey);
  }

  db.users.update(existing.id, patch);

  console.log(`  ✓ Synchronized admin: ${email}`);
}

/* -------------------------------------------------------------------------- */
/* Workflow definitions                                                       */
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
          description:
            'Validate cart line items, pricing, and fraud risk token',
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
          description:
            'Decrement warehouse SKU quantity and lock safety stock',
        },
      },
      {
        id: 'node-notify',
        type: 'LOG',
        position: { x: 440, y: 440 },
        data: {
          label: 'Send Notification',
          status: 'PENDING',
          description:
            'Notify operations team or send out-of-stock customer alert',
        },
      },
    ],

    edges: [
      {
        id: 'e1',
        source: 'node-trigger',
        target: 'node-validate',
      },
      {
        id: 'e2',
        source: 'node-validate',
        target: 'node-inventory',
      },
      {
        id: 'e3',
        source: 'node-inventory',
        target: 'node-payment',
        sourceHandle: 'true',
        label: 'In Stock',
      },
      {
        id: 'e4',
        source: 'node-inventory',
        target: 'node-notify',
        sourceHandle: 'false',
        label: 'Out of Stock',
      },
      {
        id: 'e5',
        source: 'node-payment',
        target: 'node-update-inv',
      },
    ],
  };
}

function buildSimpleGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'START',
        position: { x: 200, y: 50 },
        data: { label: 'Event Trigger' },
      },
      {
        id: 'n2',
        type: 'HTTP_REQUEST',
        position: { x: 200, y: 160 },
        data: { label: 'Execute Task' },
      },
      {
        id: 'n3',
        type: 'END',
        position: { x: 200, y: 270 },
        data: { label: 'Completed' },
      },
    ],

    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Workflow management                                                        */
/* -------------------------------------------------------------------------- */

function ensureWorkflow(
  tenant: Tenant,
  creatorEmail: string,
  name: string,
  description: string,
  graph: WorkflowGraph,
): { id: string } {
  const existing = db.workflows.findOne({
    tenantId: tenant.id,
    name,
  });

  if (existing) {
    return existing;
  }

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

/* -------------------------------------------------------------------------- */
/* Demo execution management                                                  */
/* -------------------------------------------------------------------------- */

function seedDemoDataForTenant(
  tenant: Tenant,
  creatorEmail: string,
): void {
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

  for (const workflow of SIMPLE_WORKFLOWS) {
    workflowsByName.set(
      workflow.name,
      ensureWorkflow(
        tenant,
        creatorEmail,
        workflow.name,
        workflow.description,
        buildSimpleGraph(),
      ),
    );
  }

  const existingExecutionIds = new Set(
    store.executions.map((execution) => execution.id),
  );

  const now = Date.now();

  for (const spec of EXECUTION_SPECS) {
    const id = `${spec.code}-${tenant.slug}`;

    // Prevent duplicate executions on repeated seed runs.
    if (existingExecutionIds.has(id)) {
      continue;
    }

    const workflow = workflowsByName.get(spec.workflow);

    if (!workflow) {
      throw new Error(
        `Missing workflow "${spec.workflow}" for tenant "${tenant.slug}".`,
      );
    }

    const startedMs = now - spec.minutesAgo * 60_000;

    const execution: Execution = {
      id,
      workflowId: workflow.id,
      workflowName: spec.workflow,
      tenantId: tenant.id,
      status: spec.status,
      startedAt: new Date(startedMs).toISOString(),

      contextData: {
        productId: 'PRD-1024',
        quantity: 25,
        warehouse: 'WH-01',
      },

      nodeExecutions: {},
      compensationsExecuted: [],
      trigger: 'WEBHOOK',
      triggeredBy: creatorEmail,
      duration: spec.duration,
    };

    if (spec.status !== 'RUNNING') {
      execution.completedAt = new Date(
        startedMs + 2000,
      ).toISOString();
    }

    store.executions.unshift(execution);
    existingExecutionIds.add(id);
  }
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                           */
/* -------------------------------------------------------------------------- */

export async function seedDatabase(): Promise<void> {
  console.log(
    '🌱 Synchronizing NexusFlow multi-tenant database & Tenant Admins...',
  );

  // 1. Validate all static configuration before changing database records.
  validateSeedConfiguration();

  // 2. Ensure tenants.
  const tenants = new Map<string, Tenant>();

  for (const spec of TENANT_SPECS) {
    const tenant = ensureTenant(spec);
    tenants.set(spec.slug, tenant);
  }

  const getTenant = (slug: string): Tenant => {
    const tenant = tenants.get(slug);

    if (!tenant) {
      throw new Error(
        `Seed configuration error: unknown tenant "${slug}".`,
      );
    }

    return tenant;
  };

  // 3. Hash each distinct password only once per seed run.
  const hashCache = new Map<PasswordKey, Promise<string>>();

  const hashFor = (key: PasswordKey): Promise<string> => {
    let pending = hashCache.get(key);

    if (!pending) {
      pending = hashPassword(resolvePassword(key));
      hashCache.set(key, pending);
    }

    return pending;
  };

  // 4. Ensure tenant administrator accounts.
  for (const spec of USER_SPECS) {
    await ensureUser(
      spec,
      getTenant(spec.tenantSlug),
      hashFor,
    );
  }

  // 5. Create demo workflows and executions.
  for (const demo of DEMO_DATA_TENANTS) {
    seedDemoDataForTenant(
      getTenant(demo.slug),
      demo.creatorEmail,
    );
  }

  // 6. Persist all database changes.
  db.save();

  // 7. Report final synchronization status.
  console.log('\n✅ Database seeding completed successfully.');

  console.log(
    `✅ Tenants synchronized: ${TENANT_SPECS.length}`,
  );

  console.log(
    `✅ Admin accounts synchronized: ${USER_SPECS.length}`,
  );

  console.log(
    `✅ Demo data tenants: ${DEMO_DATA_TENANTS.length}`,
  );

  console.log(
    `✅ Demo workflows per tenant: ${SIMPLE_WORKFLOWS.length + 1}`,
  );

  console.log(
    `✅ Password reset mode: ${RESET_PASSWORDS ? 'Enabled' : 'Disabled'}`,
  );

  if (!IS_PRODUCTION) {
    console.log(
      'ℹ️ Development mode: default seed passwords are enabled unless environment variables are provided.',
    );
  }
}
