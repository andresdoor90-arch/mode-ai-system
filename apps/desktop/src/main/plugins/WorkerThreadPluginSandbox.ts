/**
 * Worker-Threads plugin sandbox (ADR-005) — the INTENDED production isolation.
 *
 * Implements the engine-agnostic `IPluginSandbox` from `@mas/plugin-sdk` by
 * running each plugin's code inside a dedicated Node Worker Thread with hard
 * `resourceLimits` (real memory ceiling), so a plugin cannot read host memory,
 * block the main process or exceed its budget. All host-API access is mediated
 * by a message-passing RPC bridge: the worker only ever holds a PROXY of the
 * capability-gated `HostApi`, never the real object, and contributions that
 * carry executable code (analyzers, importers, render engines) are themselves
 * proxied back into the worker on invocation.
 *
 * STATUS: CI/runtime-deferred. This adapter requires the Node `worker_threads`
 * runtime and a built worker entry; it is exercised in CI / at runtime, NOT in
 * the offline sandbox. The in-process `InProcessPluginSandbox` is the
 * offline-verified reference implementation of the same interface.
 */
import { Worker } from 'node:worker_threads';

import {
  type ExtensionContribution,
  type HostApi,
  type IPluginSandbox,
  type SandboxHandle,
  type SandboxOutcome,
  type SandboxRunInput,
} from '@mas/plugin-sdk';

/** Message envelopes exchanged between the host and a plugin worker. */
type HostBound =
  | { readonly type: 'activate' }
  | { readonly type: 'deactivate' }
  | { readonly type: 'host-call-result'; readonly callId: number; readonly ok: boolean; readonly value?: unknown; readonly error?: string }
  | { readonly type: 'contribution-invoke'; readonly invokeId: number; readonly contributionId: number; readonly method: string; readonly args: readonly unknown[] };

type WorkerBound =
  | { readonly type: 'ready' }
  | { readonly type: 'lifecycle-result'; readonly phase: 'activate' | 'deactivate'; readonly ok: boolean; readonly error?: string }
  | { readonly type: 'host-call'; readonly callId: number; readonly path: readonly string[]; readonly args: readonly unknown[] }
  | { readonly type: 'register'; readonly contributionId: number; readonly descriptor: SerializedContribution }
  | { readonly type: 'contribution-invoke-result'; readonly invokeId: number; readonly ok: boolean; readonly value?: unknown; readonly error?: string };

/** A contribution with its function members replaced by method-name markers. */
interface SerializedContribution {
  readonly data: Record<string, unknown>;
  readonly methods: readonly string[];
}

const DEFERRED = 'Worker plugin sandbox is runtime/CI-deferred in the offline build.';

class WorkerHandle implements SandboxHandle {
  private _faulted = false;
  private callSeq = 0;
  private invokeSeq = 0;
  private readonly pendingInvokes = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  public constructor(
    private readonly worker: Worker,
    private readonly host: HostApi,
    private readonly maxCallMs: number,
  ) {
    this.worker.on('message', (msg: WorkerBound) => void this.onMessage(msg));
    this.worker.on('error', () => {
      this._faulted = true;
    });
  }

  public get faulted(): boolean {
    return this._faulted;
  }

  public activate(): Promise<SandboxOutcome> {
    return this.runLifecycle('activate');
  }

  public deactivate(): Promise<SandboxOutcome> {
    return this.runLifecycle('deactivate');
  }

  public async dispose(): Promise<void> {
    await this.worker.terminate();
  }

  /** Run a lifecycle phase, containing any failure as a {@link SandboxOutcome}. */
  private runLifecycle(phase: 'activate' | 'deactivate'): Promise<SandboxOutcome> {
    const start = Date.now();
    return new Promise<SandboxOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this._faulted = true;
        resolve({ ok: false, error: new Error(`${phase} timed out`), durationMs: Date.now() - start });
      }, this.maxCallMs);

      const onMsg = (msg: WorkerBound): void => {
        if (msg.type === 'lifecycle-result' && msg.phase === phase) {
          clearTimeout(timer);
          this.worker.off('message', onMsg);
          if (!msg.ok) {
            this._faulted = true;
          }
          resolve({
            ok: msg.ok,
            ...(msg.ok ? {} : { error: new Error(msg.error ?? `${phase} failed`) }),
            durationMs: Date.now() - start,
          });
        }
      };
      this.worker.on('message', onMsg);
      this.post({ type: phase });
    });
  }

  /** Handle a message originating in the worker (host-call / register / invoke result). */
  private async onMessage(msg: WorkerBound): Promise<void> {
    if (msg.type === 'host-call') {
      await this.handleHostCall(msg.callId, msg.path, msg.args);
    } else if (msg.type === 'register') {
      this.handleRegister(msg.contributionId, msg.descriptor);
    } else if (msg.type === 'contribution-invoke-result') {
      const pending = this.pendingInvokes.get(msg.invokeId);
      if (pending !== undefined) {
        this.pendingInvokes.delete(msg.invokeId);
        if (msg.ok) pending.resolve(msg.value);
        else pending.reject(new Error(msg.error ?? 'contribution invocation failed'));
      }
    }
  }

  /** Invoke the real, capability-gated host method named by `path`. */
  private async handleHostCall(
    callId: number,
    path: readonly string[],
    args: readonly unknown[],
  ): Promise<void> {
    try {
      // Resolve a nested method (e.g. ["wardrobe", "listGarments"]).
      let target: unknown = this.host;
      for (let i = 0; i < path.length - 1; i += 1) {
        target = (target as Record<string, unknown>)[path[i] as string];
      }
      const method = (target as Record<string, unknown>)[path[path.length - 1] as string];
      const value = await (method as (...a: unknown[]) => unknown).apply(target, args as unknown[]);
      this.post({ type: 'host-call-result', callId, ok: true, value });
    } catch (error) {
      this.post({
        type: 'host-call-result',
        callId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Rebuild a contribution on the host side: data fields are cloned verbatim and
   * each declared method becomes an async proxy that round-trips into the worker.
   */
  private handleRegister(contributionId: number, descriptor: SerializedContribution): void {
    const contribution: Record<string, unknown> = { ...descriptor.data };
    for (const method of descriptor.methods) {
      contribution[method] = (...args: readonly unknown[]): Promise<unknown> =>
        this.invokeContribution(contributionId, method, args);
    }
    this.host.register(contribution as unknown as ExtensionContribution);
  }

  /** Proxy a contribution method call back into the worker and await its result. */
  private invokeContribution(
    contributionId: number,
    method: string,
    args: readonly unknown[],
  ): Promise<unknown> {
    const invokeId = (this.invokeSeq += 1);
    return new Promise<unknown>((resolve, reject) => {
      this.pendingInvokes.set(invokeId, { resolve, reject });
      this.post({ type: 'contribution-invoke', invokeId, contributionId, method, args });
    });
  }

  private post(message: HostBound): void {
    this.worker.postMessage(message);
  }
}

/** Worker-Threads implementation of the plugin sandbox port. */
export class WorkerThreadPluginSandbox implements IPluginSandbox {
  public readonly kind = 'worker-thread';

  /** Absolute path to the built worker entry module. */
  public constructor(private readonly workerEntry: string) {}

  public run(input: SandboxRunInput): Promise<SandboxHandle> {
    if (input.manifest.main === undefined) {
      return Promise.reject(new Error(`${DEFERRED} Plugin "${input.manifest.id}" has no "main".`));
    }
    const worker = new Worker(this.workerEntry, {
      workerData: { manifest: input.manifest, main: input.manifest.main },
      resourceLimits: {
        // Real memory ceiling — the isolation the in-process sandbox cannot give.
        maxOldGenerationSizeMb: input.limits.maxMemoryMb,
      },
    });
    return Promise.resolve(new WorkerHandle(worker, input.host, input.limits.maxCallMs));
  }
}
