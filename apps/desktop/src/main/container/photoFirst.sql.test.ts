import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AddGarmentCommand,
  AddPhotosCommand,
  Color,
  GarmentCategory,
  GetWardrobeQuery,
  Season,
  TopSubcategory,
  toId,
  unwrap,
  type GarmentId,
} from '@mas/core';
import { createTestSqlDatabase } from '@mas/infrastructure/__testsupport__/sqlite';

import { AppContainer } from './AppContainer';

interface WardrobeView {
  garments: ReadonlyArray<{
    id: string;
    name: string;
    metadata?: Record<string, string>;
    photos: ReadonlyArray<{ storageKey: string; attributes?: Record<string, string> }>;
  }>;
}

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
]);

describe('Photo-first backend (image store + analysis + persistence)', () => {
  it('round-trips image bytes through the image store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-img-'));
    try {
      const db = await createTestSqlDatabase();
      const container = await AppContainer.create({ database: db, dataDir: dir });
      const meta = await container.images.saveImage(PNG, {
        extension: 'png',
        contentType: 'image/png',
      });
      expect(meta.key).toMatch(/^images\//);
      const read = await container.images.getImage(meta.key);
      expect([...read]).toEqual([...PNG]);
      container.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('analyses colour samples + Spanish hints, never fabricating', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-img-'));
    try {
      const db = await createTestSqlDatabase();
      const container = await AppContainer.create({ database: db, dataDir: dir });
      const result = await container.analysis.analyze({
        colorSamples: [
          { r: 25, g: 40, b: 80, weight: 10 },
          { r: 25, g: 40, b: 80, weight: 8 },
        ],
        freeText: 'Es una camisa de lino, manga larga.',
      });
      expect(result.analysis.primaryColor?.value).toMatch(/^#[0-9a-f]{6}$/);
      expect(result.analysis.material?.value).toBe('Lino');
      expect(result.analysis.sleeve?.value).toBe('Manga larga');
      expect(result.visionAvailable).toBe(false);
      container.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists a photo-first garment (metadata + photo + thumbnail) across restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-img-'));
    const file = join(dir, 'wardrobe.db');
    try {
      const db1 = await createTestSqlDatabase(file);
      const c1 = await AppContainer.create({ database: db1, dataDir: dir });

      const original = await c1.images.saveImage(PNG, { extension: 'png' });
      const thumb = await c1.images.saveImage(PNG, { extension: 'webp' });

      const added = await c1.commands.send(
        new AddGarmentCommand({
          name: 'Camisa de lino azul',
          category: GarmentCategory.Tops,
          subcategory: TopSubcategory.Shirt,
          color: unwrap(Color.fromHex('#235a6e', 'Azul petróleo')),
          seasons: [Season.AllSeason],
          material: 'Lino',
          metadata: { sleeve: 'Manga larga', pattern: 'Liso', analysisConfidence: '0.8' },
        }),
      );
      expect(added.ok).toBe(true);
      const garmentId = added.ok ? (added.value as GarmentId) : toId<'Garment'>('x');

      const photos = await c1.commands.send(
        new AddPhotosCommand(garmentId, [
          { storageKey: original.key, attributes: { thumbnailKey: thumb.key } },
        ]),
      );
      expect(photos.ok).toBe(true);
      c1.dispose();

      const db2 = await createTestSqlDatabase(file);
      const c2 = await AppContainer.create({ database: db2, dataDir: dir });
      const wardrobe = await c2.queries.ask(new GetWardrobeQuery());
      const view = wardrobe.ok ? (wardrobe.value as WardrobeView) : { garments: [] };
      expect(view.garments).toHaveLength(1);
      const g = view.garments[0];
      expect(g?.name).toBe('Camisa de lino azul');
      expect(g?.metadata?.sleeve).toBe('Manga larga');
      expect(g?.photos[0]?.storageKey).toBe(original.key);
      expect(g?.photos[0]?.attributes?.thumbnailKey).toBe(thumb.key);
      c2.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
