import { describe, it, expect } from 'vitest';

import { toId, type GarmentId, type CategoryId } from '../shared/Identifier';
import { SequentialIdGenerator } from '../shared/IdGenerator';
import { unwrap } from '../shared/Result';
import { Season } from '../domain/value-objects/Season';
import { CategoryMetadata } from '../domain/value-objects/CategoryMetadata';
import { GarmentStatus } from '../domain/entities/Garment';
import { WardrobeEvents, type GarmentSnapshot } from '../domain/events/wardrobeEvents';
import {
  InMemoryGarmentRepository,
  InMemoryCategoryRepository,
  FakeIdGenerator,
  makeGarment,
  color,
} from '../__fixtures__/testSupport';

import {
  CreateCategoryCommand,
  CreateCategoryHandler,
  UpdateCategoryCommand,
  UpdateCategoryHandler,
  ReorderCategoriesCommand,
  ReorderCategoriesHandler,
  DeleteCategoryCommand,
  DeleteCategoryHandler,
  SeedDefaultTaxonomyCommand,
  SeedDefaultTaxonomyHandler,
} from './commands/categoryCommands';
import { AddGarmentCommand, AddGarmentHandler } from './commands/garmentCommands';
import {
  DuplicateGarmentCommand,
  DuplicateGarmentHandler,
  ArchiveGarmentCommand,
  ArchiveGarmentHandler,
  RestoreGarmentCommand,
  RestoreGarmentHandler,
} from './commands/garmentLifecycleCommands';
import {
  AddPhotosCommand,
  AddPhotosHandler,
  ReorderPhotosCommand,
  ReorderPhotosHandler,
} from './commands/photoCommands';
import {
  SuggestGarmentTagsQuery,
  SuggestGarmentTagsHandler,
  ConfirmGarmentTagsCommand,
  ConfirmGarmentTagsHandler,
} from './commands/taggingCommands';
import { searchGarments } from './queries/garmentSearch';
import { DeferredVisionTagSuggester } from './tagging/DeferredVisionTagSuggester';
import type { GarmentTagSuggestion, IGarmentTagSuggester } from './tagging/ports';
import { WardrobeSyncCoordinator } from './sync/WardrobeSyncCoordinator';
import type {
  IDomainEventPublisher,
  IDomainEventSubscriber,
  WardrobeSyncSubsystems,
} from './sync/ports';

/* ----------------------- a minimal in-memory event bus -------------------- */

class TestBus implements IDomainEventPublisher, IDomainEventSubscriber {
  public readonly published: Array<{ type: string; payload: unknown }> = [];
  private readonly handlers = new Map<
    string,
    Array<(e: { type: string; payload: unknown; occurredAt: string }) => void | Promise<void>>
  >();

  public subscribe<TPayload = unknown>(
    type: string,
    handler: (event: {
      type: string;
      payload: TPayload;
      occurredAt: string;
    }) => void | Promise<void>,
  ): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as never);
    this.handlers.set(type, list);
    return () => {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter((h) => h !== handler),
      );
    };
  }

  public async publish<TPayload = unknown>(type: string, payload: TPayload): Promise<void> {
    this.published.push({ type, payload });
    for (const h of this.handlers.get(type) ?? []) {
      await h({ type, payload, occurredAt: new Date().toISOString() });
    }
  }
}

describe('Category management (Module 1 — fully dynamic)', () => {
  it('seeds the default taxonomy once (idempotent migration)', async () => {
    const repo = new InMemoryCategoryRepository();
    const handler = new SeedDefaultTaxonomyHandler(repo, new SequentialIdGenerator('cat'));
    const first = unwrap(await handler.handle(new SeedDefaultTaxonomyCommand()));
    expect(first).toBeGreaterThan(6);
    const second = unwrap(await handler.handle(new SeedDefaultTaxonomyCommand()));
    expect(second).toBe(0); // already seeded → no-op
  });

  it('creates, edits, groups, reorders and deletes user categories', async () => {
    const repo = new InMemoryCategoryRepository();
    const ids = new FakeIdGenerator('cat');
    const bus = new TestBus();
    const create = new CreateCategoryHandler(repo, ids, bus);

    const sacos = unwrap(
      await create.handle(new CreateCategoryCommand({ name: 'Sacos', metadata: { formality: 8 } })),
    );
    const blazers = unwrap(await create.handle(new CreateCategoryCommand({ name: 'Blazers' })));
    expect(await repo.count()).toBe(2);
    expect(bus.published.filter((e) => e.type === WardrobeEvents.CategoryCreated)).toHaveLength(2);

    // edit: rename + group + metadata
    const update = new UpdateCategoryHandler(repo, bus);
    unwrap(
      await update.handle(
        new UpdateCategoryCommand({
          id: sacos,
          name: 'Sacos elegantes',
          group: 'Formal',
          metadata: { formality: 9 },
        }),
      ),
    );
    const edited = await repo.findById(sacos);
    expect(edited?.name).toBe('Sacos elegantes');
    expect(edited?.group).toBe('Formal');
    expect(edited?.metadata.formality).toBe(9);

    // reorder
    const reorder = new ReorderCategoriesHandler(repo, bus);
    unwrap(await reorder.handle(new ReorderCategoriesCommand([blazers, sacos])));
    expect((await repo.findById(blazers))?.order).toBe(0);
    expect((await repo.findById(sacos))?.order).toBe(1);

    // delete
    const del = new DeleteCategoryHandler(repo, bus);
    unwrap(await del.handle(new DeleteCategoryCommand(blazers)));
    expect(await repo.count()).toBe(1);
  });

  it('creates unlimited subcategories under a parent', async () => {
    const repo = new InMemoryCategoryRepository();
    const ids = new FakeIdGenerator('cat');
    const create = new CreateCategoryHandler(repo, ids);
    const camisas = unwrap(await create.handle(new CreateCategoryCommand({ name: 'Camisas' })));
    for (const sub of ['Manga corta', 'Manga larga', 'Sin mangas']) {
      unwrap(
        await create.handle(
          new CreateCategoryCommand({ name: sub, parentId: camisas as CategoryId }),
        ),
      );
    }
    const children = await repo.findChildren(camisas as CategoryId);
    expect(children).toHaveLength(3);
  });
});

describe('Garment lifecycle (Module 2)', () => {
  const setup = () => {
    const repo = new InMemoryGarmentRepository();
    const ids = new FakeIdGenerator('g');
    const bus = new TestBus();
    return { repo, ids, bus };
  };

  it('adds with a unique persistent id and duplicates', async () => {
    const { repo, ids, bus } = setup();
    const add = new AddGarmentHandler(repo, ids, bus);
    const id = unwrap(
      await add.handle(
        new AddGarmentCommand({
          name: 'Camisa azul',
          category: 'tops',
          subcategory: 'shirt',
          color: color('#0000ff'),
          seasons: [Season.AllSeason],
        }),
      ),
    );
    expect(await repo.findById(id)).not.toBeNull();

    const dup = new DuplicateGarmentHandler(repo, ids, bus);
    const copyId = unwrap(await dup.handle(new DuplicateGarmentCommand(id)));
    expect(copyId).not.toBe(id);
    expect((await repo.findById(copyId))?.name).toBe('Camisa azul (copy)');
    expect(await repo.count()).toBe(2);
  });

  it('archives (soft-delete) and restores', async () => {
    const { repo, bus } = setup();
    const g = makeGarment({ id: 'gx' });
    await repo.save(g);
    unwrap(
      await new ArchiveGarmentHandler(repo, bus).handle(new ArchiveGarmentCommand(toId('gx'))),
    );
    expect((await repo.findById(toId('gx')))?.status).toBe(GarmentStatus.Archived);
    unwrap(
      await new RestoreGarmentHandler(repo, bus).handle(new RestoreGarmentCommand(toId('gx'))),
    );
    expect((await repo.findById(toId('gx')))?.status).toBe(GarmentStatus.Available);
    const events = bus.published.map((e) => e.type);
    expect(events).toContain(WardrobeEvents.GarmentArchived);
    expect(events).toContain(WardrobeEvents.GarmentRestored);
  });
});

describe('Photo management (Module 3)', () => {
  it('adds and reorders photos and emits photos-changed', async () => {
    const repo = new InMemoryGarmentRepository();
    const ids = new FakeIdGenerator('p');
    const bus = new TestBus();
    const g = makeGarment({ id: 'gp' });
    await repo.save(g);

    const photoIds = unwrap(
      await new AddPhotosHandler(repo, ids, bus).handle(
        new AddPhotosCommand(toId('gp'), [
          { storageKey: 'a.png' },
          { storageKey: 'b.png' },
          { storageKey: 'c.png' },
        ]),
      ),
    );
    expect(photoIds).toHaveLength(3);
    expect((await repo.findById(toId('gp')))?.photos).toHaveLength(3);

    unwrap(
      await new ReorderPhotosHandler(repo, bus).handle(
        new ReorderPhotosCommand(toId('gp'), [photoIds[2]!, photoIds[0]!, photoIds[1]!]),
      ),
    );
    const reordered = await repo.findById(toId('gp'));
    expect(reordered?.photos.map((p) => p.id)).toEqual([photoIds[2], photoIds[0], photoIds[1]]);
    expect(
      bus.published.filter((e) => e.type === WardrobeEvents.GarmentPhotosChanged).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('AI-assisted tagging (Module 5) — suggestions never auto-applied', () => {
  it('suggests colours offline but applies NOTHING until confirmed', async () => {
    const repo = new InMemoryGarmentRepository();
    const g = makeGarment({ id: 'gt', subcategory: 'shirt', category: 'tops' });
    await repo.save(g);

    const suggester = new DeferredVisionTagSuggester();
    const query = new SuggestGarmentTagsHandler(repo, suggester);
    const suggestion = unwrap(
      await query.handle(
        new SuggestGarmentTagsQuery(toId('gt'), [
          { r: 200, g: 10, b: 10, weight: 5 },
          { r: 210, g: 20, b: 20, weight: 3 },
        ]),
      ),
    );
    expect(suggestion.unavailable).toBe(false);
    expect(suggestion.colors?.value.length).toBeGreaterThan(0);
    // The garment is unchanged after merely suggesting.
    expect((await repo.findById(toId('gt')))?.material).toBeUndefined();

    // Vision-derived fields stay unavailable (deferred).
    expect(suggestion.category).toBeUndefined();
  });

  it('applies only the user-confirmed subset on confirmation', async () => {
    const repo = new InMemoryGarmentRepository();
    const bus = new TestBus();
    const g = makeGarment({ id: 'gc', category: 'tops', subcategory: 'shirt' });
    await repo.save(g);

    const confirm = new ConfirmGarmentTagsHandler(repo, bus);
    const md = unwrap(CategoryMetadata.create({ formality: 9 }));
    unwrap(
      await confirm.handle(
        new ConfirmGarmentTagsCommand({
          garmentId: toId('gc'),
          category: 'sacos',
          subcategory: 'saco-formal',
          categoryId: toId('cat-sacos'),
          categoryMetadata: md,
          material: 'wool',
          // colour intentionally NOT confirmed → must stay unchanged
        }),
      ),
    );
    const updated = await repo.findById(toId('gc'));
    expect(updated?.category).toBe('sacos');
    expect(updated?.material).toBe('wool');
    expect(updated?.formality).toBe(9);
    expect(updated?.color.hex).toBe(g.color.hex); // unchanged
    expect(bus.published.some((e) => e.type === WardrobeEvents.GarmentUpdated)).toBe(true);
  });

  it('reports unavailable when no pixels and no vision model', async () => {
    const repo = new InMemoryGarmentRepository();
    const g = makeGarment({ id: 'gn' });
    await repo.save(g);
    const suggestion = unwrap(
      await new SuggestGarmentTagsHandler(repo, new DeferredVisionTagSuggester()).handle(
        new SuggestGarmentTagsQuery(toId('gn')),
      ),
    );
    expect(suggestion.unavailable).toBe(true);
  });
});

describe('Search / filter / sort (Module 2)', () => {
  const garments = [
    makeGarment({
      id: 's1',
      name: 'Blazer negro',
      category: 'outerwear',
      subcategory: 'blazer',
      tags: ['formal'],
    }),
    makeGarment({
      id: 's2',
      name: 'Camiseta blanca',
      category: 'tops',
      subcategory: 't-shirt',
      wearCount: 10,
    }),
    makeGarment({
      id: 's3',
      name: 'Camisa azul',
      category: 'tops',
      subcategory: 'shirt',
      wearCount: 2,
    }),
  ];
  garments[0]!.archive();

  it('excludes archived by default and supports text + filters', () => {
    const r = searchGarments(garments, { text: 'camis' });
    expect(r.items.map((g) => g.id).sort()).toEqual(['s2', 's3']);
    const tops = searchGarments(garments, { category: 'tops' });
    expect(tops.items).toHaveLength(2);
    const withArchived = searchGarments(garments, { includeArchived: true, text: 'blazer' });
    expect(withArchived.items.map((g) => g.id)).toEqual(['s1']);
  });

  it('sorts and paginates', () => {
    const byWear = searchGarments(garments, { sortBy: 'wearCount', sortDirection: 'desc' });
    expect(byWear.items[0]?.id).toBe('s2');
    const paged = searchGarments(garments, { pageSize: 1, page: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.totalPages).toBe(2);
  });
});

describe('Event-driven cognitive sync (Module 6)', () => {
  it('fans every garment change out to all wired subsystems automatically', async () => {
    const bus = new TestBus();
    const notified = {
      inventoryUpsert: [] as string[],
      inventoryRemove: [] as string[],
      indexed: [] as string[],
      removedFromIndex: [] as string[],
      recoInvalidations: 0,
      vizInvalidations: [] as string[],
      history: [] as string[],
      preferenceForgets: [] as string[],
    };
    const subsystems: WardrobeSyncSubsystems = {
      inventory: {
        applyUpserted: (s) => {
          notified.inventoryUpsert.push(s.id);
        },
        applyRemoved: (id) => {
          notified.inventoryRemove.push(id);
        },
      },
      semanticIndex: {
        index: async (s) => {
          notified.indexed.push(s.id);
        },
        remove: async (id) => {
          notified.removedFromIndex.push(id);
        },
      },
      cache: {
        invalidateRecommendations: () => {
          notified.recoInvalidations += 1;
        },
        invalidateVisualization: (id) => {
          notified.vizInvalidations.push(id);
        },
      },
      history: {
        record: (name) => {
          notified.history.push(name);
        },
      },
      preferenceMemory: {
        onGarmentRemoved: (id) => {
          notified.preferenceForgets.push(id);
        },
      },
    };
    const coordinator = new WardrobeSyncCoordinator(bus, subsystems).start();

    const snapshot: GarmentSnapshot = {
      id: toId<'Garment'>('g1') as GarmentId,
      name: 'Camisa',
      category: 'tops',
      subcategory: 'shirt',
      categoryId: undefined,
      status: 'available',
      tags: [],
      searchText: 'camisa tops shirt',
    };

    await bus.publish(WardrobeEvents.GarmentAdded, { garment: snapshot });
    await bus.publish(WardrobeEvents.GarmentRemoved, { garmentId: snapshot.id });

    // Added → inventory + semantic index + recommendation cache + viz + history
    expect(notified.inventoryUpsert).toContain('g1');
    expect(notified.indexed).toContain('g1');
    expect(notified.recoInvalidations).toBeGreaterThanOrEqual(2);
    expect(notified.vizInvalidations).toContain('g1');
    expect(notified.history).toContain(WardrobeEvents.GarmentAdded);
    // Removed → inventory removal + index removal + preference memory + history
    expect(notified.inventoryRemove).toContain('g1');
    expect(notified.removedFromIndex).toContain('g1');
    expect(notified.preferenceForgets).toContain('g1');
    expect(notified.history).toContain(WardrobeEvents.GarmentRemoved);

    coordinator.stop();
  });
});

/* A fully-populated stub suggester (used to document the confirmation contract). */
const _stubSuggester: IGarmentTagSuggester = {
  id: 'stub',
  isAvailable: async () => true,
  suggest: async (): Promise<GarmentTagSuggestion> => ({
    source: 'stub',
    unavailable: false,
    category: { value: 'tops', confidence: 0.9 },
    colors: { value: ['#ffffff'], confidence: 0.8 },
  }),
};
void _stubSuggester;
