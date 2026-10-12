import { WorkerInfo } from '../../src/types/index.ts';
import { db } from '../db.ts';
import { wsManager } from '../websocket.ts';

class WorkerPoolManager {
  private workers: Map<string, WorkerInfo> = new Map();

  constructor() {
    // Initialize standard distributed worker nodes
    this.registerWorker('worker-alpha-01', 'Worker Alpha (US-East)');
    this.registerWorker('worker-beta-02', 'Worker Beta (EU-Central)');
    this.registerWorker('worker-gamma-03', 'Worker Gamma (AP-South)');

    // Start background heartbeats & latency fluctuations
    setInterval(() => {
      this.heartbeatWorkers();
    }, 15000);
  }

  private registerWorker(id: string, name: string) {
    const worker: WorkerInfo = {
      id,
      name,
      status: 'IDLE',
      completedJobs: Math.floor(Math.random() * 20) + 10,
      failedJobs: Math.floor(Math.random() * 3),
      latencyMs: Math.floor(Math.random() * 25) + 12,
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };
    this.workers.set(id, worker);
    db.workers.upsert(worker);
  }

  public getAvailableWorker(): WorkerInfo | null {
    for (const worker of this.workers.values()) {
      if (worker.status === 'IDLE') {
        return worker;
      }
    }
    // Return worker with lowest load if none completely idle
    let best = Array.from(this.workers.values())[0];
    for (const w of this.workers.values()) {
      if (w.completedJobs < best.completedJobs) best = w;
    }
    return best || null;
  }

  public assignJob(workerId: string, jobId: string, executionId: string) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'BUSY';
    worker.currentJobId = jobId;
    worker.currentExecutionId = executionId;
    worker.lastHeartbeat = new Date().toISOString();
    db.workers.upsert(worker);
  }

  public releaseJob(workerId: string, success: boolean, durationMs: number) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'IDLE';
    worker.currentJobId = undefined;
    worker.currentExecutionId = undefined;
    if (success) {
      worker.completedJobs += 1;
    } else {
      worker.failedJobs += 1;
    }
    // Moving average latency
    worker.latencyMs = Math.round(worker.latencyMs * 0.7 + durationMs * 0.3);
    worker.lastHeartbeat = new Date().toISOString();
    db.workers.upsert(worker);
  }

  public getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  private heartbeatWorkers() {
    this.workers.forEach(w => {
      w.lastHeartbeat = new Date().toISOString();
      w.latencyMs = Math.max(5, Math.min(180, w.latencyMs + Math.floor(Math.random() * 9) - 4));
      db.workers.upsert(w);
    });

    wsManager.broadcast({
      type: 'WORKER_HEARTBEAT',
      tenantId: 'SUPER_ADMIN',
      data: this.getAllWorkers(),
      timestamp: new Date().toISOString(),
    });
  }
}

export const workerPool = new WorkerPoolManager();
