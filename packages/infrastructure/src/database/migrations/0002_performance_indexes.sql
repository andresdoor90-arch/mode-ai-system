-- Migration 0002_performance_indexes (Phase 8 — Polish & Optimization)
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
