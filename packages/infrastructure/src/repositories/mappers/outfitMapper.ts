import {
  type CreateOutfitInput,
  type Garment,
  type Occasion,
  Outfit,
  type Season,
  toId,
} from '@mas/core';

import { mustOk } from './mapperUtils';

/** Raw `outfits` table row (garment links live in `outfit_garments`). */
export interface OutfitRow {
  id: string;
  name: string;
  occasion: string;
  season: string;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

/**
 * Reconstruct an {@link Outfit} from its row and the already-loaded garments
 * it references (ordered). Garment hydration is the repository's job, keeping
 * the mapper a pure transformation.
 */
export const outfitToDomain = (row: OutfitRow, garments: readonly Garment[]): Outfit => {
  const rating = row.rating ?? undefined;
  const notes = row.notes ?? undefined;
  const input: CreateOutfitInput = {
    name: row.name,
    garments: [...garments],
    occasion: row.occasion as Occasion,
    season: row.season as Season,
    createdAt: row.created_at,
    ...(rating !== undefined ? { rating } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  return mustOk(Outfit.create(toId<'Outfit'>(row.id), input), `outfit ${row.id}`);
};

/** Flatten the scalar fields of an {@link Outfit} into a row. */
export const outfitToRow = (outfit: Outfit): OutfitRow => ({
  id: outfit.id,
  name: outfit.name,
  occasion: outfit.occasion,
  season: outfit.season,
  rating: outfit.rating ?? null,
  notes: outfit.notes ?? null,
  created_at: outfit.createdAt,
});
