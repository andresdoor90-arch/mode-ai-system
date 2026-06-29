import {
  type ILogger,
  type LogContext,
  type LogEntry,
  type LogSink,
  LogLevel,
  LOG_LEVEL_WEIGHT,
} from './Logger';

/** A sink that serialises each entry as a single JSON line to stdout/stderr. */
export class ConsoleSink implements LogSink {
  public write(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (LOG_LEVEL_WEIGHT[entry.level] >= LOG_LEVEL_WEIGHT[LogLevel.Error]) {
      // eslint-disable-next-line no-console
      console.error(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }
}

/** An in-memory sink, primarily useful for tests and diagnostics buffers. */
export class MemorySink implements LogSink {
  public readonly entries: LogEntry[] = [];

  public write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  public clear(): void {
    this.entries.length = 0;
  }
}

export interface ConsoleLoggerOptions {
  /** Minimum level that will be emitted. Defaults to {@link LogLevel.Info}. */
  readonly level?: LogLevel;
  /** Sink to write entries to. Defaults to a {@link ConsoleSink}. */
  readonly sink?: LogSink;
  /** Logger name / component scope. */
  readonly name?: string;
  /** Context bound to every entry produced by this logger. */
  readonly context?: LogContext;
  /** Clock injection point (testability). Defaults to `() => new Date()`. */
  readonly now?: () => Date;
}

/**
 * Structured, dependency-free logger. Emits JSON entries through a pluggable
 * {@link LogSink} and supports level thresholds and child scopes. It relies on
 * no external library, so it runs anywhere the rest of the domain runs.
 */
export class ConsoleLogger implements ILogger {
  private readonly level: LogLevel;
  private readonly sink: LogSink;
  private readonly name: string | undefined;
  private readonly boundContext: LogContext | undefined;
  private readonly now: () => Date;

  public constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? LogLevel.Info;
    this.sink = options.sink ?? new ConsoleSink();
    this.name = options.name;
    this.boundContext = options.context;
    this.now = options.now ?? ((): Date => new Date());
  }

  public trace(message: string, context?: LogContext): void {
    this.log(LogLevel.Trace, message, context);
  }
  public debug(message: string, context?: LogContext): void {
    this.log(LogLevel.Debug, message, context);
  }
  public info(message: string, context?: LogContext): void {
    this.log(LogLevel.Info, message, context);
  }
  public warn(message: string, context?: LogContext): void {
    this.log(LogLevel.Warn, message, context);
  }
  public error(message: string, context?: LogContext): void {
    this.log(LogLevel.Error, message, context);
  }
  public fatal(message: string, context?: LogContext): void {
    this.log(LogLevel.Fatal, message, context);
  }

  public child(bindings: { name?: string; context?: LogContext }): ILogger {
    const mergedContext: LogContext | undefined =
      this.boundContext !== undefined || bindings.context !== undefined
        ? { ...this.boundContext, ...bindings.context }
        : undefined;
    const resolvedName: string | undefined = bindings.name ?? this.name;
    const options: ConsoleLoggerOptions = {
      level: this.level,
      sink: this.sink,
      now: this.now,
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      ...(mergedContext !== undefined ? { context: mergedContext } : {}),
    };
    return new ConsoleLogger(options);
  }

  private isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[this.level];
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.isEnabled(level)) {
      return;
    }
    const mergedContext: LogContext | undefined =
      this.boundContext !== undefined || context !== undefined
        ? { ...this.boundContext, ...context }
        : undefined;
    const entry: LogEntry = {
      level,
      message,
      time: this.now().toISOString(),
      ...(this.name !== undefined ? { name: this.name } : {}),
      ...(mergedContext !== undefined ? { context: mergedContext } : {}),
    };
    this.sink.write(entry);
  }
}

/** A logger that silently discards everything — handy for tests. */
export class NoopLogger implements ILogger {
  public trace(): void {}
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
  public child(): ILogger {
    return this;
  }
}
