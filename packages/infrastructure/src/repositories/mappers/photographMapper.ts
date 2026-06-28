import {
  type CropRect,
  Photograph,
  type PhotoProcessingStage,
  type RotationDegrees,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toBool, toJson } from './mapperUtils';

/** Raw `photographs` table row. */
export interface PhotographRow {
  id: string;
  garment_id: string;
  storage_key: string;
  order: number;
  rotation: number;
  crop: string;
  is_primary: number;
  stage: string;
  attributes: string;
}

/** Reconstruct a {@link Photograph} value object from a persistence row. */
export const photographToDomain = (row: PhotographRow): Photograph =>
  mustOk(
    Photograph.create({
      id: toId<'Photo'>(row.id),
      storageKey: row.storage_key,
      order: row.order,
      rotation: row.rotation as RotationDegrees,
      crop: parseJson<CropRect>(
        row.crop,
        { x: 0, y: 0, width: 1, height: 1 },
        `photo ${row.id} crop`,
      ),
      isPrimary: toBool(row.is_primary),
      stage: row.stage as PhotoProcessingStage,
      attributes: parseJson<Record<string, string>>(
        row.attributes,
        {},
        `photo ${row.id} attributes`,
      ),
    }),
    `photo ${row.id}`,
  );

/** Flatten a {@link Photograph} into a persistence row for a garment. */
export const photographToRow = (garmentId: string, photo: Photograph): PhotographRow => ({
  id: photo.id,
  garment_id: garmentId,
  storage_key: photo.storageKey,
  order: photo.order,
  rotation: photo.rotation,
  crop: toJson(photo.crop),
  is_primary: photo.isPrimary ? 1 : 0,
  stage: photo.stage,
  attributes: toJson(photo.attributes),
});
