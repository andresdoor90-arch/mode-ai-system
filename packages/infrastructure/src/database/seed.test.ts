import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import { UuidIdGenerator } from '../id/UuidIdGenerator';
import {
  SqlCalendarEventRepository,
  SqlCollectionRepository,
  SqlGarmentRepository,
  SqlOutfitRepository,
  SqlStyleRuleRepository,
  SqlUserProfileRepository,
} from '../repositories';
import { type TransferRepositories } from '../transfer/ImportExportService';
import { MigrationRunner, defaultMigrationsDir, loadMigrations } from './MigrationRunner';
import { type SqlDatabase } from './SqlDatabase';
import { seedDemoData } from './seed';

describe('seedDemoData', () => {
  let db: SqlDatabase;
  let repos: TransferRepositories;

  beforeEach(async () => {
    db = await createTestSqlDatabase();
    new MigrationRunner(db).migrate(await loadMigrations(defaultMigrationsDir()));
    const garments = new SqlGarmentRepository(db);
    repos = {
      garments,
      outfits: new SqlOutfitRepository(db, garments),
      profiles: new SqlUserProfileRepository(db),
      styleRules: new SqlStyleRuleRepository(db),
      collections: new SqlCollectionRepository(db),
      calendarEvents: new SqlCalendarEventRepository(db),
    };
  });
  afterEach(() => {
    db.close();
  });

  it('populates every repository with valid demo data', async () => {
    const result = await seedDemoData(repos, new UuidIdGenerator());
    expect(result).toEqual({
      garments: 4,
      outfits: 1,
      profiles: 1,
      styleRules: 1,
      collections: 1,
      calendarEvents: 1,
    });

    expect(await repos.garments.count()).toBe(4);
    const outfit = (await repos.outfits.findAll())[0];
    expect(outfit?.name).toBe('Everyday Casual');
    expect(outfit?.garments).toHaveLength(3);
    expect((await repos.profiles.getCurrent())?.name).toBe('Demo User');
  });
});
