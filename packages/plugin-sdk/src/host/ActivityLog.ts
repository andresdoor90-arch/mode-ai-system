/**
 * Plugin activity log (security — Part E: auditing).
 *
 * Keeps a bounded, in-memory ring of {@link PluginActivityRecord}s AND forwards
 * each to the injected {@link PluginActivityLogger} (the app's real `ILogger` in
 * production). Every host-API call, lifecycle transition, permission denial,
 * resource-limit trip and plugin fault is recorded here, giving a complete
 * audit trail of what each plugin did.
 */
import {
  NULL_ACTIVITY_LOGGER,
  type PluginActivityLogger,
  type PluginActivityRecord,
  type PluginActivitySeverity,
} from '../contracts/activity';

export class ActivityLog {
  private readonly records: PluginActivityRecord[] = [];

  public constructor(
    private readonly logger: PluginActivityLogger = NULL_ACTIVITY_LOGGER,
    private readonly maxRecords = 1_000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Record an audited action and forward it to the logger sink. */
  public record(
    pluginId: string,
    action: string,
    severity: PluginActivitySeverity = 'info',
    detail?: Readonly<Record<string, unknown>>,
  ): PluginActivityRecord {
    const entry: PluginActivityRecord = {
      pluginId,
      action,
      severity,
      at: this.now().toISOString(),
      ...(detail !== undefined ? { detail } : {}),
    };
    this.records.push(entry);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
    const context = { plugin: pluginId, action, ...(detail ?? {}) };
    this.logger[severity](`plugin:${action}`, context);
    return entry;
  }

  /** All recorded actions, optionally filtered to one plugin. */
  public entries(pluginId?: string): readonly PluginActivityRecord[] {
    return pluginId === undefined
      ? [...this.records]
      : this.records.filter((r) => r.pluginId === pluginId);
  }

  /** Clear the in-memory ring (does not affect the forwarded logger). */
  public clear(): void {
    this.records.length = 0;
  }
}
