import {
  type GarmentId,
  type Occasion,
  OutfitHistoryEntry,
  type OutfitId,
  type OutfitUsageSource,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toJson } from './mapperUtils';

/** Raw `outfit_history` table row. */
export interface OutfitHistoryRow {
  id: string;
  outfit_id: string | null;
  garment_ids: string;
  signature: string;
  label: string | null;
  worn_on: string;
  worn_time: string | null;
  place: string | null;
  event: string | null;
  occasion: string | null;
  weather: string | null;
  temperature_c: number | null;
  role: string | null;
  comments: string | null;
  satisfaction: number | null;
  source: string;
  attributes: string;
  created_at: string;
}

/** Reconstruct an {@link OutfitHistoryEntry} from a persistence row. */
export const outfitHistoryToDomain = (row: OutfitHistoryRow): OutfitHistoryEntry => {
  const garmentIds = parseJson<string[]>(row.garment_ids, [], `history ${row.id} garments`).map(
    (id) => toId<'Garment'>(id),
  );
  return mustOk(
    OutfitHistoryEntry.create(toId<'OutfitHistoryEntry'>(row.id), {
      garmentIds,
      wornOn: row.worn_on,
      createdAt: row.created_at,
      source: row.source as OutfitUsageSource,
      attributes: parseJson<Record<string, string>>(
        row.attributes,
        {},
        `history ${row.id} attributes`,
      ),
      ...(row.outfit_id !== null ? { outfitId: row.outfit_id as OutfitId } : {}),
      ...(row.label !== null ? { label: row.label } : {}),
      ...(row.worn_time !== null ? { time: row.worn_time } : {}),
      ...(row.place !== null ? { place: row.place } : {}),
      ...(row.event !== null ? { event: row.event } : {}),
      ...(row.occasion !== null ? { occasion: row.occasion as Occasion } : {}),
      ...(row.weather !== null ? { weather: row.weather } : {}),
      ...(row.temperature_c !== null ? { temperatureC: row.temperature_c } : {}),
      ...(row.role !== null ? { role: row.role } : {}),
      ...(row.comments !== null ? { comments: row.comments } : {}),
      ...(row.satisfaction !== null ? { satisfaction: row.satisfaction } : {}),
    }),
    `history ${row.id}`,
  );
};

/** Flatten an {@link OutfitHistoryEntry} into a persistence row. */
export const outfitHistoryToRow = (entry: OutfitHistoryEntry): OutfitHistoryRow => ({
  id: entry.id,
  outfit_id: (entry.outfitId as string | undefined) ?? null,
  garment_ids: toJson([...entry.garmentIds] as GarmentId[]),
  signature: entry.signature,
  label: entry.label ?? null,
  worn_on: entry.wornOn,
  worn_time: entry.time ?? null,
  place: entry.place ?? null,
  event: entry.event ?? null,
  occasion: (entry.occasion as string | undefined) ?? null,
  weather: entry.weather ?? null,
  temperature_c: entry.temperatureC ?? null,
  role: entry.role ?? null,
  comments: entry.comments ?? null,
  satisfaction: entry.satisfaction ?? null,
  source: entry.source,
  attributes: toJson(entry.attributes),
  created_at: entry.createdAt,
});
