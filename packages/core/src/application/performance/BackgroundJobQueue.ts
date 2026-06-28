/**
 * Background job queue (Module 8).
 *
 * A small, dependency-free queue that processes work with a bounded concurrency
 * so heavy, deferrable tasks (thumbnail generation, embedding, background
 * removal once implemented) run off the interaction path without flooding the
 * machine. It is pure orchestration: a "job" is just an async function; the
 * queue never knows what the work does.
 */

export interface QueuedJob<T = unknown> {
  readonly id: string;
  readonly run: () => Promise<T>;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  readonly id: string;
  status: JobStatus;
  error?: unknown;
}

export interface BackgroundJobQueueOptions {
  /** Maximum jobs running at once. */
  readonly concurrency?: number;
  /** Invoked when a job rejects (defaults to swallowing so one failure is isolated). */
  readonly onError?: (id: string, error: unknown) => void;
}

/**
 * FIFO queue with bounded concurrency. `enqueue` returns a promise that settles
 * when that specific job finishes, while `onIdle` resolves when the whole queue
 * has drained — useful for tests and graceful shutdown.
 */
export class BackgroundJobQueue {
  private readonly pending: QueuedJob[] = [];
  private readonly records = new Map<string, JobRecord>();
  private active = 0;
  private readonly concurrency: number;
  private readonly onError: (id: string, error: unknown) => void;
  private idleResolvers: Array<() => void> = [];

  public constructor(options: BackgroundJobQueueOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 2));
    this.onError = options.onError ?? ((): void => {});
  }

  public get size(): number {
    return this.pending.length;
  }

  public get activeCount(): number {
    return this.active;
  }

  public statusOf(id: string): JobStatus | undefined {
    return this.records.get(id)?.status;
  }

  /** Enqueue a job. The returned promise settles when THIS job completes. */
  public enqueue<T>(job: QueuedJob<T>): Promise<T> {
    this.records.set(job.id, { id: job.id, status: 'pending' });
    return new Promise<T>((resolve, reject) => {
      const wrapped: QueuedJob<T> = {
        id: job.id,
        run: async () => {
          try {
            const value = await job.run();
            resolve(value);
            return value;
          } catch (error) {
            reject(error as Error);
            throw error;
          }
        },
      };
      this.pending.push(wrapped as QueuedJob);
      this.pump();
    });
  }

  /** Resolves once the queue is fully drained (nothing pending or running). */
  public onIdle(): Promise<void> {
    if (this.active === 0 && this.pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }

  private pump(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active += 1;
      const record = this.records.get(job.id);
      if (record) {
        record.status = 'running';
      }
      void job
        .run()
        .then(() => {
          if (record) {
            record.status = 'completed';
          }
        })
        .catch((error: unknown) => {
          if (record) {
            record.status = 'failed';
            record.error = error;
          }
          this.onError(job.id, error);
        })
        .finally(() => {
          this.active -= 1;
          if (this.pending.length > 0) {
            this.pump();
          } else if (this.active === 0) {
            const resolvers = this.idleResolvers;
            this.idleResolvers = [];
            for (const resolve of resolvers) {
              resolve();
            }
          }
        });
    }
  }
}
