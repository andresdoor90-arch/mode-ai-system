/**
 * Pure helpers for choosing which stored image to show for a garment.
 *
 * Cards use the optimized thumbnail (falling back to the original when a
 * garment predates thumbnails); the detail view uses the full-resolution
 * original. Kept pure so the selection logic is unit tested without the DOM.
 */
import type { GarmentDTO, PhotoDTO } from '@shared/ipc';

/** The garment's cover photo: the primary one, else the first. */
export const primaryPhoto = (garment: GarmentDTO): PhotoDTO | undefined =>
  garment.photos.find((p) => p.isPrimary) ?? garment.photos[0];

/** Storage key for the catalog thumbnail (thumbnail if present, else original). */
export const thumbnailKeyOf = (garment: GarmentDTO): string | undefined => {
  const photo = primaryPhoto(garment);
  if (photo === undefined) {
    return undefined;
  }
  return photo.attributes?.thumbnailKey ?? photo.storageKey;
};

/** Storage key for the full-resolution original. */
export const fullImageKeyOf = (garment: GarmentDTO): string | undefined =>
  primaryPhoto(garment)?.storageKey;

/** Whether the garment has at least one photo. */
export const hasPhoto = (garment: GarmentDTO): boolean => garment.photos.length > 0;
