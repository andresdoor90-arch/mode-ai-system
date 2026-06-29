/**
 * Persistent preference-memory adapters.
 *
 * Concrete implementations of the `@mas/core` {@link IPreferenceMemoryStore}
 * port that back the orchestration Memory Engine. As with every other
 * infrastructure adapter, these contain NO learning logic — that lives in the
 * pure `MemoryEngine` in `@mas/core`. Here we only read/write the serialised
 * {@link PreferenceMemorySnapshot}.
 *
 *  - {@link InMemoryPreferenceMemoryStore} — volatile, for tests and ephemeral
 *    sessions.
 *  - {@link FilePreferenceMemoryStore} — durable JSON on disk, the production
 *    default for the single-user desktop app.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  EMPTY_PREFERENCE_MEMORY,
  type IPreferenceMemoryStore,
  type PreferenceMemorySnapshot,
} from '@mas/core';

import { StorageError } from '../errors/InfrastructureError';

/** Volatile in-process store. Nothing survives a restart. */
export class InMemoryPreferenceMemoryStore implements IPreferenceMemoryStore {
  private snapshot: PreferenceMemorySnapshot | null;

  public constructor(initial: PreferenceMemorySnapshot | null = null) {
    this.snapshot = initial;
  }

  public async load(): Promise<PreferenceMemorySnapshot | null> {
    return this.snapshot;
  }

  public async save(snapshot: PreferenceMemorySnapshot): Promise<void> {
    this.snapshot = snapshot;
  }
}

/**
 * Durable JSON-file store. Loading is tolerant — a missing file means "first
 * run" and yields `null` so the engine starts from {@link EMPTY_PREFERENCE_MEMORY}.
 * A malformed file raises a {@link StorageError} rather than silently losing
 * learned data.
 */
export class FilePreferenceMemoryStore implements IPreferenceMemoryStore {
  public constructor(private readonly filePath: string) {}

  public get path(): string {
    return this.filePath;
  }

  public async load(): Promise<PreferenceMemorySnapshot | null> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (cause) {
      if (isNotFound(cause)) {
        return null;
      }
      throw new StorageError(`Failed to read preference memory at ${this.filePath}.`, cause);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PreferenceMemorySnapshot>;
      return normalize(parsed);
    } catch (cause) {
      throw new StorageError(`Preference memory at ${this.filePath} is not valid JSON.`, cause);
    }
  }

  public async save(snapshot: PreferenceMemorySnapshot): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(normalize(snapshot), null, 2)}\n`, 'utf8');
    } catch (cause) {
      throw new StorageError(`Failed to write preference memory at ${this.filePath}.`, cause);
    }
  }
}

/** Coerce a parsed/partial object into a complete, well-formed snapshot. */
const normalize = (input: Partial<PreferenceMemorySnapshot>): PreferenceMemorySnapshot => ({
  version: typeof input.version === 'number' ? input.version : EMPTY_PREFERENCE_MEMORY.version,
  colorAffinity: { ...(input.colorAffinity ?? {}) },
  subcategoryAffinity: { ...(input.subcategoryAffinity ?? {}) },
  acceptCount: typeof input.acceptCount === 'number' ? input.acceptCount : 0,
  rejectCount: typeof input.rejectCount === 'number' ? input.rejectCount : 0,
  updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
});

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
