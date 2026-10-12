import fs from 'fs';
import path from 'path';
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

// Event Emitter for MongoDB Change Streams simulation
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

let store: DatabaseStore = {
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

// Ensure storage directory
function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      store = JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read db file, initializing fresh store:', err);
  }
}

export function saveStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db file:', err);
  }
}

initStorage();

export const db = {
  getStore: () => store,

  tenants: {
    find: (filter: Partial<Tenant> = {}) => {
      return store.tenants.filter(t => {
        for (const key of Object.keys(filter) as (keyof Tenant)[]) {
          if (filter[key] !== undefined && t[key] !== filter[key]) return false;
        }
        return true;
      });
    },
    findById: (id: string) => store.tenants.find(t => t.id === id) || null,
    findOne: (filter: Partial<Tenant>) => {
      return store.tenants.find(t => {
        for (const key of Object.keys(filter) as (keyof Tenant)[]) {
          if (filter[key] !== undefined && t[key] !== filter[key]) return false;
        }
        return true;
      }) || null;
    },
    create: (data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => {
      const tenant: Tenant = {
        id: 'tenant_' + Math.random().toString(36).substring(2, 10),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.tenants.push(tenant);
      saveStorage();
      dbEvents.emit('change', { collection: 'tenants', operationType: 'insert', document: tenant });
      return tenant;
    },
    update: (id: string, updates: Partial<Tenant>) => {
      const idx = store.tenants.findIndex(t => t.id === id);
      if (idx === -1) return null;
      store.tenants[idx] = { ...store.tenants[idx], ...updates, updatedAt: new Date().toISOString() };
      saveStorage();
      dbEvents.emit('change', { collection: 'tenants', operationType: 'update', document: store.tenants[idx] });
      return store.tenants[idx];
    },
  },

  users: {
    find: (filter: Partial<User & { passwordHash: string }> = {}) => {
      return store.users.filter(u => {
        for (const key of Object.keys(filter) as (keyof (User & { passwordHash: string }))[]) {
          if (filter[key] !== undefined && u[key] !== filter[key]) return false;
        }
        return true;
      });
    },
    findById: (id: string) => store.users.find(u => u.id === id) || null,
    findByEmail: (email: string) => store.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null,
    create: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { passwordHash: string }) => {
      const user = {
        id: 'usr_' + Math.random().toString(36).substring(2, 10),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.users.push(user);
      saveStorage();
      dbEvents.emit('change', { collection: 'users', operationType: 'insert', document: user });
      return user;
    },
    update: (id: string, updates: Partial<User>) => {
      const idx = store.users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      store.users[idx] = { ...store.users[idx], ...updates, updatedAt: new Date().toISOString() };
      saveStorage();
      dbEvents.emit('change', { collection: 'users', operationType: 'update', document: store.users[idx] });
      return store.users[idx];
    },
  },

  workflows: {
    find: (filter: { tenantId?: string; status?: string } = {}) => {
      return store.workflows.filter(w => {
        if (filter.tenantId && w.tenantId !== filter.tenantId) return false;
        if (filter.status && w.status !== filter.status) return false;
        return true;
      });
    },
    findById: (id: string, tenantId?: string) => {
      const wf = store.workflows.find(w => w.id === id);
      if (!wf) return null;
      if (tenantId && wf.tenantId !== tenantId) return null; // Tenant isolation!
      return wf;
    },
    create: (data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number }) => {
      const workflow: Workflow = {
        id: 'wf_' + Math.random().toString(36).substring(2, 10),
        version: data.version || 1,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.workflows.push(workflow);
      saveStorage();
      dbEvents.emit('change', { collection: 'workflows', operationType: 'insert', document: workflow });
      return workflow;
    },
    update: (id: string, tenantId: string, updates: Partial<Workflow>) => {
      const idx = store.workflows.findIndex(w => w.id === id && w.tenantId === tenantId);
      if (idx === -1) return null;
      const current = store.workflows[idx];
      store.workflows[idx] = {
        ...current,
        ...updates,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
      saveStorage();
      dbEvents.emit('change', { collection: 'workflows', operationType: 'update', document: store.workflows[idx] });
      return store.workflows[idx];
    },
    delete: (id: string, tenantId: string) => {
      const idx = store.workflows.findIndex(w => w.id === id && w.tenantId === tenantId);
      if (idx === -1) return false;
      const removed = store.workflows.splice(idx, 1)[0];
      saveStorage();
      dbEvents.emit('change', { collection: 'workflows', operationType: 'delete', document: removed });
      return true;
    },
  },

  executions: {
    find: (filter: { tenantId?: string; workflowId?: string; status?: string } = {}) => {
      return store.executions.filter(e => {
        if (filter.tenantId && e.tenantId !== filter.tenantId) return false;
        if (filter.workflowId && e.workflowId !== filter.workflowId) return false;
        if (filter.status && e.status !== filter.status) return false;
        return true;
      }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    },
    findById: (id: string, tenantId?: string) => {
      const exec = store.executions.find(e => e.id === id);
      if (!exec) return null;
      if (tenantId && exec.tenantId !== tenantId) return null; // Tenant isolation!
      return exec;
    },
    create: (data: Omit<WorkflowExecution, 'id'>) => {
      const exec: WorkflowExecution = {
        id: 'exec_' + Math.random().toString(36).substring(2, 10),
        ...data,
      };
      store.executions.push(exec);
      saveStorage();
      dbEvents.emit('change', { collection: 'executions', operationType: 'insert', document: exec });
      return exec;
    },
    update: (id: string, updates: Partial<WorkflowExecution>) => {
      const idx = store.executions.findIndex(e => e.id === id);
      if (idx === -1) return null;
      store.executions[idx] = { ...store.executions[idx], ...updates };
      saveStorage();
      dbEvents.emit('change', { collection: 'executions', operationType: 'update', document: store.executions[idx] });
      return store.executions[idx];
    },
  },

  apiKeys: {
    find: (filter: { tenantId?: string } = {}) => {
      return store.apiKeys.filter(k => {
        if (filter.tenantId && k.tenantId !== filter.tenantId) return false;
        return true;
      });
    },
    findById: (id: string, tenantId?: string) => {
      const key = store.apiKeys.find(k => k.id === id);
      if (!key) return null;
      if (tenantId && key.tenantId !== tenantId) return null;
      return key;
    },
    findByHash: (hash: string) => {
      return store.apiKeys.find(k => k.keyHash === hash && !k.revokedAt) || null;
    },
    create: (data: Omit<APIKey, 'id' | 'createdAt'>) => {
      const apiKey: APIKey = {
        id: 'key_' + Math.random().toString(36).substring(2, 10),
        ...data,
        createdAt: new Date().toISOString(),
      };
      store.apiKeys.push(apiKey);
      saveStorage();
      return apiKey;
    },
    revoke: (id: string, tenantId: string) => {
      const key = store.apiKeys.find(k => k.id === id && k.tenantId === tenantId);
      if (!key) return null;
      key.revokedAt = new Date().toISOString();
      saveStorage();
      return key;
    },
    updateLastUsed: (id: string) => {
      const key = store.apiKeys.find(k => k.id === id);
      if (key) {
        key.lastUsedAt = new Date().toISOString();
        saveStorage();
      }
    },
  },

  auditLogs: {
    find: (filter: { tenantId?: string; action?: string; limit?: number } = {}) => {
      let logs = store.auditLogs.filter(a => {
        if (filter.tenantId && a.tenantId !== filter.tenantId) return false;
        if (filter.action && a.action !== filter.action) return false;
        return true;
      });
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (filter.limit) {
        logs = logs.slice(0, filter.limit);
      }
      return logs;
    },
    create: (data: Omit<AuditLog, 'id' | 'timestamp'>) => {
      const log: AuditLog = {
        id: 'audit_' + Math.random().toString(36).substring(2, 10),
        ...data,
        timestamp: new Date().toISOString(),
      };
      store.auditLogs.push(log);
      saveStorage();
      return log;
    },
  },

  dlq: {
    find: (filter: { tenantId?: string; status?: string } = {}) => {
      return store.dlq.filter(d => {
        if (filter.tenantId && d.tenantId !== filter.tenantId) return false;
        if (filter.status && d.status !== filter.status) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    findById: (id: string, tenantId?: string) => {
      const job = store.dlq.find(d => d.id === id);
      if (!job) return null;
      if (tenantId && job.tenantId !== tenantId) return null;
      return job;
    },
    create: (data: Omit<DeadLetterJob, 'id' | 'createdAt'>) => {
      const job: DeadLetterJob = {
        id: 'dlq_' + Math.random().toString(36).substring(2, 10),
        ...data,
        createdAt: new Date().toISOString(),
      };
      store.dlq.push(job);
      saveStorage();
      dbEvents.emit('change', { collection: 'dlq', operationType: 'insert', document: job });
      return job;
    },
    update: (id: string, tenantId: string, updates: Partial<DeadLetterJob>) => {
      const job = store.dlq.find(d => d.id === id && d.tenantId === tenantId);
      if (!job) return null;
      Object.assign(job, updates);
      saveStorage();
      return job;
    },
    delete: (id: string, tenantId: string) => {
      const idx = store.dlq.findIndex(d => d.id === id && d.tenantId === tenantId);
      if (idx === -1) return false;
      store.dlq.splice(idx, 1);
      saveStorage();
      return true;
    },
  },

  workers: {
    list: () => store.workers,
    get: (id: string) => store.workers.find(w => w.id === id) || null,
    upsert: (worker: WorkerInfo) => {
      const idx = store.workers.findIndex(w => w.id === worker.id);
      if (idx >= 0) {
        store.workers[idx] = worker;
      } else {
        store.workers.push(worker);
      }
      saveStorage();
    },
  },
};
