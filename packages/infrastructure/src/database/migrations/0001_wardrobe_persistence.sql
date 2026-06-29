-- Migration 0001_wardrobe_persistence (Phase 7 Part A + B)
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
