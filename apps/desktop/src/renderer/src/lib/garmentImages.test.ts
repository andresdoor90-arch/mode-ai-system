import { describe, expect, it } from 'vitest';

import type { GarmentDTO, PhotoDTO } from '@shared/ipc';

import { fullImageKeyOf, hasPhoto, primaryPhoto, thumbnailKeyOf } from './garmentImages';

const photo = (over: Partial<PhotoDTO>): PhotoDTO => ({
  id: over.id ?? 'p1',
  storageKey: over.storageKey ?? 'images/aa/orig.png',
  order: over.order ?? 0,
  rotation: 0,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  isPrimary: over.isPrimary ?? false,
  stage: 'original',
  ...(over.attributes !== undefined ? { attributes: over.attributes } : {}),
});

const garment = (photos: PhotoDTO[]): GarmentDTO => ({ id: 'g1', photos }) as unknown as GarmentDTO;

describe('garment image selection', () => {
  it('returns undefined keys when there are no photos', () => {
    const g = garment([]);
    expect(hasPhoto(g)).toBe(false);
    expect(thumbnailKeyOf(g)).toBeUndefined();
    expect(fullImageKeyOf(g)).toBeUndefined();
  });

  it('prefers the primary photo and its thumbnail key', () => {
    const g = garment([
      photo({ id: 'a', storageKey: 'images/aa/a.png' }),
      photo({
        id: 'b',
        storageKey: 'images/bb/b.png',
        isPrimary: true,
        attributes: { thumbnailKey: 'images/bb/b-thumb.webp' },
      }),
    ]);
    expect(primaryPhoto(g)?.id).toBe('b');
    expect(thumbnailKeyOf(g)).toBe('images/bb/b-thumb.webp');
    expect(fullImageKeyOf(g)).toBe('images/bb/b.png');
  });

  it('falls back to the original when no thumbnail exists', () => {
    const g = garment([photo({ id: 'a', storageKey: 'images/aa/a.png' })]);
    expect(thumbnailKeyOf(g)).toBe('images/aa/a.png');
  });
});
