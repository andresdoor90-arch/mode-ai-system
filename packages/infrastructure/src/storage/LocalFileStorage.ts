import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import { StorageError, wrapAsync } from '../errors/InfrastructureError';
import {
  type IFileStorage,
  type SaveOptions,
  type StoredFile,
  buildStorageKey,
  contentTypeForExtension,
} from './FileStorage';

/**
 * Disk-backed {@link IFileStorage} rooted at a base directory. All keys are
 * resolved *inside* the root; attempts to escape the root (path traversal) are
 * rejected. Directories are created on demand and cleanup deletes empty shard
 * folders so the tree does not accumulate cruft.
 */
export class LocalFileStorage implements IFileStorage {
  public constructor(
    private readonly rootDir: string,
    private readonly defaultNamespace = 'files',
  ) {}

  public get root(): string {
    return this.rootDir;
  }

  public resolvePath(key: string): string {
    const target = join(this.rootDir, key);
    const rel = relative(this.rootDir, target);
    if (rel.startsWith('..') || rel.startsWith(`..${sep}`)) {
      throw new StorageError(`Storage key "${key}" escapes the storage root.`);
    }
    return target;
  }

  public async save(data: Uint8Array, options: SaveOptions = {}): Promise<StoredFile> {
    const key = buildStorageKey(this.defaultNamespace, randomUUID(), options.extension);
    return this.saveAs(key, data, options);
  }

  public async saveAs(
    key: string,
    data: Uint8Array,
    options: SaveOptions = {},
  ): Promise<StoredFile> {
    const path = this.resolvePath(key);
    await wrapAsync(
      async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, data);
      },
      (cause) => new StorageError(`Failed to write "${key}".`, cause),
    );
    return {
      key,
      size: data.byteLength,
      contentType: options.contentType ?? contentTypeForExtension(extensionOf(key)),
      createdAt: new Date().toISOString(),
    };
  }

  public async read(key: string): Promise<Uint8Array> {
    const path = this.resolvePath(key);
    return wrapAsync(
      async () => new Uint8Array(await readFile(path)),
      (cause) => new StorageError(`Failed to read "${key}".`, cause),
    );
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  public async delete(key: string): Promise<void> {
    const path = this.resolvePath(key);
    await wrapAsync(
      async () => {
        await rm(path, { force: true });
      },
      (cause) => new StorageError(`Failed to delete "${key}".`, cause),
    );
  }

  public async list(prefix = ''): Promise<readonly string[]> {
    const start = prefix.length > 0 ? this.resolvePath(prefix) : this.rootDir;
    const keys: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (cause) {
        if (isNotFound(cause)) {
          return;
        }
        throw new StorageError(`Failed to list "${dir}".`, cause);
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          keys.push(relative(this.rootDir, full).split(sep).join('/'));
        }
      }
    };
    await walk(start);
    return keys.sort();
  }
}

/** Extract a lowercase extension (without dot) from a key, or undefined. */
const extensionOf = (key: string): string | undefined => {
  const base = key.split('/').pop() ?? key;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : undefined;
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
