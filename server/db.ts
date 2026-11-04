import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  Tenant,
  User,
  Workflow,
  WorkflowExecution,
  WorkflowNodeExecution,
  APIKey,
  AuditLog,
  DeadLetterJob,
  WorkerInfo,
} from '../src/types/index.ts';

// Event emitter used to simulate MongoDB Change Streams.
export class DatabaseChangeStreamEmitter extends EventEmitter {}
export const dbEvents = new DatabaseChangeStreamEmitter();

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseStore {
  tenants: Tenant[];
  users: (User & { passwordHash: string })[];
  workflows: Workflow[];
  executions: WorkflowExecution[];
  nodeExecutions: WorkflowNodeExecution[];
  apiKeys: APIKey[];
  auditLogs: AuditLog[];
  dlq: DeadLetterJob[];
  workers: WorkerInfo[];
}

function createEmptyStore(): DatabaseStore {
  return {
    tenants: [],
    users: [],
    workflows: [],
    executions: [],
    nodeExecutions: [],
    apiKeys: [],
    auditLogs: [],
    dlq: [],
    workers: [],
  };
}

let store: DatabaseStore = createEmptyStore();

/**
 * Creates collision-resistant IDs while preserving the existing ID prefixes.
 */
function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Normalizes older database files and fills in collections added in newer
 * versions. Invalid collection values are replaced with empty arrays.
 */
function normalizeStore(data: unknown): DatabaseStore {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Database file must contain a JSON object.');
  }

  const source = data as Record<string, unknown>;
  const defaults = createEmptyStore();

  return {
    tenants: Array.isArray(source.tenants) ? source.tenants as Tenant[] : defaults.tenants,
    users: Array.isArray(source.users)
      ? source.users as (User & { passwordHash: string })[]
      : defaults.users,
    workflows: Array.isArray(source.workflows)
      ? source.workflows as Workflow[]
      : defaults.workflows,
    executions: Array.isArray(source.executions)
      ? source.executions as WorkflowExecution[]
      : defaults.executions,
    nodeExecutions: Array.isArray(source.nodeExecutions)
      ? source.nodeExecutions as WorkflowNodeExecution[]
      : defaults.nodeExecutions,
    apiKeys: Array.isArray(source.apiKeys) ? source.apiKeys as APIKey[] : defaults.apiKeys,
    auditLogs: Array.isArray(source.auditLogs)
      ? source.auditLogs as AuditLog[]
      : defaults.auditLogs,
    dlq: Array.isArray(source.dlq) ? source.dlq as DeadLetterJob[] : defaults.dlq,
    workers: Array.isArray(source.workers) ? source.workers as WorkerInfo[] : defaults.workers,
  };
}

/**
 * Loads the JSON database. If the file is invalid, preserve a timestamped
 * copy before starting with an empty store.
 */
function initStorage(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(DB_FILE)) {
      store = createEmptyStore();
      return;
    }

    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const parsedData: unknown = JSON.parse(rawData);
    store = normalizeStore(parsedData);

    // Remove invalid and duplicate execution records from older database files.
    const seenExecutionIds = new Set<string>();
    store.executions = store.executions.filter((execution) => {
      if (!execution || typeof execution.id !== 'string' || !execution.id) return false;
      if (seenExecutionIds.has(execution.id)) return false;

      seenExecutionIds.add(execution.id);
      return true;
    });
  } catch (error) {
    console.error('Failed to load database file:', error);

    // Keep a recoverable copy instead of silently discarding a malformed file.
    if (fs.existsSync(DB_FILE)) {
      try {
        const backupFile = `${DB_FILE}.corrupt-${Date.now()}.bak`;
        fs.copyFileSync(DB_FILE, backupFile);
        console.error(`A backup of the invalid database was saved to: ${backupFile}`);
      } catch (backupError) {
        console.error('Could not back up the invalid database file:', backupError);
      }
    }

    store = createEmptyStore();
  }
}

/**
 * Writes to a temporary file first, then replaces db.json. This reduces the
 * chance of leaving a partially-written database if the process is interrupted.
 */
export function saveStorage(): void {
  let tempFile = '';

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    tempFile = `${DB_FILE}.${process.pid}.${randomUUID()}.tmp`;
    const serializedStore = JSON.stringify(store, null, 2);

    fs.writeFileSync(tempFile, serializedStore, {
      encoding: 'utf-8',
      flag: 'wx',
    });

    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Failed to write database file:', error);

    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.error('Failed to clean up temporary database file:', cleanupError);
      }
    }
  }
}

function emitChange(
  collection: string,
  operationType: 'insert' | 'update' | 'delete',
  document: unknown,
): void {
  dbEvents.emit('change', {
    collection,
    operationType,
    document,
  });
}

initStorage();

export const db = {
  getStore: () => store,

  tenants: {
    find: (filter: Partial<Tenant> = {}) => {
      return store.tenants.filter((tenant) => {
        for (const key of Object.keys(filter) as (keyof Tenant)[]) {
          if (filter[key] !== undefined && tenant[key] !== filter[key]) return false;
        }
        return true;
      });
    },

    findById: (id: string) => store.tenants.find((tenant) => tenant.id === id) || null,

    findOne: (filter: Partial<Tenant>) => {
      return store.tenants.find((tenant) => {
        for (const key of Object.keys(filter) as (keyof Tenant)[]) {
          if (filter[key] !== undefined && tenant[key] !== filter[key]) return false;
        }
        return true;
      }) || null;
    },

    create: (data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const tenant: Tenant = {
        ...data,
        id: createId('tenant'),
        createdAt: now,
        updatedAt: now,
      };

      store.tenants.push(tenant);
      saveStorage();
      emitChange('tenants', 'insert', tenant);
      return tenant;
    },

    update: (id: string, updates: Partial<Tenant>) => {
      const index = store.tenants.findIndex((tenant) => tenant.id === id);
      if (index === -1) return null;

      store.tenants[index] = {
        ...store.tenants[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
      };

      saveStorage();
      emitChange('tenants', 'update', store.tenants[index]);
      return store.tenants[index];
    },
  },

  users: {
    find: (filter: Partial<User & { passwordHash: string }> = {}) => {
      return store.users.filter((user) => {
        for (const key of Object.keys(filter) as (keyof (User & { passwordHash: string }))[]) {
          if (filter[key] !== undefined && user[key] !== filter[key]) return false;
        }
        return true;
      });
    },

    findById: (id: string) => store.users.find((user) => user.id === id) || null,

    findByEmail: (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      return store.users.find((user) => user.email.toLowerCase() === normalizedEmail) || null;
    },

    create: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { passwordHash: string }) => {
      const now = new Date().toISOString();
      const user: User & { passwordHash: string } = {
        ...data,
        id: createId('usr'),
        createdAt: now,
        updatedAt: now,
      };

      store.users.push(user);
      saveStorage();
      emitChange('users', 'insert', user);
      return user;
    },

    update: (id: string, updates: Partial<User & { passwordHash?: string }>) => {
      const index = store.users.findIndex((user) => user.id === id);
      if (index === -1) return null;

      store.users[index] = {
        ...store.users[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
      };

      saveStorage();
      emitChange('users', 'update', store.users[index]);
      return store.users[index];
    },
  },

  workflows: {
    find: (filter: { tenantId?: string; status?: string } = {}) => {
      return store.workflows.filter((workflow) => {
        if (filter.tenantId && workflow.tenantId !== filter.tenantId) return false;
        if (filter.status && workflow.status !== filter.status) return false;
        return true;
      });
    },

    findOne: (filter: { tenantId?: string; name?: string; status?: string } = {}) => {
      return store.workflows.find((workflow) => {
        if (filter.tenantId && workflow.tenantId !== filter.tenantId) return false;
        if (filter.name && workflow.name !== filter.name) return false;
        if (filter.status && workflow.status !== filter.status) return false;
        return true;
      }) || null;
    },

    findById: (id: string, tenantId?: string) => {
      const workflow = store.workflows.find((item) => item.id === id);
      if (!workflow) return null;
      if (tenantId && workflow.tenantId !== tenantId) return null;
      return workflow;
    },

    create: (
      data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number },
    ) => {
      const now = new Date().toISOString();
      const workflow: Workflow = {
        ...data,
        id: createId('wf'),
        version: data.version ?? 1,
        createdAt: now,
        updatedAt: now,
      };

      store.workflows.push(workflow);
      saveStorage();
      emitChange('workflows', 'insert', workflow);
      return workflow;
    },

    update: (id: string, tenantId: string, updates: Partial<Workflow>) => {
      const index = store.workflows.findIndex(
        (workflow) => workflow.id === id && workflow.tenantId === tenantId,
      );
      if (index === -1) return null;

      const current = store.workflows[index];
      store.workflows[index] = {
        ...current,
        ...updates,
        id: current.id,
        tenantId: current.tenantId,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };

      saveStorage();
      emitChange('workflows', 'update', store.workflows[index]);
      return store.workflows[index];
    },

    delete: (id: string, tenantId: string) => {
      const index = store.workflows.findIndex(
        (workflow) => workflow.id === id && workflow.tenantId === tenantId,
      );
      if (index === -1) return false;

      const removed = store.workflows.splice(index, 1)[0];
      saveStorage();
      emitChange('workflows', 'delete', removed);
      return true;
    },
  },

  executions: {
    find: (filter: { tenantId?: string; workflowId?: string; status?: string } = {}) => {
      return store.executions
        .filter((execution) => {
          if (filter.tenantId && execution.tenantId !== filter.tenantId) return false;
          if (filter.workflowId && execution.workflowId !== filter.workflowId) return false;
          if (filter.status && execution.status !== filter.status) return false;
          return true;
        })
        .sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        );
    },

    findById: (id: string, tenantId?: string) => {
      const execution = store.executions.find((item) => item.id === id);
      if (!execution) return null;
      if (tenantId && execution.tenantId !== tenantId) return null;
      return execution;
    },

    create: (data: Omit<WorkflowExecution, 'id'>) => {
      const execution: WorkflowExecution = {
        ...data,
        id: createId('exec'),
      };

      store.executions.push(execution);
      saveStorage();
      emitChange('executions', 'insert', execution);
      return execution;
    },

    update: (id: string, updates: Partial<WorkflowExecution>) => {
      const index = store.executions.findIndex((execution) => execution.id === id);
      if (index === -1) return null;

      store.executions[index] = {
        ...store.executions[index],
        ...updates,
        id,
        tenantId: store.executions[index].tenantId,
      };

      saveStorage();
      emitChange('executions', 'update', store.executions[index]);
      return store.executions[index];
    },
  },

  apiKeys: {
    find: (filter: { tenantId?: string } = {}) => {
      return store.apiKeys.filter((key) => {
        if (filter.tenantId && key.tenantId !== filter.tenantId) return false;
        return true;
      });
    },

    findById: (id: string, tenantId?: string) => {
      const key = store.apiKeys.find((item) => item.id === id);
      if (!key) return null;
      if (tenantId && key.tenantId !== tenantId) return null;
      return key;
    },

    findByHash: (hash: string) => {
      return store.apiKeys.find((key) => key.keyHash === hash && !key.revokedAt) || null;
    },

    create: (data: Omit<APIKey, 'id' | 'createdAt'>) => {
      const apiKey: APIKey = {
        ...data,
        id: createId('key'),
        createdAt: new Date().toISOString(),
      };

      store.apiKeys.push(apiKey);
      saveStorage();
      emitChange('apiKeys', 'insert', apiKey);
      return apiKey;
    },

    revoke: (id: string, tenantId: string) => {
      const key = store.apiKeys.find((item) => item.id === id && item.tenantId === tenantId);
      if (!key) return null;

      key.revokedAt = new Date().toISOString();
      saveStorage();
      emitChange('apiKeys', 'update', key);
      return key;
    },

    updateLastUsed: (id: string) => {
      const key = store.apiKeys.find((item) => item.id === id);
      if (!key) return;

      key.lastUsedAt = new Date().toISOString();
      saveStorage();
      emitChange('apiKeys', 'update', key);
    },
  },

  auditLogs: {
    find: (filter: { tenantId?: string; action?: string; limit?: number } = {}) => {
      let logs = store.auditLogs.filter((log) => {
        if (filter.tenantId && log.tenantId !== filter.tenantId) return false;
        if (filter.action && log.action !== filter.action) return false;
        return true;
      });

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (filter.limit !== undefined && Number.isFinite(filter.limit)) {
        logs = logs.slice(0, Math.max(0, Math.floor(filter.limit)));
      }

      return logs;
    },

    create: (data: Omit<AuditLog, 'id' | 'timestamp'>) => {
      const log: AuditLog = {
        ...data,
        id: createId('audit'),
        timestamp: new Date().toISOString(),
      };

      store.auditLogs.push(log);
      saveStorage();
      emitChange('auditLogs', 'insert', log);
      return log;
    },
  },

  dlq: {
    find: (filter: { tenantId?: string; status?: string } = {}) => {
      return store.dlq
        .filter((job) => {
          if (filter.tenantId && job.tenantId !== filter.tenantId) return false;
          if (filter.status && job.status !== filter.status) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    findById: (id: string, tenantId?: string) => {
      const job = store.dlq.find((item) => item.id === id);
      if (!job) return null;
      if (tenantId && job.tenantId !== tenantId) return null;
      return job;
    },

    create: (data: Omit<DeadLetterJob, 'id' | 'createdAt'>) => {
      const job: DeadLetterJob = {
        ...data,
        id: createId('dlq'),
        createdAt: new Date().toISOString(),
      };

      store.dlq.push(job);
      saveStorage();
      emitChange('dlq', 'insert', job);
      return job;
    },

    update: (id: string, tenantId: string, updates: Partial<DeadLetterJob>) => {
      const job = store.dlq.find((item) => item.id === id && item.tenantId === tenantId);
      if (!job) return null;

      Object.assign(job, updates, { id, tenantId });
      saveStorage();
      emitChange('dlq', 'update', job);
      return job;
    },

    delete: (id: string, tenantId: string) => {
      const index = store.dlq.findIndex((job) => job.id === id && job.tenantId === tenantId);
      if (index === -1) return false;

      const removed = store.dlq.splice(index, 1)[0];
      saveStorage();
      emitChange('dlq', 'delete', removed);
      return true;
    },
  },

  workers: {
    list: () => store.workers,

    get: (id: string) => store.workers.find((worker) => worker.id === id) || null,

    upsert: (worker: WorkerInfo) => {
      const index = store.workers.findIndex((item) => item.id === worker.id);

      if (index >= 0) {
        store.workers[index] = worker;
        saveStorage();
        emitChange('workers', 'update', worker);
      } else {
        store.workers.push(worker);
        saveStorage();
        emitChange('workers', 'insert', worker);
      }
    },
  },

  save: saveStorage,
};
