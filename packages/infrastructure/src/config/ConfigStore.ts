import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { ConfigurationError } from '../errors/InfrastructureError';
import { type AppConfig, type DeepPartial, validateConfig, withDefaults } from './AppConfig';

/**
 * Persists the {@link AppConfig} to a JSON file on disk.
 *
 * Loading is tolerant: a missing file yields the defaults, and a malformed file
 * raises a {@link ConfigurationError}. Saving always writes a validated,
 * complete config so the file on disk is never partially formed. The store has
 * no opinion about *where* the config lives — the path is injected — so it is
 * trivial to point at a temp dir in tests.
 */
export class ConfigStore {
  public constructor(private readonly filePath: string) {}

  /** Absolute or relative path to the backing JSON file. */
  public get path(): string {
    return this.filePath;
  }

  /**
   * Load the config from disk. Returns the defaults (merged) when the file does
   * not exist yet, so first-run is seamless.
   */
  public async load(): Promise<AppConfig> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (cause) {
      if (isNotFound(cause)) {
        return withDefaults(undefined);
      }
      throw new ConfigurationError(`Failed to read config at ${this.filePath}.`, cause);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new ConfigurationError(`Config at ${this.filePath} is not valid JSON.`, cause);
    }

    const config = withDefaults(parsed as DeepPartial<AppConfig>);
    const issues = validateConfig(config);
    if (issues.length > 0) {
      throw new ConfigurationError(`Config at ${this.filePath} is invalid: ${issues.join(' ')}`);
    }
    return config;
  }

  /** Persist a (partial) config, merged over defaults and validated. */
  public async save(config: DeepPartial<AppConfig>): Promise<AppConfig> {
    const complete = withDefaults(config);
    const issues = validateConfig(complete);
    if (issues.length > 0) {
      throw new ConfigurationError(`Refusing to save invalid config: ${issues.join(' ')}`);
    }
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(complete, null, 2)}\n`, 'utf8');
    } catch (cause) {
      throw new ConfigurationError(`Failed to write config at ${this.filePath}.`, cause);
    }
    return complete;
  }

  /** Load, apply an update function, and persist the result atomically-ish. */
  public async update(mutate: (current: AppConfig) => DeepPartial<AppConfig>): Promise<AppConfig> {
    const current = await this.load();
    return this.save(mutate(current));
  }
}

/** Narrow a thrown value to a Node "file not found" error. */
const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
