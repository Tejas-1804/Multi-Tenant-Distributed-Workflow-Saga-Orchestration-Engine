
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

/* -------------------------------------------------------------------------- */
/* Change stream events                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Event emitter used to simulate MongoDB Change Streams.
 *
 * Consumers can subscribe to:
 *
 * dbEvents.on('change', (event) => {
 *   // handle database change
 * });
 */
export class DatabaseChangeStreamEmitter extends EventEmitter {}

export const dbEvents = new DatabaseChangeStreamEmitter();

/* -------------------------------------------------------------------------- */
/* Storage configuration                                                      */
/* -------------------------------------------------------------------------- */

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DATABASE_WRITE_ENCODING = 'utf-8';
const DATABASE_INDENT = 2;

/* -------------------------------------------------------------------------- */
/* Database types                                                             */
/* -------------------------------------------------------------------------- */

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

type CollectionName = keyof DatabaseStore;

type ChangeOperation = 'insert' | 'update' | 'delete';

interface DatabaseChangeEvent {
  collection: CollectionName;
  operationType: ChangeOperation;
  document: unknown;
}

/* -------------------------------------------------------------------------- */
/* Store initialization                                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Utility helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Creates collision-resistant IDs while preserving existing ID prefixes.
 */
function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Returns the current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Safely checks whether a value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns a defensive copy of a plain JSON-compatible value.
 *
 * This prevents callers from accidentally mutating the in-memory database
 * without going through the db API and persistence layer.
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Compares a filter against a document.
 *
 * Undefined filter values are ignored.
 */
function matchesFilter<T extends object>(
  document: T,
  filter: Partial<T>,
): boolean {
  for (const key of Object.keys(filter) as (keyof T)[]) {
    const expected = filter[key];

    if (expected !== undefined && document[key] !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Sorts records from newest to oldest based on an ISO timestamp.
 */
function sortNewestFirst<T>(
  records: T[],
  getTimestamp: (record: T) => string,
): T[] {
  return records.sort(
    (a, b) =>
      new Date(getTimestamp(b)).getTime() -
      new Date(getTimestamp(a)).getTime(),
  );
}

/* -------------------------------------------------------------------------- */
/* Store normalization                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes older database files and fills in collections that may have
 * been introduced in newer versions.
 *
 * Invalid collection values are replaced with empty arrays instead of
 * allowing malformed data to break the application.
 */
function normalizeStore(data: unknown): DatabaseStore {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error(
      'Database file must contain a JSON object.',
    );
  }

  const source = data as Record<string, unknown>;
  const defaults = createEmptyStore();

  return {
    tenants: Array.isArray(source.tenants)
      ? (source.tenants as Tenant[])
      : defaults.tenants,

    users: Array.isArray(source.users)
      ? (source.users as (User & {
          passwordHash: string;
        })[])
      : defaults.users,

    workflows: Array.isArray(source.workflows)
      ? (source.workflows as Workflow[])
      : defaults.workflows,

    executions: Array.isArray(source.executions)
      ? (source.executions as WorkflowExecution[])
      : defaults.executions,

    nodeExecutions: Array.isArray(source.nodeExecutions)
      ? (source.nodeExecutions as WorkflowNodeExecution[])
      : defaults.nodeExecutions,

    apiKeys: Array.isArray(source.apiKeys)
      ? (source.apiKeys as APIKey[])
      : defaults.apiKeys,

    auditLogs: Array.isArray(source.auditLogs)
      ? (source.auditLogs as AuditLog[])
      : defaults.auditLogs,

    dlq: Array.isArray(source.dlq)
      ? (source.dlq as DeadLetterJob[])
      : defaults.dlq,

    workers: Array.isArray(source.workers)
      ? (source.workers as WorkerInfo[])
      : defaults.workers,
  };
}

/**
 * Removes invalid or duplicate records from collections where IDs are
 * essential for reliable persistence.
 */
function sanitizeStore(data: DatabaseStore): DatabaseStore {
  const result = clone(data);

  const uniqueById = <T extends { id: string }>(
    records: T[],
  ): T[] => {
    const seen = new Set<string>();

    return records.filter((record) => {
      if (
        !record ||
        !isNonEmptyString(record.id)
      ) {
        return false;
      }

      if (seen.has(record.id)) {
        return false;
      }

      seen.add(record.id);
      return true;
    });
  };

  result.tenants = uniqueById(result.tenants);
  result.users = uniqueById(result.users);
  result.workflows = uniqueById(result.workflows);
  result.executions = uniqueById(result.executions);
  result.nodeExecutions = uniqueById(result.nodeExecutions);
  result.apiKeys = uniqueById(result.apiKeys);
  result.auditLogs = uniqueById(result.auditLogs);
  result.dlq = uniqueById(result.dlq);
  result.workers = uniqueById(result.workers);

  return result;
}

/* -------------------------------------------------------------------------- */
/* Storage loading                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Loads the JSON database.
 *
 * If the database file is invalid, a timestamped backup is created before
 * starting with a clean store.
 */
function initStorage(): void {
  try {
    fs.mkdirSync(DATA_DIR, {
      recursive: true,
    });

    if (!fs.existsSync(DB_FILE)) {
      store = createEmptyStore();
      return;
    }

    const rawData = fs.readFileSync(
      DB_FILE,
      DATABASE_WRITE_ENCODING,
    );

    if (!rawData.trim()) {
      throw new Error(
        'Database file is empty.',
      );
    }

    const parsedData: unknown =
      JSON.parse(rawData);

    store = sanitizeStore(
      normalizeStore(parsedData),
    );
  } catch (error) {
    console.error(
      'Failed to load database file:',
      error,
    );

    /*
     * Preserve the corrupted database before resetting.
     * This makes recovery and debugging possible.
     */
    if (fs.existsSync(DB_FILE)) {
      try {
        const backupFile =
          `${DB_FILE}.corrupt-${Date.now()}.bak`;

        fs.copyFileSync(
          DB_FILE,
          backupFile,
        );

        console.error(
          `A backup of the invalid database was saved to: ${backupFile}`,
        );
      } catch (backupError) {
        console.error(
          'Could not back up the invalid database file:',
          backupError,
        );
      }
    }

    store = createEmptyStore();
  }
}

/* -------------------------------------------------------------------------- */
/* Storage persistence                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Persists the current store.
 *
 * The database is serialized into a temporary file first. The temporary file
 * is then moved into place so an interrupted write is much less likely to
 * leave a partially-written JSON document.
 */
export function saveStorage(): void {
  let tempFile = '';

  try {
    fs.mkdirSync(DATA_DIR, {
      recursive: true,
    });

    tempFile =
      `${DB_FILE}.${process.pid}.${randomUUID()}.tmp`;

    const serializedStore =
      JSON.stringify(
        store,
        null,
        DATABASE_INDENT,
      );

    fs.writeFileSync(
      tempFile,
      serializedStore,
      {
        encoding: DATABASE_WRITE_ENCODING,
        flag: 'wx',
      },
    );

    /*
     * On some platforms replacing an existing file with renameSync can fail.
     * Remove the existing database only after the temporary file has been
     * successfully written.
     */
    if (fs.existsSync(DB_FILE)) {
      fs.rmSync(DB_FILE, {
        force: true,
      });
    }

    fs.renameSync(
      tempFile,
      DB_FILE,
    );
  } catch (error) {
    console.error(
      'Failed to write database file:',
      error,
    );

    if (
      tempFile &&
      fs.existsSync(tempFile)
    ) {
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.error(
          'Failed to clean up temporary database file:',
          cleanupError,
        );
      }
    }

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Change events                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Emits a database change event.
 */
function emitChange(
  collection: CollectionName,
  operationType: ChangeOperation,
  document: unknown,
): void {
  const event: DatabaseChangeEvent = {
    collection,
    operationType,
    document: clone(document),
  };

  dbEvents.emit(
    'change',
    event,
  );
}

/* -------------------------------------------------------------------------- */
/* Initialize database                                                        */
/* -------------------------------------------------------------------------- */

initStorage();

/* -------------------------------------------------------------------------- */
/* Database API                                                               */
/* -------------------------------------------------------------------------- */

export const db = {
  /**
   * Returns a defensive copy of the complete store.
   *
   * Callers cannot mutate the internal database directly.
   */
  getStore: (): DatabaseStore => {
    return clone(store);
  },

  /* ------------------------------------------------------------------------ */
  /* Tenants                                                                  */
  /* ------------------------------------------------------------------------ */

  tenants: {
    find: (
      filter: Partial<Tenant> = {},
    ): Tenant[] => {
      return clone(
        store.tenants.filter(
          (tenant) =>
            matchesFilter(
              tenant,
              filter,
            ),
        ),
      );
    },

    findById: (
      id: string,
    ): Tenant | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const tenant =
        store.tenants.find(
          (item) =>
            item.id === id,
        );

      return tenant
        ? clone(tenant)
        : null;
    },

    findOne: (
      filter: Partial<Tenant>,
    ): Tenant | null => {
      const tenant =
        store.tenants.find(
          (item) =>
            matchesFilter(
              item,
              filter,
            ),
        );

      return tenant
        ? clone(tenant)
        : null;
    },

    create: (
      data: Omit<
        Tenant,
        'id' | 'createdAt' | 'updatedAt'
      >,
    ): Tenant => {
      const timestamp = now();

      const tenant: Tenant = {
        ...clone(data),
        id: createId('tenant'),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.tenants.push(tenant);

      saveStorage();
      emitChange(
        'tenants',
        'insert',
        tenant,
      );

      return clone(tenant);
    },

    update: (
      id: string,
      updates: Partial<Tenant>,
    ): Tenant | null => {
      const index =
        store.tenants.findIndex(
          (tenant) =>
            tenant.id === id,
        );

      if (index === -1) {
        return null;
      }

      const current =
        store.tenants[index];

      store.tenants[index] = {
        ...current,
        ...clone(updates),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now(),
      };

      saveStorage();
      emitChange(
        'tenants',
        'update',
        store.tenants[index],
      );

      return clone(
        store.tenants[index],
      );
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Users                                                                    */
  /* ------------------------------------------------------------------------ */

  users: {
    find: (
      filter: Partial<
        User & {
          passwordHash: string;
        }
      > = {},
    ): (User & {
      passwordHash: string;
    })[] => {
      return clone(
        store.users.filter(
          (user) =>
            matchesFilter(
              user,
              filter,
            ),
        ),
      );
    },

    findById: (
      id: string,
    ): (User & {
      passwordHash: string;
    }) | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const user =
        store.users.find(
          (item) =>
            item.id === id,
        );

      return user
        ? clone(user)
        : null;
    },

    findByEmail: (
      email: string,
    ): (User & {
      passwordHash: string;
    }) | null => {
      if (!isNonEmptyString(email)) {
        return null;
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const user =
        store.users.find(
          (item) =>
            item.email
              .trim()
              .toLowerCase() ===
            normalizedEmail,
        );

      return user
        ? clone(user)
        : null;
    },

    create: (
      data: Omit<
        User,
        'id' | 'createdAt' | 'updatedAt'
      > & {
        passwordHash: string;
      },
    ): User & {
      passwordHash: string;
    } => {
      const timestamp = now();

      const user: User & {
        passwordHash: string;
      } = {
        ...clone(data),
        id: createId('usr'),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.users.push(user);

      saveStorage();
      emitChange(
        'users',
        'insert',
        user,
      );

      return clone(user);
    },

    update: (
      id: string,
      updates: Partial<
        User & {
          passwordHash?: string;
        }
      >,
    ): (User & {
      passwordHash: string;
    }) | null => {
      const index =
        store.users.findIndex(
          (user) =>
            user.id === id,
        );

      if (index === -1) {
        return null;
      }

      const current =
        store.users[index];

      store.users[index] = {
        ...current,
        ...clone(updates),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now(),
      };

      saveStorage();
      emitChange(
        'users',
        'update',
        store.users[index],
      );

      return clone(
        store.users[index],
      );
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Workflows                                                                */
  /* ------------------------------------------------------------------------ */

  workflows: {
    find: (
      filter: {
        tenantId?: string;
        status?: string;
      } = {},
    ): Workflow[] => {
      return clone(
        store.workflows.filter(
          (workflow) => {
            if (
              filter.tenantId &&
              workflow.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            if (
              filter.status &&
              workflow.status !==
                filter.status
            ) {
              return false;
            }

            return true;
          },
        ),
      );
    },

    findOne: (
      filter: {
        tenantId?: string;
        name?: string;
        status?: string;
      } = {},
    ): Workflow | null => {
      const workflow =
        store.workflows.find(
          (item) => {
            if (
              filter.tenantId &&
              item.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            if (
              filter.name &&
              item.name !==
                filter.name
            ) {
              return false;
            }

            if (
              filter.status &&
              item.status !==
                filter.status
            ) {
              return false;
            }

            return true;
          },
        );

      return workflow
        ? clone(workflow)
        : null;
    },

    findById: (
      id: string,
      tenantId?: string,
    ): Workflow | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const workflow =
        store.workflows.find(
          (item) =>
            item.id === id,
        );

      if (!workflow) {
        return null;
      }

      if (
        tenantId &&
        workflow.tenantId !==
          tenantId
      ) {
        return null;
      }

      return clone(workflow);
    },

    create: (
      data: Omit<
        Workflow,
        'id' |
        'createdAt' |
        'updatedAt' |
        'version'
      > & {
        version?: number;
      },
    ): Workflow => {
      const timestamp = now();

      const workflow: Workflow = {
        ...clone(data),
        id: createId('wf'),
        version:
          data.version ??
          1,
        createdAt:
          timestamp,
        updatedAt:
          timestamp,
      };

      store.workflows.push(
        workflow,
      );

      saveStorage();
      emitChange(
        'workflows',
        'insert',
        workflow,
      );

      return clone(workflow);
    },

    update: (
      id: string,
      tenantId: string,
      updates: Partial<Workflow>,
    ): Workflow | null => {
      const index =
        store.workflows.findIndex(
          (workflow) =>
            workflow.id === id &&
            workflow.tenantId ===
              tenantId,
        );

      if (index === -1) {
        return null;
      }

      const current =
        store.workflows[index];

      store.workflows[index] = {
        ...current,
        ...clone(updates),
        id: current.id,
        tenantId:
          current.tenantId,
        version:
          current.version + 1,
        createdAt:
          current.createdAt,
        updatedAt:
          now(),
      };

      saveStorage();
      emitChange(
        'workflows',
        'update',
        store.workflows[index],
      );

      return clone(
        store.workflows[index],
      );
    },

    delete: (
      id: string,
      tenantId: string,
    ): boolean => {
      const index =
        store.workflows.findIndex(
          (workflow) =>
            workflow.id === id &&
            workflow.tenantId ===
              tenantId,
        );

      if (index === -1) {
        return false;
      }

      const removed =
        store.workflows.splice(
          index,
          1,
        )[0];

      saveStorage();

      emitChange(
        'workflows',
        'delete',
        removed,
      );

      return true;
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Workflow executions                                                      */
  /* ------------------------------------------------------------------------ */

  executions: {
    find: (
      filter: {
        tenantId?: string;
        workflowId?: string;
        status?: string;
      } = {},
    ): WorkflowExecution[] => {
      const executions =
        store.executions.filter(
          (execution) => {
            if (
              filter.tenantId &&
              execution.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            if (
              filter.workflowId &&
              execution.workflowId !==
                filter.workflowId
            ) {
              return false;
            }

            if (
              filter.status &&
              execution.status !==
                filter.status
            ) {
              return false;
            }

            return true;
          },
        );

      return clone(
        sortNewestFirst(
          executions,
          (execution) =>
            execution.startedAt,
        ),
      );
    },

    findById: (
      id: string,
      tenantId?: string,
    ): WorkflowExecution | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const execution =
        store.executions.find(
          (item) =>
            item.id === id,
        );

      if (!execution) {
        return null;
      }

      if (
        tenantId &&
        execution.tenantId !==
          tenantId
      ) {
        return null;
      }

      return clone(execution);
    },

    create: (
      data: Omit<
        WorkflowExecution,
        'id'
      >,
    ): WorkflowExecution => {
      const execution: WorkflowExecution = {
        ...clone(data),
        id: createId('exec'),
      };

      store.executions.push(
        execution,
      );

      saveStorage();
      emitChange(
        'executions',
        'insert',
        execution,
      );

      return clone(execution);
    },

    update: (
      id: string,
      updates: Partial<WorkflowExecution>,
    ): WorkflowExecution | null => {
      const index =
        store.executions.findIndex(
          (execution) =>
            execution.id === id,
        );

      if (index === -1) {
        return null;
      }

      const current =
        store.executions[index];

      store.executions[index] = {
        ...current,
        ...clone(updates),
        id: current.id,
        tenantId:
          current.tenantId,
      };

      saveStorage();
      emitChange(
        'executions',
        'update',
        store.executions[index],
      );

      return clone(
        store.executions[index],
      );
    },
  },

  /* ------------------------------------------------------------------------ */
  /* API keys                                                                  */
  /* ------------------------------------------------------------------------ */

  apiKeys: {
    find: (
      filter: {
        tenantId?: string;
      } = {},
    ): APIKey[] => {
      return clone(
        store.apiKeys.filter(
          (key) => {
            if (
              filter.tenantId &&
              key.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            return true;
          },
        ),
      );
    },

    findById: (
      id: string,
      tenantId?: string,
    ): APIKey | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const key =
        store.apiKeys.find(
          (item) =>
            item.id === id,
        );

      if (!key) {
        return null;
      }

      if (
        tenantId &&
        key.tenantId !==
          tenantId
      ) {
        return null;
      }

      return clone(key);
    },

    findByHash: (
      hash: string,
    ): APIKey | null => {
      if (!isNonEmptyString(hash)) {
        return null;
      }

      const key =
        store.apiKeys.find(
          (item) =>
            item.keyHash ===
              hash &&
            !item.revokedAt,
        );

      return key
        ? clone(key)
        : null;
    },

    create: (
      data: Omit<
        APIKey,
        'id' |
        'createdAt'
      >,
    ): APIKey => {
      const apiKey: APIKey = {
        ...clone(data),
        id: createId('key'),
        createdAt: now(),
      };

      store.apiKeys.push(
        apiKey,
      );

      saveStorage();
      emitChange(
        'apiKeys',
        'insert',
        apiKey,
      );

      return clone(apiKey);
    },

    revoke: (
      id: string,
      tenantId: string,
    ): APIKey | null => {
      const key =
        store.apiKeys.find(
          (item) =>
            item.id === id &&
            item.tenantId ===
              tenantId,
        );

      if (!key) {
        return null;
      }

      /*
       * Revoking an already-revoked key keeps the original
       * revocation timestamp.
       */
      if (!key.revokedAt) {
        key.revokedAt = now();
      }

      saveStorage();

      emitChange(
        'apiKeys',
        'update',
        key,
      );

      return clone(key);
    },

    updateLastUsed: (
      id: string,
    ): APIKey | null => {
      const key =
        store.apiKeys.find(
          (item) =>
            item.id === id,
        );

      if (!key) {
        return null;
      }

      key.lastUsedAt = now();

      saveStorage();

      emitChange(
        'apiKeys',
        'update',
        key,
      );

      return clone(key);
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Audit logs                                                               */
  /* ------------------------------------------------------------------------ */

  auditLogs: {
    find: (
      filter: {
        tenantId?: string;
        action?: string;
        limit?: number;
      } = {},
    ): AuditLog[] => {
      let logs =
        store.auditLogs.filter(
          (log) => {
            if (
              filter.tenantId &&
              log.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            if (
              filter.action &&
              log.action !==
                filter.action
            ) {
              return false;
            }

            return true;
          },
        );

      logs = sortNewestFirst(
        logs,
        (log) =>
          log.timestamp,
      );

      if (
        filter.limit !==
          undefined &&
        Number.isFinite(
          filter.limit,
        )
      ) {
        logs = logs.slice(
          0,
          Math.max(
            0,
            Math.floor(
              filter.limit,
            ),
          ),
        );
      }

      return clone(logs);
    },

    create: (
      data: Omit<
        AuditLog,
        'id' |
        'timestamp'
      >,
    ): AuditLog => {
      const log: AuditLog = {
        ...clone(data),
        id: createId('audit'),
        timestamp: now(),
      };

      store.auditLogs.push(
        log,
      );

      saveStorage();
      emitChange(
        'auditLogs',
        'insert',
        log,
      );

      return clone(log);
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Dead-letter queue                                                        */
  /* ------------------------------------------------------------------------ */

  dlq: {
    find: (
      filter: {
        tenantId?: string;
        status?: string;
      } = {},
    ): DeadLetterJob[] => {
      const jobs =
        store.dlq.filter(
          (job) => {
            if (
              filter.tenantId &&
              job.tenantId !==
                filter.tenantId
            ) {
              return false;
            }

            if (
              filter.status &&
              job.status !==
                filter.status
            ) {
              return false;
            }

            return true;
          },
        );

      return clone(
        sortNewestFirst(
          jobs,
          (job) =>
            job.createdAt,
        ),
      );
    },

    findById: (
      id: string,
      tenantId?: string,
    ): DeadLetterJob | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const job =
        store.dlq.find(
          (item) =>
            item.id === id,
        );

      if (!job) {
        return null;
      }

      if (
        tenantId &&
        job.tenantId !==
          tenantId
      ) {
        return null;
      }

      return clone(job);
    },

    create: (
      data: Omit<
        DeadLetterJob,
        'id' |
        'createdAt'
      >,
    ): DeadLetterJob => {
      const job: DeadLetterJob = {
        ...clone(data),
        id: createId('dlq'),
        createdAt: now(),
      };

      store.dlq.push(job);

      saveStorage();
      emitChange(
        'dlq',
        'insert',
        job,
      );

      return clone(job);
    },

    update: (
      id: string,
      tenantId: string,
      updates: Partial<DeadLetterJob>,
    ): DeadLetterJob | null => {
      const job =
        store.dlq.find(
          (item) =>
            item.id === id &&
            item.tenantId ===
              tenantId,
        );

      if (!job) {
        return null;
      }

      Object.assign(
        job,
        clone(updates),
        {
          id: job.id,
          tenantId:
            job.tenantId,
        },
      );

      saveStorage();

      emitChange(
        'dlq',
        'update',
        job,
      );

      return clone(job);
    },

    delete: (
      id: string,
      tenantId: string,
    ): boolean => {
      const index =
        store.dlq.findIndex(
          (job) =>
            job.id === id &&
            job.tenantId ===
              tenantId,
        );

      if (index === -1) {
        return false;
      }

      const removed =
        store.dlq.splice(
          index,
          1,
        )[0];

      saveStorage();

      emitChange(
        'dlq',
        'delete',
        removed,
      );

      return true;
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Workers                                                                  */
  /* ------------------------------------------------------------------------ */

  workers: {
    list: (): WorkerInfo[] => {
      return clone(
        store.workers,
      );
    },

    get: (
      id: string,
    ): WorkerInfo | null => {
      if (!isNonEmptyString(id)) {
        return null;
      }

      const worker =
        store.workers.find(
          (item) =>
            item.id === id,
        );

      return worker
        ? clone(worker)
        : null;
    },

    upsert: (
      worker: WorkerInfo,
    ): WorkerInfo => {
      const incoming =
        clone(worker);

      if (
        !isNonEmptyString(
          incoming.id,
        )
      ) {
        throw new Error(
          'Worker ID is required.',
        );
      }

      const index =
        store.workers.findIndex(
          (item) =>
            item.id ===
              incoming.id,
        );

      if (index >= 0) {
        store.workers[index] =
          incoming;

        saveStorage();

        emitChange(
          'workers',
          'update',
          store.workers[index],
        );
      } else {
        store.workers.push(
          incoming,
        );

        saveStorage();

        emitChange(
          'workers',
          'insert',
          incoming,
        );
      }

      return clone(
        incoming,
      );
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Manual persistence                                                       */
  /* ------------------------------------------------------------------------ */

  save: saveStorage,
};
