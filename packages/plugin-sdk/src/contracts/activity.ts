/**
 * Plugin activity logging contract.
 *
 * Every plugin action that crosses the host boundary (an API call, a lifecycle
 * transition, a denied permission, a tripped limit, a fault) is audited. The
 * SDK defines a minimal logger port — `PluginActivityLogger` — that is
 * STRUCTURALLY compatible with the infrastructure `ILogger`, so the desktop
 * host can inject its real logger with no wrapper while the SDK stays free of
 * any infrastructure import.
 */

/** Severity of an activity record. */
export type PluginActivitySeverity = 'debug' | 'info' | 'warn' | 'error';

/** A single audited plugin action. */
export interface PluginActivityRecord {
  readonly pluginId: string;
  readonly action: string;
  readonly severity: PluginActivitySeverity;
  readonly at: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/**
 * Minimal structured logger port. The infrastructure `ILogger` satisfies this
 * shape, so `host.activityLog` can forward to the app's real logging sink.
 */
export interface PluginActivityLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

/** A no-op logger used as a safe default when the host supplies none. */
export const NULL_ACTIVITY_LOGGER: PluginActivityLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
