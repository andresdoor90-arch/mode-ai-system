/**
 * Plugin registry — the authoritative table of known plugins.
 *
 * Stores one {@link PluginRecord} per plugin id, rejecting duplicate ids and
 * surfacing not-found lookups as typed errors. The {@link PluginManager} owns
 * the records' lifecycle; the registry is the lookup/index it builds on.
 */
import { DuplicatePluginError, PluginNotFoundError } from '../contracts/errors';
import { type PluginManifest } from '../contracts/manifest';
import { type PluginSource, type ResolvedPlugin } from '../contracts/plugin';
import { type SandboxHandle } from '../contracts/sandbox';
import { type PluginLifecycleMachine } from './PluginLifecycleMachine';
import { type PermissionGuard } from './PermissionGuard';
import { type ResourceMeter } from './ResourceMeter';

/** Everything the host tracks about one plugin. */
export interface PluginRecord {
  readonly id: string;
  readonly source: PluginSource;
  readonly lifecycle: PluginLifecycleMachine;
  /** Populated once the source has been resolved. */
  manifest?: PluginManifest | undefined;
  resolved?: ResolvedPlugin | undefined;
  guard?: PermissionGuard | undefined;
  meter?: ResourceMeter | undefined;
  handle?: SandboxHandle | undefined;
  /** A human-readable reason when the plugin is in the Failed state. */
  failureReason?: string | undefined;
}

export class PluginRegistry {
  private readonly records = new Map<string, PluginRecord>();

  /** Register a brand-new record; throws on duplicate id. */
  public add(record: PluginRecord): PluginRecord {
    if (this.records.has(record.id)) {
      throw new DuplicatePluginError(record.id);
    }
    this.records.set(record.id, record);
    return record;
  }

  /** Whether a plugin id is known. */
  public has(id: string): boolean {
    return this.records.has(id);
  }

  /** Look up a record, returning `undefined` when absent. */
  public find(id: string): PluginRecord | undefined {
    return this.records.get(id);
  }

  /** Look up a record, throwing {@link PluginNotFoundError} when absent. */
  public get(id: string): PluginRecord {
    const record = this.records.get(id);
    if (record === undefined) {
      throw new PluginNotFoundError(id);
    }
    return record;
  }

  /** Remove a record entirely (after uninstall). */
  public remove(id: string): void {
    this.records.delete(id);
  }

  /** All records, in insertion order. */
  public all(): readonly PluginRecord[] {
    return [...this.records.values()];
  }

  /** Number of registered plugins. */
  public get size(): number {
    return this.records.size;
  }
}
