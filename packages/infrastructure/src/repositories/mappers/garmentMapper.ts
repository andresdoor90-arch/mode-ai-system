import {
  CategoryMetadata,
  type CategoryMetadataInput,
  type CreateGarmentInput,
  Color,
  Garment,
  type GarmentId,
  GarmentStatus,
  type LayerSlot,
  type Photograph,
  type Season,
  Size,
  SizeSystem,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toJson } from './mapperUtils';

/** Raw `garments` table row (Phase 7 extended schema). */
export interface GarmentRow {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  category_id: string | null;
  category_metadata: string | null;
  color_hex: string;
  color_name: string | null;
  secondary_colors: string;
  brand: string | null;
  size_system: string | null;
  size_value: string | null;
  size_measurements: string | null;
  material: string | null;
  seasons: string;
  images: string;
  tags: string;
  status: string;
  wear_count: number;
  last_worn_at: string | null;
  purchase_date: string | null;
  notes: string | null;
  metadata: string;
}

interface ColorJson {
  hex: string;
  name?: string;
}

interface CategoryMetadataJson {
  layerSlot?: string;
  formality?: number;
  comfort?: number;
  heavyOuterwear?: boolean;
  attributes?: Record<string, string>;
}

/**
 * Reconstruct a {@link Garment} aggregate from a persistence row plus its
 * (separately-loaded) photographs. Backwards-compatible: rows persisted before
 * the Phase 7 migration carry null/default values for the new columns and fall
 * back to the seed taxonomy via the garment's metadata-first getters.
 */
export const garmentToDomain = (
  row: GarmentRow,
  photos: readonly Photograph[] = [],
): Garment => {
  const color = mustOk(
    Color.fromHex(row.color_hex, row.color_name ?? undefined),
    `garment ${row.id} color`,
  );

  const secondaryColors = parseJson<ColorJson[]>(
    row.secondary_colors,
    [],
    `garment ${row.id} secondary colors`,
  ).map((c, i) => mustOk(Color.fromHex(c.hex, c.name), `garment ${row.id} secondary color ${i}`));

  let categoryMetadata: CategoryMetadata | undefined;
  if (row.category_metadata !== null) {
    const meta = parseJson<CategoryMetadataJson>(
      row.category_metadata,
      {},
      `garment ${row.id} category metadata`,
    );
    const input: CategoryMetadataInput = {
      ...(meta.layerSlot !== undefined ? { layerSlot: meta.layerSlot as LayerSlot } : {}),
      ...(meta.formality !== undefined ? { formality: meta.formality } : {}),
      ...(meta.comfort !== undefined ? { comfort: meta.comfort } : {}),
      ...(meta.heavyOuterwear !== undefined ? { heavyOuterwear: meta.heavyOuterwear } : {}),
      ...(meta.attributes !== undefined ? { attributes: meta.attributes } : {}),
    };
    categoryMetadata = mustOk(
      CategoryMetadata.create(input),
      `garment ${row.id} category metadata`,
    );
  }

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
  const material = row.material ?? undefined;
  const lastWornAt = row.last_worn_at ?? undefined;
  const purchaseDate = row.purchase_date ?? undefined;
  const notes = row.notes ?? undefined;
  const categoryId = row.category_id ?? undefined;

  const input: CreateGarmentInput = {
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    color,
    secondaryColors,
    seasons: parseJson<Season[]>(row.seasons, [], `garment ${row.id} seasons`),
    images: parseJson<string[]>(row.images, [], `garment ${row.id} images`),
    photos: [...photos],
    tags: parseJson<string[]>(row.tags, [], `garment ${row.id} tags`),
    status: row.status as GarmentStatus,
    wearCount: row.wear_count,
    metadata: parseJson<Record<string, string>>(row.metadata, {}, `garment ${row.id} metadata`),
    ...(categoryId !== undefined ? { categoryId: toId<'Category'>(categoryId) } : {}),
    ...(categoryMetadata !== undefined ? { categoryMetadata } : {}),
    ...(brand !== undefined ? { brand } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(material !== undefined ? { material } : {}),
    ...(lastWornAt !== undefined ? { lastWornAt } : {}),
    ...(purchaseDate !== undefined ? { purchaseDate } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  return mustOk(Garment.create(toId<'Garment'>(row.id), input), `garment ${row.id}`);
};

const colorToJson = (color: Color): ColorJson =>
  color.name !== undefined ? { hex: color.hex, name: color.name } : { hex: color.hex };

/** Flatten a {@link Garment} aggregate into a persistence row. */
export const garmentToRow = (garment: Garment): GarmentRow => ({
  id: garment.id,
  name: garment.name,
  category: garment.category,
  subcategory: garment.subcategory,
  category_id: (garment.categoryId as string | undefined) ?? null,
  category_metadata: garment.categoryMetadata
    ? toJson(garment.categoryMetadata.toJSON())
    : null,
  color_hex: garment.color.hex,
  color_name: garment.color.name ?? null,
  secondary_colors: toJson(garment.secondaryColors.map(colorToJson)),
  brand: garment.brand ?? null,
  size_system: garment.size?.system ?? null,
  size_value: garment.size?.value ?? null,
  size_measurements: garment.size ? toJson(garment.size.measurements) : null,
  material: garment.material ?? null,
  seasons: toJson(garment.seasons),
  images: toJson(garment.images),
  tags: toJson(garment.tags),
  status: garment.status,
  wear_count: garment.wearCount,
  last_worn_at: garment.lastWornAt ?? null,
  purchase_date: garment.purchaseDate ?? null,
  notes: garment.notes ?? null,
  metadata: toJson(garment.metadata),
});

export const GARMENT_ID = (id: string): GarmentId => toId<'Garment'>(id);
