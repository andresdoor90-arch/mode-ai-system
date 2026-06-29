import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BackupError, wrapAsync } from '../errors/InfrastructureError';
import { type ILogger } from '../logging/Logger';

/** Locations the backup service snapshots. */
export interface BackupTargets {
  /** Path to the SQLite database file. */
  readonly databaseFile: string;
  /** Directory containing stored images. */
  readonly imagesDir: string;
  /** Path to the JSON config file. */
  readonly configFile: string;
  /** Directory under which timestamped backups are written. */
  readonly backupsDir: string;
}

/** Manifest written into each backup directory. */
export interface BackupManifest {
  readonly id: string;
  readonly createdAt: string;
  readonly version: number;
  /** Which targets were actually present and captured. */
  readonly contents: {
    readonly database: boolean;
    readonly images: boolean;
    readonly config: boolean;
  };
}

const MANIFEST_FILE = 'manifest.json';
const DB_NAME = 'database.sqlite';
const IMAGES_NAME = 'images';
const CONFIG_NAME = 'config.json';
const BACKUP_VERSION = 1;

/**
 * Creates and restores file-level backups of the SQLite database, the image
 * store and the config file. Each backup is a self-describing, timestamped
 * directory with a manifest. Missing targets are skipped (not an error) so a
 * fresh install can still be backed up.
 *
 * This is pure file orchestration — it holds no business rules.
 */
export class BackupService {
  public constructor(
    private readonly targets: BackupTargets,
    private readonly logger?: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Create a new backup; returns its manifest. */
  public async createBackup(): Promise<BackupManifest> {
    return wrapAsync(
      async () => {
        const id = `backup-${this.now().toISOString().replace(/[:.]/g, '-')}`;
        const dir = join(this.targets.backupsDir, id);
        await mkdir(dir, { recursive: true });

        const hasDb = await exists(this.targets.databaseFile);
        if (hasDb) {
          await cp(this.targets.databaseFile, join(dir, DB_NAME));
        }
        const hasImages = await exists(this.targets.imagesDir);
        if (hasImages) {
          await cp(this.targets.imagesDir, join(dir, IMAGES_NAME), { recursive: true });
        }
        const hasConfig = await exists(this.targets.configFile);
        if (hasConfig) {
          await cp(this.targets.configFile, join(dir, CONFIG_NAME));
        }

        const manifest: BackupManifest = {
          id,
          createdAt: this.now().toISOString(),
          version: BACKUP_VERSION,
          contents: { database: hasDb, images: hasImages, config: hasConfig },
        };
        await writeFile(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        this.logger?.info('Created backup', { id });
        return manifest;
      },
      (cause) => new BackupError('Failed to create backup.', cause),
    );
  }

  /** List available backups, newest first. */
  public async listBackups(): Promise<readonly BackupManifest[]> {
    return wrapAsync(
      async () => {
        let entries;
        try {
          entries = await readdir(this.targets.backupsDir, { withFileTypes: true });
        } catch (cause) {
          if (isNotFound(cause)) {
            return [];
          }
          throw cause;
        }
        const manifests: BackupManifest[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          const manifestPath = join(this.targets.backupsDir, entry.name, MANIFEST_FILE);
          if (await exists(manifestPath)) {
            const raw = await readFile(manifestPath, 'utf8');
            manifests.push(JSON.parse(raw) as BackupManifest);
          }
        }
        return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      (cause) => new BackupError('Failed to list backups.', cause),
    );
  }

  /** Restore a backup by id, overwriting the live targets it contains. */
  public async restoreBackup(id: string): Promise<BackupManifest> {
    return wrapAsync(
      async () => {
        const dir = join(this.targets.backupsDir, id);
        const manifestPath = join(dir, MANIFEST_FILE);
        if (!(await exists(manifestPath))) {
          throw new BackupError(`Backup "${id}" not found or has no manifest.`);
        }
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BackupManifest;

        if (manifest.contents.database) {
          await cp(join(dir, DB_NAME), this.targets.databaseFile, { force: true });
        }
        if (manifest.contents.images) {
          await rm(this.targets.imagesDir, { recursive: true, force: true });
          await cp(join(dir, IMAGES_NAME), this.targets.imagesDir, { recursive: true });
        }
        if (manifest.contents.config) {
          await cp(join(dir, CONFIG_NAME), this.targets.configFile, { force: true });
        }
        this.logger?.info('Restored backup', { id });
        return manifest;
      },
      (cause) =>
        cause instanceof BackupError
          ? cause
          : new BackupError(`Failed to restore backup "${id}".`, cause),
    );
  }

  /** Delete a backup by id. */
  public async deleteBackup(id: string): Promise<void> {
    await wrapAsync(
      async () => {
        await rm(join(this.targets.backupsDir, id), { recursive: true, force: true });
      },
      (cause) => new BackupError(`Failed to delete backup "${id}".`, cause),
    );
  }
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
