import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AddGarmentCommand,
  Color,
  GarmentCategory,
  GetCategoriesQuery,
  GetWardrobeQuery,
  RecordOutfitFeedbackCommand,
  Season,
  SearchOutfitHistoryQuery,
  TopSubcategory,
  unwrap,
  type CreateGarmentInput,
  type GarmentId,
} from '@mas/core';
import { createTestSqlDatabase } from '@mas/infrastructure/__testsupport__/sqlite';

import { AppContainer } from './AppContainer';

interface WardrobeView {
  garments: ReadonlyArray<{ id: string; name: string }>;
}

const garment = (name: string): CreateGarmentInput => ({
  name,
  category: GarmentCategory.Tops,
  subcategory: TopSubcategory.TShirt,
  color: unwrap(Color.fromHex('#123456', 'Test')),
  seasons: [Season.AllSeason],
});

describe('AppContainer SQL persistence wiring (offline, bun:sqlite injected)', () => {
  it('starts completely empty (no seed) and uses the SQL repositories as the real backing', async () => {
    const db = await createTestSqlDatabase();
    const container = await AppContainer.create({ database: db });

    // A real install starts empty: no garments and no categories are seeded.
    const wardrobe = await container.queries.ask(new GetWardrobeQuery());
    expect(wardrobe.ok).toBe(true);
    expect(wardrobe.ok ? (wardrobe.value as WardrobeView).garments.length : -1).toBe(0);

    const categories = await container.queries.ask(new GetCategoriesQuery());
    expect(categories.ok ? categories.value.length : -1).toBe(0);

    // The user creates content; it lands in SQLite via the real use case.
    const added = await container.commands.send(new AddGarmentCommand(garment('My First Tee')));
    expect(added.ok).toBe(true);

    const after = await container.queries.ask(new GetWardrobeQuery());
    const names = after.ok ? (after.value as WardrobeView).garments.map((g) => g.name) : [];
    expect(names).toEqual(['My First Tee']);

    container.dispose();
  });

  it('records an accepted recommendation in history and feeds preference memory', async () => {
    const db = await createTestSqlDatabase();
    const container = await AppContainer.create({ database: db });

    await container.commands.send(new AddGarmentCommand(garment('Tee A')));
    await container.commands.send(new AddGarmentCommand(garment('Tee B')));
    const wardrobe = await container.queries.ask(new GetWardrobeQuery());
    const ids = wardrobe.ok
      ? (wardrobe.value as WardrobeView).garments.map((g) => g.id as GarmentId)
      : [];
    expect(ids).toHaveLength(2);

    const accepted = await container.commands.send(
      new RecordOutfitFeedbackCommand({
        garmentIds: ids,
        accepted: true,
        context: { role: 'pianist' },
      }),
    );
    expect(accepted.ok).toBe(true);

    const history = await container.queries.ask(new SearchOutfitHistoryQuery());
    expect(history.ok && history.value.total).toBe(1);
    expect(history.ok && history.value.items[0]?.role).toBe('pianist');

    // Rejection feeds memory but does NOT add a history entry.
    await container.commands.send(
      new RecordOutfitFeedbackCommand({ garmentIds: ids, accepted: false }),
    );
    const afterReject = await container.queries.ask(new SearchOutfitHistoryQuery());
    expect(afterReject.ok && afterReject.value.total).toBe(1);

    container.dispose();
  });

  it('persists user data across a simulated restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-appcontainer-'));
    const file = join(dir, 'wardrobe.db');
    try {
      const db1 = await createTestSqlDatabase(file);
      const c1 = await AppContainer.create({ database: db1 });
      await c1.commands.send(new AddGarmentCommand(garment('Persisted Item')));
      c1.dispose();

      // "Restart": reopen the same file and rebuild the container.
      const db2 = await createTestSqlDatabase(file);
      const c2 = await AppContainer.create({ database: db2 });
      const after = await c2.queries.ask(new GetWardrobeQuery());
      const names = after.ok ? (after.value as WardrobeView).garments.map((g) => g.name) : [];
      expect(names).toEqual(['Persisted Item']);
      c2.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
