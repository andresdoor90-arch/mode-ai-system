/**
 * Logging abstraction (port).
 *
 * The rest of the system depends only on the {@link ILogger} interface, never
 * on a concrete logging library. A structured {@link ConsoleLogger} ships as
 * the default adapter; a pino/winston-backed adapter can be dropped in later
 * without touching call-sites. This keeps the logging *technology* swappable,
 * mirroring the same port/adapter discipline used for the database and AI
 * providers.
 */

/** Severity levels, ordered from least to most important. */
export enum LogLevel {
  Trace = 'trace',
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Fatal = 'fatal',
}

/** Numeric weight per level, used for threshold filtering. */
export const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  [LogLevel.Trace]: 10,
  [LogLevel.Debug]: 20,
  [LogLevel.Info]: 30,
  [LogLevel.Warn]: 40,
  [LogLevel.Error]: 50,
  [LogLevel.Fatal]: 60,
};

/** Arbitrary structured context attached to a log line. */
export type LogContext = Readonly<Record<string, unknown>>;

/** A fully-resolved, structured log entry as emitted to a sink. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly time: string;
  readonly context?: LogContext;
  /** Optional logger name / component scope. */
  readonly name?: string;
}

/**
 * The logging port. Implementations decide how entries are rendered and where
 * they go (console, file, remote). `child` returns a scoped logger that merges
 * additional bound context into every entry.
 */
export interface ILogger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  /** Create a child logger with a name and/or bound context. */
  child(bindings: { name?: string; context?: LogContext }): ILogger;
}

/** A destination for finished log entries (console, file, buffer...). */
export interface LogSink {
  write(entry: LogEntry): void;
}
