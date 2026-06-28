import { type GarmentId, WardrobeCollection, toId } from '@mas/core';

import { mustOk } from './mapperUtils';

/** Raw `collections` table row (members live in `collection_garments`). */
export interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
}

/** Reconstruct a {@link WardrobeCollection} from its row and member ids. */
export const collectionToDomain = (
  row: CollectionRow,
  garmentIds: readonly string[],
): WardrobeCollection => {
  const description = row.description ?? undefined;
  return mustOk(
    WardrobeCollection.create(toId<'Collection'>(row.id), {
      name: row.name,
      garmentIds: garmentIds.map((id) => toId<'Garment'>(id)),
      ...(description !== undefined ? { description } : {}),
    }),
    `collection ${row.id}`,
  );
};

/** Flatten the scalar fields of a {@link WardrobeCollection} into a row. */
export const collectionToRow = (collection: WardrobeCollection): CollectionRow => ({
  id: collection.id,
  name: collection.name,
  description: collection.description ?? null,
});

/** The garment ids referenced by a collection, as raw strings. */
export const collectionGarmentIds = (collection: WardrobeCollection): readonly GarmentId[] =>
  collection.garmentIds;
