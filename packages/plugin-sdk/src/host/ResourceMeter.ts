/**
 * Resource accounting & limit enforcement (security — Part E).
 *
 * Tracks per-plugin usage — cumulative wall-clock time, invocation count and an
 * advisory memory estimate — and enforces the {@link ResourceLimits}. The
 * sandbox uses {@link runWithTimeout} so a single runaway call is bounded, and
 * {@link account} keeps a running tally the host can inspect or throttle on.
 *
 * Pure and offline-testable: no worker is needed to prove that a slow call is
 * aborted and that exceeding the invocation/memory quota raises
 * {@link ResourceLimitExceededError}.
 */
import { ResourceLimitExceededError } from '../contracts/errors';
import { type ResourceLimits } from '../contracts/sandbox';

/** A snapshot of one plugin's resource usage. */
export interface ResourceUsage {
  readonly invocations: number;
  readonly totalMs: number;
  readonly peakMemoryMb: number;
  readonly throttled: boolean;
}

/**
 * Run a promise-returning function with a wall-clock timeout. Rejects with a
 * {@link ResourceLimitExceededError} if it does not settle in time. The losing
 * work is abandoned (the host contains it); the timer never keeps the event
 * loop alive.
 */
export const runWithTimeout = async <T>(
  fn: () => Promise<T> | T,
  maxMs: number,
  pluginId?: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new ResourceLimitExceededError(
          'time',
          `Plugin call exceeded the ${maxMs}ms time limit.`,
          pluginId,
        ),
      );
    }, maxMs);
    if (typeof timer === 'object' && 'unref' in timer) {
      (timer as { unref: () => void }).unref();
    }
  });
  try {
    return await Promise.race([Promise.resolve().then(fn), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

/** Accounts resource usage for a single plugin against its limits. */
export class ResourceMeter {
  private invocations = 0;
  private totalMs = 0;
  private peakMemoryMb = 0;
  private _throttled = false;

  public constructor(
    public readonly pluginId: string,
    public readonly limits: ResourceLimits,
  ) {}

  /** Current usage snapshot. */
  public usage(): ResourceUsage {
    return {
      invocations: this.invocations,
      totalMs: this.totalMs,
      peakMemoryMb: this.peakMemoryMb,
      throttled: this._throttled,
    };
  }

  /** Whether the plugin has been throttled (quota exhausted). */
  public get throttled(): boolean {
    return this._throttled;
  }

  /**
   * Record one completed call. Throws {@link ResourceLimitExceededError} if the
   * invocation quota is now exhausted (and marks the plugin throttled), so the
   * caller stops issuing further work.
   */
  public account(durationMs: number, memoryMb = 0): void {
    this.invocations += 1;
    this.totalMs += Math.max(0, durationMs);
    this.peakMemoryMb = Math.max(this.peakMemoryMb, memoryMb);

    if (memoryMb > this.limits.maxMemoryMb) {
      throw new ResourceLimitExceededError(
        'memory',
        `Plugin used ${memoryMb}MB, exceeding the ${this.limits.maxMemoryMb}MB limit.`,
        this.pluginId,
      );
    }
    if (this.invocations > this.limits.maxInvocations) {
      this._throttled = true;
      throw new ResourceLimitExceededError(
        'invocations',
        `Plugin exceeded its ${this.limits.maxInvocations} invocation quota.`,
        this.pluginId,
      );
    }
  }

  /** Pre-flight guard: reject a call when the plugin is already throttled. */
  public ensureNotThrottled(): void {
    if (this._throttled) {
      throw new ResourceLimitExceededError(
        'invocations',
        'Plugin is throttled after exceeding its invocation quota.',
        this.pluginId,
      );
    }
  }
}
