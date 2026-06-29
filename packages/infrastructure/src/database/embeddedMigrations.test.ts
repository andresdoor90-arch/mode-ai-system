import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import { EMBEDDED_MIGRATIONS } from './embeddedMigrations';
import { MigrationRunner, defaultMigrationsDir, loadMigrations } from './MigrationRunner';

const migrationsDir = defaultMigrationsDir();

describe('embedded migrations', () => {
  it('stays in sync with the on-disk .sql source of truth (no drift)', async () => {
    const fileMigrations = await loadMigrations(migrationsDir);

    // Same ids in the same order.
    expect(EMBEDDED_MIGRATIONS.map((m) => m.id)).toEqual(fileMigrations.map((m) => m.id));

    // Same SQL content per migration.
    for (const embedded of EMBEDDED_MIGRATIONS) {
      const onDisk = await readFile(join(migrationsDir, `${embedded.id}.sql`), 'utf8');
      expect(embedded.sql).toBe(onDisk);
    }
  });

  it('applies cleanly to a fresh database and is idempotent', async () => {
    const db = await createTestSqlDatabase();
    const runner = new MigrationRunner(db);

    const firstRun = runner.migrate(EMBEDDED_MIGRATIONS);
    expect(firstRun).toEqual([
      '0000_init',
      '0001_wardrobe_persistence',
      '0002_performance_indexes',
    ]);

    // Re-running applies nothing (tracked + idempotent).
    const secondRun = runner.migrate(EMBEDDED_MIGRATIONS);
    expect(secondRun).toEqual([]);
  });

  it('creates the expected tables and performance indexes', async () => {
    const db = await createTestSqlDatabase();
    new MigrationRunner(db).migrate(EMBEDDED_MIGRATIONS);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all<{ name: string }>()
      .map((r) => r.name);
    for (const expected of [
      'garments',
      'outfits',
      'categories',
      'photographs',
      'garment_history',
      'outfit_history',
    ]) {
      expect(tables).toContain(expected);
    }

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all<{ name: string }>()
      .map((r) => r.name);
    for (const expected of [
      'idx_garments_status_category',
      'idx_photographs_garment_primary',
      'idx_outfit_garments_garment',
      'idx_garment_history_garment_version',
      'idx_outfit_history_occasion',
    ]) {
      expect(indexes).toContain(expected);
    }
  });
});
