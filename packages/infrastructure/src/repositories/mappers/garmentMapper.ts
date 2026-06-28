import {
  type CreateGarmentInput,
  type GarmentId,
  Color,
  Garment,
  GarmentCategory,
  GarmentStatus,
  type Season,
  Size,
  SizeSystem,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toJson } from './mapperUtils';

/** Raw `garments` table row. */
export interface GarmentRow {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  color_hex: string;
  color_name: string | null;
  brand: string | null;
  size_system: string | null;
  size_value: string | null;
  size_measurements: string | null;
  seasons: string;
  images: string;
  tags: string;
  status: string;
  wear_count: number;
  last_worn_at: string | null;
  metadata: string;
}

/** Reconstruct a {@link Garment} aggregate from a persistence row. */
export const garmentToDomain = (row: GarmentRow): Garment => {
  const color = mustOk(
    Color.fromHex(row.color_hex, row.color_name ?? undefined),
    `garment ${row.id} color`,
  );

  let size: Size | undefined;
  if (row.size_system !== null && row.size_value !== null) {
    size = mustOk(
      Size.create({
        system: row.size_system as SizeSystem,
        value: row.size_value,
        measurements: parseJson<Record<string, number>>(
          row.size_measurements,
          {},
          `garment ${row.id} size`,
        ),
      }),
      `garment ${row.id} size`,
    );
  }

  const brand = row.brand ?? undefined;
  const lastWornAt = row.last_worn_at ?? undefined;

  const input: CreateGarmentInput = {
    name: row.name,
    category: row.category as GarmentCategory,
    subcategory: row.subcategory,
    color,
    seasons: parseJson<Season[]>(row.seasons, [], `garment ${row.id} seasons`),
    images: parseJson<string[]>(row.images, [], `garment ${row.id} images`),
    tags: parseJson<string[]>(row.tags, [], `garment ${row.id} tags`),
    status: row.status as GarmentStatus,
    wearCount: row.wear_count,
    metadata: parseJson<Record<string, string>>(row.metadata, {}, `garment ${row.id} metadata`),
    ...(brand !== undefined ? { brand } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(lastWornAt !== undefined ? { lastWornAt } : {}),
  };

  return mustOk(Garment.create(toId<'Garment'>(row.id), input), `garment ${row.id}`);
};

/** Flatten a {@link Garment} aggregate into a persistence row. */
export const garmentToRow = (garment: Garment): GarmentRow => ({
  id: garment.id,
  name: garment.name,
  category: garment.category,
  subcategory: garment.subcategory,
  color_hex: garment.color.hex,
  color_name: garment.color.name ?? null,
  brand: garment.brand ?? null,
  size_system: garment.size?.system ?? null,
  size_value: garment.size?.value ?? null,
  size_measurements: garment.size ? toJson(garment.size.measurements) : null,
  seasons: toJson(garment.seasons),
  images: toJson(garment.images),
  tags: toJson(garment.tags),
  status: garment.status,
  wear_count: garment.wearCount,
  last_worn_at: garment.lastWornAt ?? null,
  metadata: toJson(garment.metadata),
});

export const GARMENT_ID = (id: string): GarmentId => toId<'Garment'>(id);
