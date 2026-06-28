import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LogLevel } from '../logging/Logger';
import {
  AIProviderKind,
  DEFAULT_APP_CONFIG,
  validateConfig,
  withDefaults,
} from './AppConfig';
import { ConfigStore } from './ConfigStore';
import { ConfigurationError } from '../errors/InfrastructureError';

describe('AppConfig helpers', () => {
  it('merges a partial config over the defaults', () => {
    const config = withDefaults({ locale: 'es', ai: { provider: AIProviderKind.OpenAI } });
    expect(config.locale).toBe('es');
    expect(config.ai.provider).toBe(AIProviderKind.OpenAI);
    // Untouched fields fall back to defaults.
    expect(config.ai.textModel).toBe(DEFAULT_APP_CONFIG.ai.textModel);
    expect(config.logLevel).toBe(DEFAULT_APP_CONFIG.logLevel);
  });

  it('flags invalid configurations', () => {
    const bad = withDefaults({});
    const issues = validateConfig({
      ...bad,
      logLevel: 'verbose' as LogLevel,
      storage: { ...bad.storage, maxImageBytes: -1 },
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts the default configuration', () => {
    expect(validateConfig(DEFAULT_APP_CONFIG)).toEqual([]);
  });
});

describe('ConfigStore', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mas-config-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns defaults when the file does not exist', async () => {
    const store = new ConfigStore(join(dir, 'config.json'));
    const config = await store.load();
    expect(config).toEqual(DEFAULT_APP_CONFIG);
  });

  it('persists and reloads a config round-trip', async () => {
    const store = new ConfigStore(join(dir, 'config.json'));
    const saved = await store.save({ locale: 'es', telemetryEnabled: true });
    expect(saved.locale).toBe('es');

    const reloaded = await store.load();
    expect(reloaded.locale).toBe('es');
    expect(reloaded.telemetryEnabled).toBe(true);
  });

  it('updates through a mutate function', async () => {
    const store = new ConfigStore(join(dir, 'config.json'));
    await store.save({ logLevel: LogLevel.Warn });
    const updated = await store.update((current) => ({
      logLevel: current.logLevel === LogLevel.Warn ? LogLevel.Debug : LogLevel.Info,
    }));
    expect(updated.logLevel).toBe(LogLevel.Debug);
  });

  it('raises ConfigurationError on malformed JSON', async () => {
    const path = join(dir, 'config.json');
    await writeFile(path, '{ not json', 'utf8');
    const store = new ConfigStore(path);
    await expect(store.load()).rejects.toBeInstanceOf(ConfigurationError);
  });
});
