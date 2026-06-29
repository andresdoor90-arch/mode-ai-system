import {
  BodyMeasurements,
  BodyShape,
  CalendarEvent,
  Color,
  ColorPalette,
  DressCode,
  Garment,
  GarmentCategory,
  type IdGenerator,
  Occasion,
  Outfit,
  RuleEffect,
  Season,
  StyleAesthetic,
  StylePreference,
  StyleRule,
  Size,
  SizeSystem,
  UserProfile,
  WardrobeCollection,
  type GarmentId,
  type OutfitId,
  unwrap,
  AccessorySubcategory,
  BottomSubcategory,
  ShoeSubcategory,
  TopSubcategory,
} from '@mas/core';

import { type TransferRepositories } from '../transfer/ImportExportService';

/** A summary of what the seeder created. */
export interface SeedResult {
  readonly garments: number;
  readonly outfits: number;
  readonly profiles: number;
  readonly styleRules: number;
  readonly collections: number;
  readonly calendarEvents: number;
}

/**
 * Populate the repositories with a small, realistic set of demo data so a fresh
 * install has something to show. Uses only the domain factories and the
 * repository interfaces — it is storage-agnostic and contains no business
 * rules of its own.
 */
export const seedDemoData = async (
  repos: TransferRepositories,
  idGenerator: IdGenerator,
): Promise<SeedResult> => {
  const white = unwrap(Color.fromHex('#f5f5f5', 'white'));
  const indigo = unwrap(Color.fromHex('#3f4f7a', 'indigo'));
  const navy = unwrap(Color.fromHex('#1b263b', 'navy'));
  const tan = unwrap(Color.fromHex('#c8a06a', 'tan'));

  const tee = unwrap(
    Garment.create(idGenerator.next<'Garment'>(), {
      name: 'Classic White Tee',
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.TShirt,
      color: white,
      seasons: [Season.Spring, Season.Summer],
      tags: ['basic', 'cotton'],
      size: unwrap(Size.create({ system: SizeSystem.AlphaNumeric, value: 'M' })),
    }),
  );
  const jeans = unwrap(
    Garment.create(idGenerator.next<'Garment'>(), {
      name: 'Indigo Slim Jeans',
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Jeans,
      color: indigo,
      seasons: [Season.AllSeason],
      tags: ['denim'],
    }),
  );
  const sneakers = unwrap(
    Garment.create(idGenerator.next<'Garment'>(), {
      name: 'White Leather Sneakers',
      category: GarmentCategory.Shoes,
      subcategory: ShoeSubcategory.Sneakers,
      color: white,
      seasons: [Season.AllSeason],
      tags: ['leather'],
    }),
  );
  const belt = unwrap(
    Garment.create(idGenerator.next<'Garment'>(), {
      name: 'Tan Leather Belt',
      category: GarmentCategory.Accessories,
      subcategory: AccessorySubcategory.Belt,
      color: tan,
      seasons: [Season.AllSeason],
    }),
  );
  const garments = [tee, jeans, sneakers, belt];
  for (const garment of garments) {
    await repos.garments.save(garment);
  }

  const outfit = unwrap(
    Outfit.create(idGenerator.next<'Outfit'>(), {
      name: 'Everyday Casual',
      garments: [tee, jeans, sneakers],
      occasion: Occasion.Casual,
      season: Season.Spring,
      createdAt: new Date().toISOString(),
      rating: 82,
    }),
  );
  await repos.outfits.save(outfit);

  const profile = unwrap(
    UserProfile.create(idGenerator.next<'UserProfile'>(), {
      name: 'Demo User',
      bodyMeasurements: unwrap(
        BodyMeasurements.create({
          heightCm: 178,
          chestCm: 98,
          waistCm: 82,
          shape: BodyShape.Rectangle,
        }),
      ),
      stylePreference: unwrap(
        StylePreference.create({
          aesthetics: [StyleAesthetic.Minimalist, StyleAesthetic.Classic],
          preferredColors: ['navy', 'white'],
          boldnessAffinity: 0.3,
          comfortPriority: 0.7,
        }),
      ),
      colorPalette: unwrap(
        ColorPalette.create({ primary: navy, secondary: white, accent: indigo, neutral: tan }),
      ),
    }),
  );
  await repos.profiles.save(profile);

  const rule = unwrap(
    StyleRule.create(idGenerator.next<'StyleRule'>(), {
      name: 'Belt matches shoes for business',
      condition: { occasions: [Occasion.Business] },
      recommendation: {
        effect: RuleEffect.Boost,
        targetSubcategories: [AccessorySubcategory.Belt],
        message: 'Pair a leather belt with leather shoes for a polished business look.',
      },
      priority: 60,
    }),
  );
  await repos.styleRules.save(rule);

  const collection = unwrap(
    WardrobeCollection.create(idGenerator.next<'Collection'>(), {
      name: 'Spring Capsule',
      description: 'A lightweight everyday capsule.',
      garmentIds: [tee.id, jeans.id, sneakers.id] as GarmentId[],
    }),
  );
  await repos.collections.save(collection);

  const event = unwrap(
    CalendarEvent.create(idGenerator.next<'CalendarEvent'>(), {
      title: 'Team Offsite',
      date: '2026-07-15',
      occasion: Occasion.Business,
      dressCode: DressCode.BusinessCasual,
      suggestedOutfitIds: [outfit.id] as OutfitId[],
    }),
  );
  await repos.calendarEvents.save(event);

  return {
    garments: garments.length,
    outfits: 1,
    profiles: 1,
    styleRules: 1,
    collections: 1,
    calendarEvents: 1,
  };
};
