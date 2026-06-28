/**
 * Drizzle ORM schema definitions.
 *
 * These table definitions are the single, typed source of truth for the
 * relational shape of the persisted domain. `drizzle-kit` generates the SQL
 * migrations under `./migrations` from this file; the {@link MigrationRunner}
 * then applies those SQL files at runtime through the {@link SqlDatabase} port.
 *
 * NOTE: this module imports `drizzle-orm`, which is a normal (non-native)
 * dependency installed in CI. In the offline authoring sandbox the package is
 * not present, so this specific file is validated by CI rather than locally —
 * the runtime persistence path (migrations + repositories) does not depend on
 * Drizzle and is fully exercised offline via the SQL port.
 */

import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const garments = sqliteTable(
  'garments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    subcategory: text('subcategory').notNull(),
    colorHex: text('color_hex').notNull(),
    colorName: text('color_name'),
    brand: text('brand'),
    sizeSystem: text('size_system'),
    sizeValue: text('size_value'),
    sizeMeasurements: text('size_measurements'),
    seasons: text('seasons').notNull(),
    images: text('images').notNull().default('[]'),
    tags: text('tags').notNull().default('[]'),
    status: text('status').notNull(),
    wearCount: integer('wear_count').notNull().default(0),
    lastWornAt: text('last_worn_at'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    categoryIdx: index('idx_garments_category').on(table.category),
    statusIdx: index('idx_garments_status').on(table.status),
  }),
);

export const outfits = sqliteTable(
  'outfits',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    occasion: text('occasion').notNull(),
    season: text('season').notNull(),
    rating: real('rating'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    occasionIdx: index('idx_outfits_occasion').on(table.occasion),
  }),
);

export const outfitGarments = sqliteTable(
  'outfit_garments',
  {
    outfitId: text('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    garmentId: text('garment_id')
      .notNull()
      .references(() => garments.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.outfitId, table.garmentId] }),
  }),
);

export const userProfiles = sqliteTable('user_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  bodyMeasurements: text('body_measurements'),
  stylePreference: text('style_preference'),
  colorPalette: text('color_palette'),
  isCurrent: integer('is_current').notNull().default(0),
});

export const styleRules = sqliteTable(
  'style_rules',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    condition: text('condition').notNull(),
    recommendation: text('recommendation').notNull(),
    priority: integer('priority').notNull().default(0),
    enabled: integer('enabled').notNull().default(1),
  },
  (table) => ({
    priorityIdx: index('idx_style_rules_priority').on(table.priority),
  }),
);

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
});

export const collectionGarments = sqliteTable(
  'collection_garments',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    garmentId: text('garment_id')
      .notNull()
      .references(() => garments.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.garmentId] }),
  }),
);

export const calendarEvents = sqliteTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    date: text('date').notNull(),
    occasion: text('occasion').notNull(),
    dressCode: text('dress_code'),
    suggestedOutfitIds: text('suggested_outfit_ids').notNull().default('[]'),
  },
  (table) => ({
    dateIdx: index('idx_calendar_events_date').on(table.date),
  }),
);

/** Convenience union of every table, used by drizzle client typings. */
export const schema = {
  garments,
  outfits,
  outfitGarments,
  userProfiles,
  styleRules,
  collections,
  collectionGarments,
  calendarEvents,
};
