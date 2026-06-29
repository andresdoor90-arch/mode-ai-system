/**
 * Typed application configuration with defaults and validation.
 *
 * The config object is plain, serialisable data (no behaviour) so it can be
 * persisted to and from disk as JSON. Validation is performed by pure
 * functions that never throw for *expected* problems — they return a normalised
 * config or a list of issues — keeping this module free of side effects.
 */

import { LogLevel } from '../logging/Logger';

/** AI provider identifiers the app can be configured to use. */
export enum AIProviderKind {
  Ollama = 'ollama',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  None = 'none',
}

/** Storage-related paths and limits. */
export interface StorageConfig {
  /** Root directory for the SQLite database file. */
  readonly databaseDir: string;
  /** Root directory for stored garment images. */
  readonly imagesDir: string;
  /** Root directory for backups. */
  readonly backupsDir: string;
  /** Maximum image file size accepted, in bytes. */
  readonly maxImageBytes: number;
}

/** AI provider configuration (no secrets are persisted in plain config). */
export interface AIConfig {
  readonly provider: AIProviderKind;
  /** Model id for text/chat completion. */
  readonly textModel: string;
  /** Model id for embeddings. */
  readonly embeddingModel: string;
  /** Base URL for self-hosted providers (e.g. Ollama). */
  readonly baseUrl: string | null;
}

/** Top-level, persisted application configuration. */
export interface AppConfig {
  /** Schema version, to support forward migration of the config file. */
  readonly version: number;
  readonly storage: StorageConfig;
  readonly ai: AIConfig;
  readonly logLevel: LogLevel;
  /** UI/runtime locale tag, e.g. `en`, `es`. */
  readonly locale: string;
  /** Whether telemetry is enabled (opt-in, defaults off). */
  readonly telemetryEnabled: boolean;
}

/** Current config schema version. */
export const APP_CONFIG_VERSION = 1 as const;

/** The canonical default configuration. */
export const DEFAULT_APP_CONFIG: AppConfig = {
  version: APP_CONFIG_VERSION,
  storage: {
    databaseDir: 'data',
    imagesDir: 'data/images',
    backupsDir: 'data/backups',
    maxImageBytes: 25 * 1024 * 1024,
  },
  ai: {
    provider: AIProviderKind.Ollama,
    textModel: 'llama3.1',
    embeddingModel: 'nomic-embed-text',
    baseUrl: 'http://127.0.0.1:11434',
  },
  logLevel: LogLevel.Info,
  locale: 'en',
  telemetryEnabled: false,
};

/** Deep-merge a partial config over the defaults, producing a complete config. */
export const withDefaults = (partial: DeepPartial<AppConfig> | undefined): AppConfig => {
  const p = partial ?? {};
  return {
    version: APP_CONFIG_VERSION,
    storage: { ...DEFAULT_APP_CONFIG.storage, ...p.storage },
    ai: { ...DEFAULT_APP_CONFIG.ai, ...p.ai },
    logLevel: p.logLevel ?? DEFAULT_APP_CONFIG.logLevel,
    locale: p.locale ?? DEFAULT_APP_CONFIG.locale,
    telemetryEnabled: p.telemetryEnabled ?? DEFAULT_APP_CONFIG.telemetryEnabled,
  };
};

/** Validate a fully-formed config, returning the list of human-readable issues. */
export const validateConfig = (config: AppConfig): readonly string[] => {
  const issues: string[] = [];
  if (!Number.isInteger(config.version) || config.version < 1) {
    issues.push('version must be a positive integer.');
  }
  if (config.storage.maxImageBytes <= 0) {
    issues.push('storage.maxImageBytes must be positive.');
  }
  for (const key of ['databaseDir', 'imagesDir', 'backupsDir'] as const) {
    if (typeof config.storage[key] !== 'string' || config.storage[key].trim().length === 0) {
      issues.push(`storage.${key} must be a non-empty string.`);
    }
  }
  if (!Object.values(AIProviderKind).includes(config.ai.provider)) {
    issues.push(`ai.provider "${config.ai.provider}" is not a recognised provider.`);
  }
  if (!Object.values(LogLevel).includes(config.logLevel)) {
    issues.push(`logLevel "${config.logLevel}" is not a recognised level.`);
  }
  if (typeof config.locale !== 'string' || config.locale.trim().length === 0) {
    issues.push('locale must be a non-empty string.');
  }
  return issues;
};

/** Recursive partial used for merging user-supplied overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
