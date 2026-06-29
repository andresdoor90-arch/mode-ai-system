/**
 * Bundler- and asar-safe migrations.
 *
 * In production the app runs from a packaged Electron bundle (an `asar`
 * archive), where the `.sql` files under `./migrations` are NOT guaranteed to
 * be present next to the compiled JavaScript — `tsc`/Vite do not copy raw
 * `.sql` assets, and `fs.readdir`/`readFile` against an asar path is fragile.
 *
 * To make database initialisation robust everywhere, the migration SQL is also
 * embedded here as plain string constants. The composition root applies
 * {@link EMBEDDED_MIGRATIONS} (no filesystem access required). The on-disk
 * `.sql` files remain the human-readable source of truth and are used by the
 * file-based {@link loadMigrations} for local development/tooling; a drift
 * guard test asserts the two never diverge.
 */
import { type Migration } from './MigrationRunner';

const M0000_INIT = `-- Migration 0000_init
-- Initial relational schema for the M-A-S domain. Mirrors the Drizzle table
-- definitions in ../schema.ts. Applied by the MigrationRunner via the SqlDatabase port.

CREATE TABLE IF NOT EXISTS garments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  color_name TEXT,
  brand TEXT,
  size_system TEXT,
  size_value TEXT,
  size_measurements TEXT,
  seasons TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  wear_count INTEGER NOT NULL DEFAULT 0,
  last_worn_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garments_category ON garments (category);
CREATE INDEX IF NOT EXISTS idx_garments_status ON garments (status);

CREATE TABLE IF NOT EXISTS outfits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  occasion TEXT NOT NULL,
  season TEXT NOT NULL,
  rating REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outfits_occasion ON outfits (occasion);

CREATE TABLE IF NOT EXISTS outfit_garments (
  outfit_id TEXT NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  garment_id TEXT NOT NULL REFERENCES garments (id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, garment_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body_measurements TEXT,
  style_preference TEXT,
  color_palette TEXT,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS style_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_style_rules_priority ON style_rules (priority);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS collection_garments (
  collection_id TEXT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  garment_id TEXT NOT NULL REFERENCES garments (id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, garment_id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  occasion TEXT NOT NULL,
  dress_code TEXT,
  suggested_outfit_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events (date);
`;

const M0001_WARDROBE_PERSISTENCE = `-- Migration 0001_wardrobe_persistence (Phase 7 Part A + B)
--
-- Definitive persistence for the dynamic wardrobe and the intelligent outfit
-- history. Applied once by the MigrationRunner (tracked + idempotent), so the
-- ALTER TABLE statements below run exactly once and never clash on re-run.
--
-- Covers: dynamic categories (self-referential unlimited subcategories),
-- garment photographs (1:N relation), extended garment metadata, a
-- modification/audit history of garment changes with basic versioning, and the
-- outfit-usage history. Existing garment rows migrate automatically: the new
-- columns are nullable / carry constant defaults, so prior data keeps working
-- and falls back to the seed taxonomy when it carries no explicit metadata.

/* ----------------------------- dynamic categories ---------------------------- */

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT REFERENCES categories (id) ON DELETE CASCADE,
  "group" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  seeded INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);

/* --------------------------- extended garment columns ------------------------ */

ALTER TABLE garments ADD COLUMN category_id TEXT;
ALTER TABLE garments ADD COLUMN category_metadata TEXT;
ALTER TABLE garments ADD COLUMN secondary_colors TEXT NOT NULL DEFAULT '[]';
ALTER TABLE garments ADD COLUMN material TEXT;
ALTER TABLE garments ADD COLUMN purchase_date TEXT;
ALTER TABLE garments ADD COLUMN notes TEXT;
ALTER TABLE garments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_garments_category_id ON garments (category_id);

/* ------------------------------- photographs --------------------------------- */

CREATE TABLE IF NOT EXISTS photographs (
  id TEXT PRIMARY KEY,
  garment_id TEXT NOT NULL REFERENCES garments (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  rotation INTEGER NOT NULL DEFAULT 0,
  crop TEXT NOT NULL DEFAULT '{"x":0,"y":0,"width":1,"height":1}',
  is_primary INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'original',
  attributes TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_photographs_garment ON photographs (garment_id);

/* --------------------- garment modification / audit history ------------------ */

CREATE TABLE IF NOT EXISTS garment_history (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  snapshot TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_garment_history_garment ON garment_history (garment_id);

/* ------------------------------ outfit history ------------------------------- */

CREATE TABLE IF NOT EXISTS outfit_history (
  id TEXT PRIMARY KEY,
  outfit_id TEXT,
  garment_ids TEXT NOT NULL DEFAULT '[]',
  signature TEXT NOT NULL,
  label TEXT,
  worn_on TEXT NOT NULL,
  worn_time TEXT,
  place TEXT,
  event TEXT,
  occasion TEXT,
  weather TEXT,
  temperature_c REAL,
  role TEXT,
  comments TEXT,
  satisfaction INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  attributes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outfit_history_worn_on ON outfit_history (worn_on);
CREATE INDEX IF NOT EXISTS idx_outfit_history_signature ON outfit_history (signature);
CREATE INDEX IF NOT EXISTS idx_outfit_history_role ON outfit_history (role);
`;

const M0002_PERFORMANCE_INDEXES = `-- Migration 0002_performance_indexes (Phase 8 — Polish & Optimization)
--
-- Additive, composite indexes that accelerate the hot query paths exercised by
-- the wardrobe, recommendation and history features on large libraries
-- (10,000+ garments). All statements are idempotent (IF NOT EXISTS) and
-- create no new tables or columns, so the migration is safe to apply to any
-- existing install and never clashes on re-run.

-- Wardrobe browsing/filtering frequently filters by status AND category at
-- once (e.g. "active tops"); a composite index serves those without a scan.
CREATE INDEX IF NOT EXISTS idx_garments_status_category ON garments (status, category);

-- The recommendation/visualisation paths repeatedly resolve a garment's primary
-- photograph; index the relation by (garment_id, is_primary).
CREATE INDEX IF NOT EXISTS idx_photographs_garment_primary ON photographs (garment_id, is_primary);

-- Reverse lookups from a garment to the outfits/collections that reference it
-- (used by usage statistics and cascade bookkeeping).
CREATE INDEX IF NOT EXISTS idx_outfit_garments_garment ON outfit_garments (garment_id);
CREATE INDEX IF NOT EXISTS idx_collection_garments_garment ON collection_garments (garment_id);

-- Garment audit history is read newest-first per garment when showing the
-- modification timeline / current version.
CREATE INDEX IF NOT EXISTS idx_garment_history_garment_version ON garment_history (garment_id, version);

-- Outfit-usage statistics group by occasion and event over a date range.
CREATE INDEX IF NOT EXISTS idx_outfit_history_occasion ON outfit_history (occasion);
CREATE INDEX IF NOT EXISTS idx_outfit_history_event ON outfit_history (event);
`;

/**
 * The complete, ordered migration set embedded as string constants. Identical
 * in content and order to the `.sql` files under `./migrations` (guaranteed by
 * the drift-guard test). Apply via the {@link MigrationRunner}; it is tracked
 * and idempotent, so re-running is a no-op.
 */
export const EMBEDDED_MIGRATIONS: readonly Migration[] = [
  { id: '0000_init', sql: M0000_INIT },
  { id: '0001_wardrobe_persistence', sql: M0001_WARDROBE_PERSISTENCE },
  { id: '0002_performance_indexes', sql: M0002_PERFORMANCE_INDEXES },
];
