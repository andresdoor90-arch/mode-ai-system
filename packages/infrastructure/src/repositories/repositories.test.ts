import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BodyMeasurements,
  BodyShape,
  CalendarEvent,
  Color,
  ColorPalette,
  DressCode,
  Garment,
  GarmentCategory,
  GarmentStatus,
  Occasion,
  Outfit,
  RuleEffect,
  Season,
  Size,
  SizeSystem,
  StyleAesthetic,
  StylePreference,
  StyleRule,
  UserProfile,
  WardrobeCollection,
  type GarmentId,
  toId,
  unwrap,
} from '@mas/core';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import { MigrationRunner, defaultMigrationsDir, loadMigrations } from '../database/MigrationRunner';
import { type SqlDatabase } from '../database/SqlDatabase';
import { SqlCalendarEventRepository } from './SqlCalendarEventRepository';
import { SqlCollectionRepository } from './SqlCollectionRepository';
import { SqlGarmentRepository } from './SqlGarmentRepository';
import { SqlOutfitRepository } from './SqlOutfitRepository';
import { SqlStyleRuleRepository } from './SqlStyleRuleRepository';
import { SqlUserProfileRepository } from './SqlUserProfileRepository';

let counter = 0;
const nextId = <T extends string>(brand: T): import('@mas/core').Id<T> =>
  toId<T>(`${brand}-${(counter += 1)}`);

const blue = (): Color => unwrap(Color.fromHex('#3366cc', 'blue'));

const makeGarment = (
  over: Partial<{
    name: string;
    category: GarmentCategory;
    subcategory: string;
    status: GarmentStatus;
    seasons: Season[];
    tags: string[];
  }> = {},
): Garment =>
  unwrap(
    Garment.create(nextId('Garment'), {
      name: over.name ?? 'Tee',
      category: over.category ?? GarmentCategory.Tops,
      subcategory: over.subcategory ?? 't-shirt',
      color: blue(),
      seasons: over.seasons ?? [Season.AllSeason],
      status: over.status ?? GarmentStatus.Available,
      tags: over.tags ?? ['basic'],
      size: unwrap(Size.create({ system: SizeSystem.AlphaNumeric, value: 'M' })),
    }),
  );

describe('SQLite repositories', () => {
  let db: SqlDatabase;
  let garments: SqlGarmentRepository;
  let outfits: SqlOutfitRepository;
  let profiles: SqlUserProfileRepository;
  let rules: SqlStyleRuleRepository;
  let collections: SqlCollectionRepository;
  let events: SqlCalendarEventRepository;

  beforeEach(async () => {
    db = await createTestSqlDatabase();
    const runner = new MigrationRunner(db);
    runner.migrate(await loadMigrations(defaultMigrationsDir()));
    garments = new SqlGarmentRepository(db);
    outfits = new SqlOutfitRepository(db, garments);
    profiles = new SqlUserProfileRepository(db);
    rules = new SqlStyleRuleRepository(db);
    collections = new SqlCollectionRepository(db);
    events = new SqlCalendarEventRepository(db);
  });
  afterEach(() => {
    db.close();
  });

  it('GarmentRepository round-trips an aggregate with all fields', async () => {
    const garment = makeGarment({ tags: ['denim', 'blue'] });
    await garments.save(garment);

    const loaded = await garments.findById(garment.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Tee');
    expect(loaded?.color.hex).toBe('#3366cc');
    expect(loaded?.size?.value).toBe('M');
    expect([...(loaded?.tags ?? [])].sort()).toEqual(['blue', 'denim']);
    expect(await garments.count()).toBe(1);
  });

  it('GarmentRepository queries by category, status, season and tags', async () => {
    await garments.save(makeGarment({ category: GarmentCategory.Tops, subcategory: 't-shirt' }));
    await garments.save(
      makeGarment({
        category: GarmentCategory.Bottoms,
        subcategory: 'jeans',
        status: GarmentStatus.InLaundry,
        seasons: [Season.Winter],
        tags: ['warm'],
      }),
    );

    expect(await garments.findByCategory(GarmentCategory.Tops)).toHaveLength(1);
    expect(await garments.query({ status: GarmentStatus.InLaundry })).toHaveLength(1);
    expect(await garments.query({ season: Season.Winter })).toHaveLength(2); // all-season + winter
    expect(await garments.query({ tags: ['warm'] })).toHaveLength(1);
  });

  it('GarmentRepository deletes', async () => {
    const g = makeGarment();
    await garments.save(g);
    await garments.delete(g.id);
    expect(await garments.findById(g.id)).toBeNull();
  });

  it('OutfitRepository persists membership and hydrates garments', async () => {
    const top = makeGarment({ category: GarmentCategory.Tops, subcategory: 't-shirt' });
    const bottom = makeGarment({ category: GarmentCategory.Bottoms, subcategory: 'jeans' });
    const shoes = makeGarment({ category: GarmentCategory.Shoes, subcategory: 'sneakers' });
    await garments.save(top);
    await garments.save(bottom);
    await garments.save(shoes);

    const outfit = unwrap(
      Outfit.create(nextId('Outfit'), {
        name: 'Casual',
        garments: [top, bottom, shoes],
        occasion: Occasion.Casual,
        season: Season.Spring,
        createdAt: '2026-07-01T00:00:00.000Z',
        rating: 70,
      }),
    );
    await outfits.save(outfit);

    const loaded = await outfits.findById(outfit.id);
    expect(loaded?.garments).toHaveLength(3);
    expect(loaded?.rating).toBe(70);
    expect(loaded?.garments.map((g) => g.id)).toEqual([top.id, bottom.id, shoes.id]);

    expect(await outfits.findByOccasion(Occasion.Casual)).toHaveLength(1);
    expect(await outfits.query({ minRating: 80 })).toHaveLength(0);
  });

  it('UserProfileRepository tracks the current profile', async () => {
    const profile = unwrap(
      UserProfile.create(nextId('UserProfile'), {
        name: 'Ada',
        bodyMeasurements: unwrap(
          BodyMeasurements.create({ heightCm: 170, waistCm: 70, shape: BodyShape.Hourglass }),
        ),
        stylePreference: unwrap(
          StylePreference.create({ aesthetics: [StyleAesthetic.Classic], boldnessAffinity: 0.4 }),
        ),
        colorPalette: unwrap(
          ColorPalette.create({
            primary: unwrap(Color.fromHex('#1b263b', 'navy')),
            secondary: unwrap(Color.fromHex('#f5f5f5', 'white')),
            accent: unwrap(Color.fromHex('#c8a06a', 'tan')),
            neutral: unwrap(Color.fromHex('#808080', 'grey')),
          }),
        ),
      }),
    );
    await profiles.save(profile);

    const current = await profiles.getCurrent();
    expect(current?.name).toBe('Ada');
    expect(current?.bodyMeasurements?.shape).toBe(BodyShape.Hourglass);
    expect(current?.stylePreference?.aesthetics).toContain(StyleAesthetic.Classic);
    expect(current?.colorPalette?.primary.name).toBe('navy');
    expect((await profiles.findById(profile.id))?.id).toBe(profile.id);
  });

  it('StyleRuleRepository orders enabled rules by priority', async () => {
    const high = unwrap(
      StyleRule.create(nextId('StyleRule'), {
        name: 'high',
        condition: { occasions: [Occasion.Business] },
        recommendation: { effect: RuleEffect.Boost, message: 'wear a blazer' },
        priority: 90,
      }),
    );
    const low = unwrap(
      StyleRule.create(nextId('StyleRule'), {
        name: 'low',
        condition: {},
        recommendation: { effect: RuleEffect.Penalize, message: 'avoid clashing' },
        priority: 10,
        enabled: false,
      }),
    );
    await rules.save(high);
    await rules.save(low);

    expect(await rules.findAll()).toHaveLength(2);
    const enabled = await rules.findEnabledByPriority();
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.name).toBe('high');
    expect(enabled[0]?.condition.occasions).toEqual([Occasion.Business]);
  });

  it('CollectionRepository stores and restores member ids', async () => {
    const g1 = makeGarment();
    const g2 = makeGarment();
    await garments.save(g1);
    await garments.save(g2);
    const collection = unwrap(
      WardrobeCollection.create(nextId('Collection'), {
        name: 'Capsule',
        description: 'demo',
        garmentIds: [g1.id, g2.id] as GarmentId[],
      }),
    );
    await collections.save(collection);

    const loaded = await collections.findById(collection.id);
    expect(loaded?.name).toBe('Capsule');
    expect([...(loaded?.garmentIds ?? [])]).toEqual([g1.id, g2.id]);
  });

  it('CalendarEventRepository queries a date range', async () => {
    const mk = (title: string, date: string): CalendarEvent =>
      unwrap(
        CalendarEvent.create(nextId('CalendarEvent'), {
          title,
          date,
          occasion: Occasion.Business,
          dressCode: DressCode.Business,
        }),
      );
    await events.save(mk('Jan', '2026-01-10'));
    await events.save(mk('Jun', '2026-06-10'));
    await events.save(mk('Dec', '2026-12-10'));

    const inRange = await events.findBetween('2026-05-01', '2026-07-01');
    expect(inRange.map((e) => e.title)).toEqual(['Jun']);
    expect(await events.findAll()).toHaveLength(3);
  });
});
