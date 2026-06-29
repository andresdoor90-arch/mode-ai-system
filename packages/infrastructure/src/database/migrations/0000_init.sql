-- Migration 0000_init
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
