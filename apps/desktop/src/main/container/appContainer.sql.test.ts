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
  type GarmentId,
} from '@mas/core';
import { createTestSqlDatabase } from '@mas/infrastructure/__testsupport__/sqlite';

import { AppContainer } from './AppContainer';

// `GetWardrobeQuery` resolves to a { garments, collections } view; we only need
// the garment ids/names here, typed loosely to avoid importing the internal type.
interface WardrobeView {
  garments: ReadonlyArray<{ id: string; name: string }>;
}

describe('AppContainer SQL persistence wiring (offline, bun:sqlite injected)', () => {
  it('uses the SQL repositories as the real backing and seeds taxonomy + demo', async () => {
    const db = await createTestSqlDatabase();
    const container = await AppContainer.create({ database: db });

    const wardrobe = await container.queries.ask(new GetWardrobeQuery());
    expect(wardrobe.ok).toBe(true);
    const garments = wardrobe.ok ? (wardrobe.value as WardrobeView).garments : [];
    expect(garments.length).toBeGreaterThan(0); // demo seeded into SQLite

    const categories = await container.queries.ask(new GetCategoriesQuery());
    expect(categories.ok && categories.value.length).toBeGreaterThan(0); // taxonomy seeded

    container.dispose();
  });

  it('records an accepted recommendation in history and feeds preference memory', async () => {
    const db = await createTestSqlDatabase();
    const container = await AppContainer.create({ database: db });

    const wardrobe = await container.queries.ask(new GetWardrobeQuery());
    const ids = wardrobe.ok
      ? (wardrobe.value as WardrobeView).garments.slice(0, 2).map((g) => g.id as GarmentId)
      : [];
    expect(ids).toHaveLength(2);

    const accepted = await container.commands.send(
      new RecordOutfitFeedbackCommand({ garmentIds: ids, accepted: true, context: { role: 'pianist' } }),
    );
    expect(accepted.ok).toBe(true);

    const history = await container.queries.ask(new SearchOutfitHistoryQuery());
    expect(history.ok && history.value.total).toBe(1);
    expect(history.ok && history.value.items[0]?.role).toBe('pianist');

    // Rejection feeds memory but does NOT add a history entry.
    await container.commands.send(
      new RecordOutfitFeedbackCommand({ garmentIds: ids, accepted: false }),
    );
    const after = await container.queries.ask(new SearchOutfitHistoryQuery());
    expect(after.ok && after.value.total).toBe(1);

    container.dispose();
  });

  it('persists data across a simulated restart and does not duplicate the demo seed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mas-appcontainer-'));
    const file = join(dir, 'mas.db');
    try {
      const db1 = await createTestSqlDatabase(file);
      const c1 = await AppContainer.create({ database: db1 });
      const before = await c1.queries.ask(new GetWardrobeQuery());
      const beforeCount = before.ok ? (before.value as WardrobeView).garments.length : 0;
      await c1.commands.send(
        new AddGarmentCommand({
          name: 'Persisted Item',
          category: GarmentCategory.Tops,
          subcategory: TopSubcategory.TShirt,
          color: unwrap(Color.fromHex('#123456', 'Test')),
          seasons: [Season.AllSeason],
        }),
      );
      c1.dispose();

      // "Restart": reopen the same file and rebuild the container.
      const db2 = await createTestSqlDatabase(file);
      const c2 = await AppContainer.create({ database: db2 });
      const after = await c2.queries.ask(new GetWardrobeQuery());
      const names = after.ok
        ? (after.value as WardrobeView).garments.map((g) => (g as { name?: string }).name)
        : [];
      // The custom item survived, and the demo seed was NOT re-added.
      expect(names).toContain('Persisted Item');
      expect(after.ok ? (after.value as WardrobeView).garments.length : 0).toBe(beforeCount + 1);
      c2.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
