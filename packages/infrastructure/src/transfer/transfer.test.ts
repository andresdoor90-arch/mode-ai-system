import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import {
  MigrationRunner,
  defaultMigrationsDir,
  loadMigrations,
} from '../database/MigrationRunner';
import { seedDemoData } from '../database/seed';
import { type SqlDatabase } from '../database/SqlDatabase';
import { UuidIdGenerator } from '../id/UuidIdGenerator';
import {
  SqlCalendarEventRepository,
  SqlCollectionRepository,
  SqlGarmentRepository,
  SqlOutfitRepository,
  SqlStyleRuleRepository,
  SqlUserProfileRepository,
} from '../repositories';
import { ImportExportService, type TransferRepositories, parseBundleBytes } from './ImportExportService';

const buildRepos = async (): Promise<{ db: SqlDatabase; repos: TransferRepositories }> => {
  const db = await createTestSqlDatabase();
  new MigrationRunner(db).migrate(await loadMigrations(defaultMigrationsDir()));
  const garments = new SqlGarmentRepository(db);
  const repos: TransferRepositories = {
    garments,
    outfits: new SqlOutfitRepository(db, garments),
    profiles: new SqlUserProfileRepository(db),
    styleRules: new SqlStyleRuleRepository(db),
    collections: new SqlCollectionRepository(db),
    calendarEvents: new SqlCalendarEventRepository(db),
  };
  return { db, repos };
};

describe('ImportExportService', () => {
  let source: { db: SqlDatabase; repos: TransferRepositories };
  let target: { db: SqlDatabase; repos: TransferRepositories };

  beforeEach(async () => {
    source = await buildRepos();
    target = await buildRepos();
    await seedDemoData(source.repos, new UuidIdGenerator());
  });
  afterEach(() => {
    source.db.close();
    target.db.close();
  });

  it('exports a bundle reflecting the seeded data', async () => {
    const service = new ImportExportService(source.repos);
    const bundle = await service.exportBundle();
    expect(bundle.garments).toHaveLength(4);
    expect(bundle.outfits).toHaveLength(1);
    expect(bundle.userProfiles).toHaveLength(1);
    expect(bundle.styleRules).toHaveLength(1);
    expect(bundle.collections).toHaveLength(1);
    expect(bundle.calendarEvents).toHaveLength(1);
    expect(bundle.outfits[0]?.garmentIds).toHaveLength(3);
  });

  it('round-trips data into a fresh store', async () => {
    const exporter = new ImportExportService(source.repos);
    const bundle = await exporter.exportBundle();

    const importer = new ImportExportService(target.repos);
    await importer.importBundle(bundle);

    expect(await target.repos.garments.count()).toBe(4);
    expect(await target.repos.outfits.findAll()).toHaveLength(1);
    const outfit = (await target.repos.outfits.findAll())[0];
    expect(outfit?.garments).toHaveLength(3);
    expect((await target.repos.profiles.getCurrent())?.name).toBe('Demo User');
    expect(await target.repos.collections.findAll()).toHaveLength(1);
    expect(await target.repos.calendarEvents.findAll()).toHaveLength(1);
  });

  it('serialises to compressed bytes and back', async () => {
    const exporter = new ImportExportService(source.repos);
    const bytes = await exporter.exportToBytes({ compress: true });
    // gzip magic header.
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);

    const parsed = parseBundleBytes(bytes);
    const importer = new ImportExportService(target.repos);
    await importer.importBundle(parsed);
    expect(await target.repos.garments.count()).toBe(4);
  });

  it('rejects an unknown bundle format version', async () => {
    const importer = new ImportExportService(target.repos);
    await expect(
      importer.importBundle({
        formatVersion: 999,
        exportedAt: new Date().toISOString(),
        garments: [],
        outfits: [],
        userProfiles: [],
        styleRules: [],
        collections: [],
        calendarEvents: [],
      }),
    ).rejects.toThrow();
  });
});
