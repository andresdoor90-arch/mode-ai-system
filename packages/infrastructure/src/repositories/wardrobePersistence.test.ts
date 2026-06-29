import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  Category,
  CategoryMetadata,
  Color,
  Garment,
  GarmentCategory,
  GarmentStatus,
  type Id,
  LayerSlot,
  Occasion,
  OutfitHistoryEntry,
  Photograph,
  Season,
  SequentialIdGenerator,
  buildDefaultTaxonomy,
  toId,
  unwrap,
} from '@mas/core';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import {
  MigrationRunner,
  defaultMigrationsDir,
  loadMigrations,
} from '../database/MigrationRunner';
import { type SqlDatabase } from '../database/SqlDatabase';
import { SqlCategoryRepository } from './SqlCategoryRepository';
import { SqlGarmentRepository } from './SqlGarmentRepository';
import { SqlOutfitHistoryRepository } from './SqlOutfitHistoryRepository';

let counter = 0;
const nextId = <T extends string>(brand: T): Id<T> => toId<T>(`${brand}-${(counter += 1)}`);
const blue = (): Color => unwrap(Color.fromHex('#3366cc', 'blue'));

const makeGarment = (
  over: Partial<{ name: string; subcategory: string; photos: Photograph[] }> = {},
): Garment =>
  unwrap(
    Garment.create(nextId('Garment'), {
      name: over.name ?? 'Tee',
      category: GarmentCategory.Tops,
      subcategory: over.subcategory ?? 't-shirt',
      color: blue(),
      seasons: [Season.AllSeason],
      ...(over.photos !== undefined ? { photos: over.photos } : {}),
    }),
  );

const migrate = async (db: SqlDatabase): Promise<readonly string[]> => {
  const runner = new MigrationRunner(db);
  return runner.migrate(await loadMigrations(defaultMigrationsDir()));
};

describe('Phase 7 wardrobe persistence', () => {
  let db: SqlDatabase;
  beforeEach(async () => {
    db = await createTestSqlDatabase();
    await migrate(db);
  });
  afterEach(() => {
    db.close();
  });

  it('applies all migrations idempotently (init + Phase 7)', async () => {
    // Re-running against the same store applies nothing new.
    const second = await migrate(db);
    expect(second).toEqual([]);
    const applied = new MigrationRunner(db).appliedMigrations();
    expect(applied).toContain('0000_init');
    expect(applied).toContain('0001_wardrobe_persistence');
  });

  /* ------------------------------- categories ----------------------------- */

  it('SqlCategoryRepository: create, edit, subcategories, reorder, delete', async () => {
    const repo = new SqlCategoryRepository(db);
    const parentId = nextId('Category');
    const parent = unwrap(
      Category.create(parentId, {
        name: 'Tops',
        slug: 'tops',
        order: 0,
        metadata: { layerSlot: LayerSlot.UpperBody, formality: 5 },
      }),
    );
    await repo.save(parent);

    // Create subcategories (unlimited nesting via parentId).
    const sub1 = unwrap(
      Category.create(nextId('Category'), { name: 'Shirts', slug: 'shirts', parentId, order: 0 }),
    );
    const sub2 = unwrap(
      Category.create(nextId('Category'), { name: 'Tees', slug: 'tees', parentId, order: 1 }),
    );
    await repo.saveMany([sub1, sub2]);

    expect(await repo.count()).toBe(3);
    expect(await repo.findRoots()).toHaveLength(1);
    expect((await repo.findChildren(parentId)).map((c) => c.slug)).toEqual(['shirts', 'tees']);
    expect((await repo.findBySlug('tees'))?.name).toBe('Tees');

    // Edit category (rename + metadata).
    const loaded = unwrap2(await repo.findById(parentId));
    loaded.rename('Upper Body');
    unwrap(loaded.updateMetadata({ formality: 7 }));
    await repo.save(loaded);
    const reloaded = unwrap2(await repo.findById(parentId));
    expect(reloaded.name).toBe('Upper Body');
    expect(reloaded.metadata.formality).toBe(7);
    expect(reloaded.metadata.layerSlot).toBe(LayerSlot.UpperBody);

    // Reorder siblings.
    unwrap(sub1.reorder(1));
    unwrap(sub2.reorder(0));
    await repo.saveMany([sub1, sub2]);
    expect((await repo.findChildren(parentId)).map((c) => c.slug)).toEqual(['tees', 'shirts']);

    // Delete parent cascades to children.
    await repo.delete(parentId);
    expect(await repo.count()).toBe(0);
  });

  it('persists the default taxonomy (seed) as editable rows', async () => {
    const repo = new SqlCategoryRepository(db);
    const seeded = buildDefaultTaxonomy(new SequentialIdGenerator('cat'));
    await repo.saveMany(seeded);
    expect(await repo.count()).toBe(seeded.length);
    const roots = await repo.findRoots();
    expect(roots.length).toBe(6);
    expect(roots.every((c) => c.seeded)).toBe(true);
  });

  /* ------------------------- photographs + metadata ----------------------- */

  it('persists garment photographs and the garment<->photo relation', async () => {
    const garments = new SqlGarmentRepository(db);
    const p1 = unwrap(Photograph.create({ id: nextId('Photo'), storageKey: 'a.jpg', order: 0 }));
    const p2 = unwrap(
      Photograph.create({ id: nextId('Photo'), storageKey: 'b.jpg', order: 1, rotation: 90, isPrimary: true }),
    );
    const garment = makeGarment({ photos: [p1, p2] });
    await garments.save(garment);

    const loaded = unwrap2(await garments.findById(garment.id));
    expect(loaded.photos).toHaveLength(2);
    expect(loaded.photos[0]?.storageKey).toBe('a.jpg');
    expect(loaded.primaryPhoto?.storageKey).toBe('b.jpg');
    expect(loaded.photos[1]?.rotation).toBe(90);

    // Removing a photo and re-saving updates the relation rows.
    unwrap(garment.removePhoto(p1.id));
    await garments.save(garment);
    const after = unwrap2(await garments.findById(garment.id));
    expect(after.photos).toHaveLength(1);
    expect(after.photos[0]?.id).toBe(p2.id);
  });

  it('round-trips extended metadata (category metadata, secondary colours, material, dates, notes)', async () => {
    const garments = new SqlGarmentRepository(db);
    const meta = unwrap(
      CategoryMetadata.create({ layerSlot: LayerSlot.UpperBody, formality: 8, comfort: 0.4, heavyOuterwear: false }),
    );
    const garment = unwrap(
      Garment.create(nextId('Garment'), {
        name: 'Blazer',
        category: 'custom-suit',
        subcategory: 'blazer',
        categoryId: toId<'Category'>('cat-xyz'),
        categoryMetadata: meta,
        color: blue(),
        secondaryColors: [unwrap(Color.fromHex('#ffffff', 'white'))],
        seasons: [Season.AllSeason],
        material: 'wool',
        purchaseDate: '2025-01-15',
        notes: 'tailored fit',
        metadata: { closet: 'A1' },
      }),
    );
    await garments.save(garment);

    const loaded = unwrap2(await garments.findById(garment.id));
    expect(loaded.category).toBe('custom-suit');
    expect(loaded.categoryId).toBe('cat-xyz');
    expect(loaded.formality).toBe(8); // from persisted metadata, not seed fallback
    expect(loaded.layerSlot).toBe(LayerSlot.UpperBody);
    expect(loaded.secondaryColors[0]?.name).toBe('white');
    expect(loaded.material).toBe('wool');
    expect(loaded.purchaseDate).toBe('2025-01-15');
    expect(loaded.notes).toBe('tailored fit');
    expect(loaded.metadata.closet).toBe('A1');
  });

  it('tracks garment version and a modification/audit history', async () => {
    const garments = new SqlGarmentRepository(db, () => '2026-07-10T00:00:00.000Z');
    const garment = makeGarment({ name: 'V1' });
    await garments.save(garment);
    expect(await garments.version(garment.id)).toBe(1);

    unwrap(garment.rename('V2'));
    await garments.save(garment);
    expect(await garments.version(garment.id)).toBe(2);

    const history = await garments.history(garment.id);
    expect(history).toHaveLength(2);
    expect(history[0]?.changeType).toBe('created');
    expect(history[1]?.changeType).toBe('updated');
    expect(history[1]?.version).toBe(2);
  });

  /* ------------------------------ outfit history -------------------------- */

  it('SqlOutfitHistoryRepository: CRUD + findByGarment', async () => {
    const history = new SqlOutfitHistoryRepository(db);
    const ga = toId<'Garment'>('g-a');
    const gb = toId<'Garment'>('g-b');
    const entry = unwrap(
      OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
        garmentIds: [ga, gb],
        wornOn: '2026-07-12',
        time: '19:30',
        place: 'auditorium',
        event: 'concert',
        occasion: Occasion.Formal,
        weather: 'mild',
        temperatureC: 21,
        role: 'drummer',
        comments: 'great fit',
        satisfaction: 5,
        source: 'accepted-recommendation',
        createdAt: '2026-07-12T20:00:00.000Z',
      }),
    );
    await history.save(entry);

    const loaded = unwrap2(await history.findById(entry.id));
    expect(loaded.role).toBe('drummer');
    expect(loaded.satisfaction).toBe(5);
    expect(loaded.temperatureC).toBe(21);
    expect(loaded.occasion).toBe(Occasion.Formal);
    expect(loaded.signature).toBe([ga, gb].sort().join('|'));

    expect((await history.findByGarment(ga))).toHaveLength(1);
    expect((await history.findByGarment(toId<'Garment'>('g-z')))).toHaveLength(0);
    expect(await history.count()).toBe(1);

    await history.delete(entry.id);
    expect(await history.count()).toBe(0);
  });
});

/* ------------------------- restart-persistence proof ---------------------- */

describe('restart-persistence simulation', () => {
  it('data survives reopening the database (a simulated app restart)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-restart-'));
    const file = join(dir, 'mas.db');
    try {
      // First "run": migrate + persist a garment with a photo + a category + history.
      const db1 = await createTestSqlDatabase(file);
      await migrate(db1);
      const cats1 = new SqlCategoryRepository(db1);
      await cats1.saveMany(buildDefaultTaxonomy(new SequentialIdGenerator('cat')));
      const garments1 = new SqlGarmentRepository(db1);
      const photo = unwrap(Photograph.create({ id: nextId('Photo'), storageKey: 'p.jpg' }));
      const garment = makeGarment({ name: 'Survivor', photos: [photo] });
      await garments1.save(garment);
      const history1 = new SqlOutfitHistoryRepository(db1);
      await history1.save(
        unwrap(
          OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
            garmentIds: [garment.id],
            wornOn: '2026-07-12',
            role: 'pianist',
            createdAt: '2026-07-12T20:00:00.000Z',
          }),
        ),
      );
      db1.close();

      // Second "run": reopen the SAME file, re-run migrations (idempotent), read.
      const db2 = await createTestSqlDatabase(file);
      const applied = await migrate(db2);
      expect(applied).toEqual([]); // nothing to re-apply — store already migrated
      const garments2 = new SqlGarmentRepository(db2);
      const loaded = await garments2.findById(garment.id);
      expect(loaded?.name).toBe('Survivor');
      expect(loaded?.photos).toHaveLength(1);
      expect(await new SqlCategoryRepository(db2).count()).toBeGreaterThan(0);
      expect(await new SqlOutfitHistoryRepository(db2).count()).toBe(1);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** Local non-null unwrap helper for repository reads. */
function unwrap2<T>(value: T | null): T {
  if (value === null) {
    throw new Error('Expected a non-null value.');
  }
  return value;
}
