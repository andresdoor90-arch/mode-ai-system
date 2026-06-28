import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BackupError } from '../errors/InfrastructureError';
import { type BackupTargets, BackupService } from './BackupService';

let root: string;
let targets: BackupTargets;

const fixedClock = (): Date => new Date('2026-07-01T12:00:00.000Z');

describe('BackupService', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mas-backup-'));
    targets = {
      databaseFile: join(root, 'data', 'database.sqlite'),
      imagesDir: join(root, 'data', 'images'),
      configFile: join(root, 'data', 'config.json'),
      backupsDir: join(root, 'backups'),
    };
    await mkdir(join(root, 'data', 'images', 'aa'), { recursive: true });
    await writeFile(targets.databaseFile, 'SQLITE-DATA-V1', 'utf8');
    await writeFile(join(targets.imagesDir, 'aa', 'img.png'), 'PNG-A', 'utf8');
    await writeFile(targets.configFile, '{"version":1}', 'utf8');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates a backup capturing all present targets', async () => {
    const service = new BackupService(targets, undefined, fixedClock);
    const manifest = await service.createBackup();
    expect(manifest.contents).toEqual({ database: true, images: true, config: true });
    expect(manifest.id).toContain('backup-');

    const list = await service.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(manifest.id);
  });

  it('restores a backup after the live data is changed', async () => {
    const service = new BackupService(targets, undefined, fixedClock);
    const manifest = await service.createBackup();

    // Mutate live data.
    await writeFile(targets.databaseFile, 'SQLITE-DATA-V2', 'utf8');
    await writeFile(targets.configFile, '{"version":2}', 'utf8');

    await service.restoreBackup(manifest.id);

    expect(await readFile(targets.databaseFile, 'utf8')).toBe('SQLITE-DATA-V1');
    expect(await readFile(targets.configFile, 'utf8')).toBe('{"version":1}');
    expect(await readFile(join(targets.imagesDir, 'aa', 'img.png'), 'utf8')).toBe('PNG-A');
  });

  it('skips missing targets without failing', async () => {
    await rm(targets.databaseFile, { force: true });
    const service = new BackupService(targets, undefined, fixedClock);
    const manifest = await service.createBackup();
    expect(manifest.contents.database).toBe(false);
    expect(manifest.contents.images).toBe(true);
  });

  it('raises BackupError when restoring an unknown backup', async () => {
    const service = new BackupService(targets, undefined, fixedClock);
    await expect(service.restoreBackup('backup-does-not-exist')).rejects.toBeInstanceOf(
      BackupError,
    );
  });

  it('deletes a backup', async () => {
    const service = new BackupService(targets, undefined, fixedClock);
    const manifest = await service.createBackup();
    await service.deleteBackup(manifest.id);
    expect(await service.listBackups()).toHaveLength(0);
  });

  it('returns an empty list when no backups exist', async () => {
    const service = new BackupService(targets, undefined, fixedClock);
    expect(await service.listBackups()).toEqual([]);
  });
});
