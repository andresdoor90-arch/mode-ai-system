/**
 * In-process reference sandbox.
 *
 * Runs a plugin module DIRECTLY in the host process, wrapping every call to the
 * plugin's `activate`/`deactivate` so that:
 *  - a thrown error or rejected promise is CONTAINED (never propagated to the
 *    host) and marks the plugin as faulted, and
 *  - each call is bounded by the configured wall-clock time limit.
 *
 * This is the engine-agnostic implementation used by the unit tests and by
 * first-party bundled plugins. The intended production isolation — a
 * Worker-Threads adapter (ADR-005) — implements the same `IPluginSandbox`
 * interface in the desktop main process, so the manager and tests never depend
 * on spawning a real worker. Because the in-process sandbox shares the host
 * heap it does NOT provide true memory isolation; that is the Worker adapter's
 * job (and is enforced via `resourceLimits` there).
 */
import { PluginRuntimeError } from '../contracts/errors';
import {
  type IPluginSandbox,
  type SandboxHandle,
  type SandboxOutcome,
  type SandboxRunInput,
} from '../contracts/sandbox';
import { type PluginContext, type PluginModule } from '../contracts/plugin';
import { runWithTimeout } from './ResourceMeter';

class InProcessHandle implements SandboxHandle {
  private _faulted = false;

  public constructor(
    private readonly module: PluginModule,
    private readonly context: PluginContext,
    private readonly maxCallMs: number,
  ) {}

  public get faulted(): boolean {
    return this._faulted;
  }

  public activate(): Promise<SandboxOutcome> {
    return this.contain('activate', () => this.module.activate(this.context));
  }

  public deactivate(): Promise<SandboxOutcome> {
    return this.contain('deactivate', () =>
      this.module.deactivate ? this.module.deactivate() : undefined,
    );
  }

  public async dispose(): Promise<void> {
    // Nothing to release for an in-process module; the Worker adapter would
    // terminate its thread here.
  }

  /**
   * Run a plugin call with a timeout, converting ANY failure into a contained
   * {@link SandboxOutcome}. The host stays healthy regardless of what the
   * plugin does.
   */
  private async contain(
    label: string,
    fn: () => void | Promise<void>,
  ): Promise<SandboxOutcome> {
    const start = Date.now();
    try {
      await runWithTimeout(async () => {
        await fn();
      }, this.maxCallMs, this.context.manifest.id);
      return { ok: true, durationMs: Date.now() - start };
    } catch (cause) {
      this._faulted = true;
      const error =
        cause instanceof Error
          ? new PluginRuntimeError(
              `Plugin "${this.context.manifest.id}" threw during ${label}: ${cause.message}`,
              cause,
              this.context.manifest.id,
            )
          : new PluginRuntimeError(
              `Plugin "${this.context.manifest.id}" failed during ${label}.`,
              cause,
              this.context.manifest.id,
            );
      return { ok: false, error, durationMs: Date.now() - start };
    }
  }
}

export class InProcessPluginSandbox implements IPluginSandbox {
  public readonly kind = 'in-process';

  public run(input: SandboxRunInput): Promise<SandboxHandle> {
    if (input.module === undefined) {
      return Promise.reject(
        new PluginRuntimeError(
          'In-process sandbox requires a resolved module.',
          undefined,
          input.manifest.id,
        ),
      );
    }
    const context: PluginContext = { manifest: input.manifest, host: input.host };
    return Promise.resolve(new InProcessHandle(input.module, context, input.limits.maxCallMs));
  }
}
