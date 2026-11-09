import { WorkerInfo } from '../../src/types/index.ts';
import { db } from '../db.ts';
import { wsManager } from '../websocket.ts';

const HEARTBEAT_INTERVAL_MS = 15_000;
const MIN_LATENCY_MS = 5;
const MAX_LATENCY_MS = 180;
const LATENCY_VARIATION = 4;
const LATENCY_WEIGHT_CURRENT = 0.7;
const LATENCY_WEIGHT_NEW = 0.3;

const DEFAULT_WORKERS = [
  {
    id: 'worker-alpha-01',
    name: 'Worker Alpha (US-East)',
  },
  {
    id: 'worker-beta-02',
    name: 'Worker Beta (EU-Central)',
  },
  {
    id: 'worker-gamma-03',
    name: 'Worker Gamma (AP-South)',
  },
] as const;

class WorkerPoolManager {
  private readonly workers = new Map<string, WorkerInfo>();
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.initializeWorkers();
    this.startHeartbeat();
  }

  /**
   * Register the default worker nodes when the pool starts.
   */
  private initializeWorkers(): void {
    for (const worker of DEFAULT_WORKERS) {
      this.registerWorker(worker.id, worker.name);
    }
  }

  /**
   * Create a worker with initial runtime statistics.
   */
  private registerWorker(id: string, name: string): void {
    const now = new Date().toISOString();

    const worker: WorkerInfo = {
      id,
      name,
      status: 'IDLE',
      completedJobs: this.randomInt(10, 29),
      failedJobs: this.randomInt(0, 2),
      latencyMs: this.randomInt(12, 36),
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      lastHeartbeat: now,
    };

    this.workers.set(id, worker);
    db.workers.upsert(worker);
  }

  /**
   * Return an idle worker first.
   * If every worker is busy, select the worker with the lowest
   * number of completed jobs as a simple load-balancing fallback.
   */
  public getAvailableWorker(): WorkerInfo | null {
    const workers = Array.from(this.workers.values());

    if (workers.length === 0) {
      return null;
    }

    const idleWorker = workers.find(worker => worker.status === 'IDLE');

    if (idleWorker) {
      return idleWorker;
    }

    return workers.reduce((best, worker) => {
      return worker.completedJobs < best.completedJobs ? worker : best;
    });
  }

  /**
   * Mark a worker as busy and associate it with the running job.
   */
  public assignJob(
    workerId: string,
    jobId: string,
    executionId: string,
  ): boolean {
    const worker = this.workers.get(workerId);

    if (!worker || worker.status !== 'IDLE') {
      return false;
    }

    worker.status = 'BUSY';
    worker.currentJobId = jobId;
    worker.currentExecutionId = executionId;
    worker.lastHeartbeat = new Date().toISOString();

    this.persistWorker(worker);

    return true;
  }

  /**
   * Release a worker after a job completes.
   * Updates success/failure counters and smooths latency using
   * a weighted moving average.
   */
  public releaseJob(
    workerId: string,
    success: boolean,
    durationMs: number,
  ): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      return false;
    }

    worker.status = 'IDLE';
    worker.currentJobId = undefined;
    worker.currentExecutionId = undefined;

    if (success) {
      worker.completedJobs += 1;
    } else {
      worker.failedJobs += 1;
    }

    worker.latencyMs = this.calculateLatency(
      worker.latencyMs,
      durationMs,
    );

    worker.lastHeartbeat = new Date().toISOString();

    this.persistWorker(worker);

    return true;
  }

  /**
   * Return a snapshot of all workers.
   */
  public getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(worker => ({
      ...worker,
    }));
  }

  /**
   * Start periodic worker health updates.
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.heartbeatWorkers();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Update heartbeat and simulated latency for every worker,
   * persist the latest state, then notify connected clients.
   */
  private heartbeatWorkers(): void {
    const timestamp = new Date().toISOString();

    for (const worker of this.workers.values()) {
      worker.lastHeartbeat = timestamp;
      worker.latencyMs = this.adjustLatency(worker.latencyMs);

      this.persistWorker(worker);
    }

    wsManager.broadcast({
      type: 'WORKER_HEARTBEAT',
      tenantId: 'SUPER_ADMIN',
      data: this.getAllWorkers(),
      timestamp,
    });
  }

  /**
   * Keep worker latency within realistic operational limits.
   */
  private adjustLatency(currentLatency: number): number {
    const change = this.randomInt(
      -LATENCY_VARIATION,
      LATENCY_VARIATION,
    );

    return Math.max(
      MIN_LATENCY_MS,
      Math.min(MAX_LATENCY_MS, currentLatency + change),
    );
  }

  /**
   * Calculate a smoothed latency value so one slow execution
   * does not immediately distort the worker's normal latency.
   */
  private calculateLatency(
    currentLatency: number,
    durationMs: number,
  ): number {
    const safeDuration = Math.max(0, durationMs);

    return Math.round(
      currentLatency * LATENCY_WEIGHT_CURRENT +
        safeDuration * LATENCY_WEIGHT_NEW,
    );
  }

  /**
   * Keep database persistence in one place so every worker update
   * follows the same path.
   */
  private persistWorker(worker: WorkerInfo): void {
    db.workers.upsert(worker);
  }

  /**
   * Generate an inclusive random integer.
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Stop the background heartbeat when the manager is no longer needed.
   * Useful for tests and controlled server shutdowns.
   */
  public shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}

export const workerPool = new WorkerPoolManager();