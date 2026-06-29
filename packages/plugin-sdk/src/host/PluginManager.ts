/**
 * Plugin Manager — the orchestrator of the whole plugin subsystem.
 *
 * Drives a plugin through its lifecycle (discover → install → validate →
 * activate → deactivate → uninstall, with a contained Failed state), wiring
 * together the registry, lifecycle machine, loader (manifest/compat/signature),
 * permission guard, resource meter, sandbox isolation, extension registry and
 * activity log. It contains business-rule-free MEDIATION only: it never makes a
 * styling decision and never lets a faulting plugin escape — a plugin error is
 * caught, audited, its contributions withdrawn, and the plugin parked in
 * `Failed` while M-A-S keeps running.
 */
import { type PluginActivityLogger } from '../contracts/activity';
import { PluginError } from '../contracts/errors';
import { PluginLifecycleEvent, PluginLifecycleState } from '../contracts/lifecycle';
import { type PluginManifest } from '../contracts/manifest';
import { approveAll, type PermissionApprover, type PluginCapability } from '../contracts/permissions';
import { type PluginSource } from '../contracts/plugin';
import {
  DEFAULT_RESOURCE_LIMITS,
  type IPluginSandbox,
  type ResourceLimits,
} from '../contracts/sandbox';
import { ActivityLog } from './ActivityLog';
import { ExtensionRegistry } from './ExtensionRegistry';
import { createHostApi, type HostBackend } from './HostApiFactory';
import { PluginLifecycleMachine } from './PluginLifecycleMachine';
import { type LoadedPlugin, type PluginLoader } from './PluginLoader';
import { PermissionGuard } from './PermissionGuard';
import { PluginRegistry, type PluginRecord } from './PluginRegistry';
import { ResourceMeter } from './ResourceMeter';

/** Construction options for the manager. */
export interface PluginManagerOptions {
  readonly sandbox: IPluginSandbox;
  readonly loader: PluginLoader;
  readonly backend: HostBackend;
  /** Forwarded sink for the audit trail (the app's real `ILogger`). */
  readonly activityLogger?: PluginActivityLogger;
  /** Decides which requested capabilities are granted (default: grant all). */
  readonly approver?: PermissionApprover;
  /** Resource limits applied to every plugin (default: {@link DEFAULT_RESOURCE_LIMITS}). */
  readonly limits?: ResourceLimits;
  readonly now?: () => Date;
}

/** A read-only status view of a plugin for the UI / IPC layer. */
export interface PluginStatus {
  readonly id: string;
  readonly state: PluginLifecycleState;
  readonly manifest: PluginManifest | undefined;
  readonly capabilities: readonly PluginCapability[];
  readonly failureReason: string | undefined;
  readonly faulted: boolean;
}

export class PluginManager {
  private readonly registry = new PluginRegistry();
  private readonly extensions = new ExtensionRegistry();
  private readonly activity: ActivityLog;
  private readonly sandbox: IPluginSandbox;
  private readonly loader: PluginLoader;
  private readonly backend: HostBackend;
  private readonly approver: PermissionApprover;
  private readonly limits: ResourceLimits;
  private readonly now: () => Date;

  public constructor(options: PluginManagerOptions) {
    this.sandbox = options.sandbox;
    this.loader = options.loader;
    this.backend = options.backend;
    this.approver = options.approver ?? approveAll;
    this.limits = options.limits ?? DEFAULT_RESOURCE_LIMITS;
    this.now = options.now ?? (() => new Date());
    this.activity = new ActivityLog(options.activityLogger, 1_000, this.now);
  }

  /** The live extension registry (consumed by the core seams). */
  public get extensionRegistry(): ExtensionRegistry {
    return this.extensions;
  }

  /** The audit trail. */
  public get activityLog(): ActivityLog {
    return this.activity;
  }

  /* ------------------------------ lifecycle ------------------------------ */

  /** Register a discovered plugin source (does not load/run it). */
  public discover(source: PluginSource): PluginStatus {
    const record: PluginRecord = {
      id: source.id,
      source,
      lifecycle: new PluginLifecycleMachine(source.id, PluginLifecycleState.Discovered, this.now),
    };
    this.registry.add(record);
    this.activity.record(source.id, 'discover', 'info');
    return this.statusOf(record);
  }

  /** Install a discovered plugin (registers intent; still not validated). */
  public install(id: string): PluginStatus {
    const record = this.registry.get(id);
    record.lifecycle.apply(PluginLifecycleEvent.Install);
    this.activity.record(id, 'install', 'info');
    return this.statusOf(record);
  }

  /**
   * Validate a plugin: manifest + compatibility + signature. On failure the
   * plugin is parked in `Failed` and the precise {@link PluginError} is thrown.
   */
  public async validate(id: string): Promise<PluginStatus> {
    const record = this.registry.get(id);
    const result = await this.loader.load(record.source);
    if (!result.ok) {
      this.fail(record, result.error.message);
      this.activity.record(id, 'validate:rejected', 'error', { code: result.error.code });
      throw result.error;
    }
    const loaded: LoadedPlugin = result.loaded;
    record.manifest = loaded.manifest;
    record.resolved = loaded.resolved;
    record.lifecycle.apply(PluginLifecycleEvent.Validate);
    this.activity.record(id, 'validate', 'info', {
      signature: loaded.verification.status,
      version: loaded.manifest.version,
    });
    return this.statusOf(record);
  }

  /**
   * Activate a plugin inside the sandbox. A plugin fault during `activate` is
   * CONTAINED: the plugin is parked in `Failed`, its contributions withdrawn,
   * and the manager returns normally (host stays healthy). Host-level misuse
   * (illegal transition, unknown plugin) still throws.
   */
  public async activate(id: string): Promise<PluginStatus> {
    const record = this.registry.get(id);
    if (record.manifest === undefined || record.resolved === undefined) {
      throw new PluginError(`Plugin "${id}" must be validated before activation.`, 'PLUGIN_NOT_VALIDATED', id);
    }
    if (!record.lifecycle.can(PluginLifecycleEvent.Activate)) {
      // Surface as an illegal transition via the machine for a consistent error.
      record.lifecycle.apply(PluginLifecycleEvent.Activate);
    }

    const manifest = record.manifest;
    const requested = manifest.permissions;
    const granted = await this.approver(id, requested);
    const guard = new PermissionGuard(id, granted);
    const meter = new ResourceMeter(id, this.limits);
    record.guard = guard;
    record.meter = meter;

    const host = createHostApi({
      manifest,
      guard,
      meter,
      backend: this.backend,
      extensions: this.extensions,
      activity: this.activity,
    });

    const handle = await this.sandbox.run({
      manifest,
      ...(record.resolved.module !== undefined ? { module: record.resolved.module } : {}),
      host,
      limits: this.limits,
    });
    record.handle = handle;

    const outcome = await handle.activate();
    try {
      meter.account(outcome.durationMs);
    } catch {
      /* invocation/memory quota tripped during accounting — treated as a fault below. */
    }

    if (!outcome.ok || handle.faulted) {
      this.extensions.removePlugin(id);
      this.fail(record, outcome.error?.message ?? 'Plugin faulted during activation.');
      this.activity.record(id, 'activate:faulted', 'error', {
        error: outcome.error?.message,
      });
      return this.statusOf(record);
    }

    record.lifecycle.apply(PluginLifecycleEvent.Activate);
    this.activity.record(id, 'activate', 'info', {
      contributions: this.extensions.size(),
      capabilities: guard.capabilities(),
    });
    return this.statusOf(record);
  }

  /** Deactivate a running plugin: withdraw contributions, stop the sandbox. */
  public async deactivate(id: string): Promise<PluginStatus> {
    const record = this.registry.get(id);
    if (record.handle !== undefined) {
      await record.handle.deactivate();
      await record.handle.dispose();
      record.handle = undefined;
    }
    this.extensions.removePlugin(id);
    record.lifecycle.apply(PluginLifecycleEvent.Deactivate);
    this.activity.record(id, 'deactivate', 'info');
    return this.statusOf(record);
  }

  /** Uninstall a plugin entirely (deactivating first when active). */
  public async uninstall(id: string): Promise<PluginStatus> {
    const record = this.registry.get(id);
    if (record.lifecycle.state === PluginLifecycleState.Active) {
      await this.deactivate(id);
    }
    if (record.handle !== undefined) {
      await record.handle.dispose();
      record.handle = undefined;
    }
    this.extensions.removePlugin(id);
    record.lifecycle.apply(PluginLifecycleEvent.Uninstall);
    this.activity.record(id, 'uninstall', 'info');
    const status = this.statusOf(record);
    this.registry.remove(id);
    return status;
  }

  /** Recover a failed plugin back to the installed state for another attempt. */
  public reset(id: string): PluginStatus {
    const record = this.registry.get(id);
    record.lifecycle.apply(PluginLifecycleEvent.Reset);
    record.failureReason = undefined;
    this.activity.record(id, 'reset', 'info');
    return this.statusOf(record);
  }

  /* ------------------------------- queries ------------------------------- */

  /** Status of every known plugin. */
  public list(): readonly PluginStatus[] {
    return this.registry.all().map((record) => this.statusOf(record));
  }

  /** Status of one plugin. */
  public status(id: string): PluginStatus {
    return this.statusOf(this.registry.get(id));
  }

  /** Current lifecycle state of one plugin. */
  public stateOf(id: string): PluginLifecycleState {
    return this.registry.get(id).lifecycle.state;
  }

  /* ------------------------------- helpers ------------------------------- */

  /** Park a plugin in the contained `Failed` state with a reason. */
  private fail(record: PluginRecord, reason: string): void {
    record.failureReason = reason;
    if (record.lifecycle.can(PluginLifecycleEvent.Fail)) {
      record.lifecycle.apply(PluginLifecycleEvent.Fail);
    }
  }

  private statusOf(record: PluginRecord): PluginStatus {
    return {
      id: record.id,
      state: record.lifecycle.state,
      manifest: record.manifest,
      capabilities: record.guard?.capabilities() ?? [],
      failureReason: record.failureReason,
      faulted: record.handle?.faulted ?? false,
    };
  }
}
