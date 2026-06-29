import {
  Category,
  type CategoryId,
  type CategoryMetadataInput,
  type LayerSlot,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toBool, toJson } from './mapperUtils';

/** Raw `categories` table row. */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  group: string | null;
  order: number;
  seeded: number;
  metadata: string;
}

interface CategoryMetadataJson {
  layerSlot?: string;
  formality?: number;
  comfort?: number;
  heavyOuterwear?: boolean;
  attributes?: Record<string, string>;
}

/** Reconstruct a {@link Category} aggregate from a persistence row. */
export const categoryToDomain = (row: CategoryRow): Category => {
  const meta = parseJson<CategoryMetadataJson>(row.metadata, {}, `category ${row.id} metadata`);
  const metadataInput: CategoryMetadataInput = {
    ...(meta.layerSlot !== undefined ? { layerSlot: meta.layerSlot as LayerSlot } : {}),
    ...(meta.formality !== undefined ? { formality: meta.formality } : {}),
    ...(meta.comfort !== undefined ? { comfort: meta.comfort } : {}),
    ...(meta.heavyOuterwear !== undefined ? { heavyOuterwear: meta.heavyOuterwear } : {}),
    ...(meta.attributes !== undefined ? { attributes: meta.attributes } : {}),
  };

  return mustOk(
    Category.create(toId<'Category'>(row.id), {
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id === null ? null : toId<'Category'>(row.parent_id),
      group: row.group,
      order: row.order,
      seeded: toBool(row.seeded),
      metadata: metadataInput,
    }),
    `category ${row.id}`,
  );
};

/** Flatten a {@link Category} aggregate into a persistence row. */
export const categoryToRow = (category: Category): CategoryRow => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  parent_id: (category.parentId as string | null) ?? null,
  group: category.group,
  order: category.order,
  seeded: category.seeded ? 1 : 0,
  metadata: toJson(category.metadata.toJSON()),
});

export const CATEGORY_ID = (id: string): CategoryId => toId<'Category'>(id);
