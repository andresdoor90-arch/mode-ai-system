import { describe, it, expect } from 'vitest';

import {
  Color,
  Garment,
  GarmentCategory,
  type GarmentId,
  type IGarmentRepository,
  type IOutfitHistoryRepository,
  type Id,
  Occasion,
  OutfitHistoryEntry,
  type OutfitHistoryEntryId,
  OutfitHistoryService,
  Season,
  toId,
  unwrap,
} from '../../index';
import { HistoryAnalyzer } from '../orchestration/HistoryAnalyzer';
import { MemoryEngine } from '../orchestration/MemoryEngine';
import { type IOutfitRepository } from '../../domain/repositories/IOutfitRepository';
import { SequentialIdGenerator } from '../../shared/IdGenerator';
import {
  AnnotateOutfitHistoryCommand,
  AnnotateOutfitHistoryHandler,
  RecordOutfitFeedbackCommand,
  RecordOutfitFeedbackHandler,
  RecordOutfitUsageCommand,
  RecordOutfitUsageHandler,
  RepeatOutfitCommand,
  RepeatOutfitHandler,
} from '../commands/historyCommands';
import {
  GetOutfitHistoryStatisticsHandler,
  GetOutfitHistoryStatisticsQuery,
  GetRecentRepetitionsHandler,
  GetRecentRepetitionsQuery,
  SearchOutfitHistoryHandler,
  SearchOutfitHistoryQuery,
} from '../queries/historyQueries';

let counter = 0;
const nextId = <T extends string>(brand: T): Id<T> => toId<T>(`${brand}-${(counter += 1)}`);

const blue = (): Color => unwrap(Color.fromHex('#3366cc', 'blue'));

const makeGarment = (name = 'Tee'): Garment =>
  unwrap(
    Garment.create(nextId('Garment'), {
      name,
      category: GarmentCategory.Tops,
      subcategory: 't-shirt',
      color: blue(),
      seasons: [Season.AllSeason],
    }),
  );

class InMemoryGarmentRepo implements IGarmentRepository {
  public readonly store = new Map<string, Garment>();
  public async save(g: Garment): Promise<void> {
    this.store.set(g.id, g);
  }
  public async findById(id: GarmentId): Promise<Garment | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly Garment[]> {
    return [...this.store.values()];
  }
  public async query(): Promise<readonly Garment[]> {
    return [...this.store.values()];
  }
  public async findByCategory(): Promise<readonly Garment[]> {
    return [...this.store.values()];
  }
  public async delete(id: GarmentId): Promise<void> {
    this.store.delete(id);
  }
  public async count(): Promise<number> {
    return this.store.size;
  }
}

class InMemoryHistoryRepo implements IOutfitHistoryRepository {
  public readonly store = new Map<string, OutfitHistoryEntry>();
  public async save(e: OutfitHistoryEntry): Promise<void> {
    this.store.set(e.id, e);
  }
  public async findById(id: OutfitHistoryEntryId): Promise<OutfitHistoryEntry | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly OutfitHistoryEntry[]> {
    return [...this.store.values()];
  }
  public async findByGarment(garmentId: GarmentId): Promise<readonly OutfitHistoryEntry[]> {
    return [...this.store.values()].filter((e) => e.garmentIds.includes(garmentId));
  }
  public async delete(id: OutfitHistoryEntryId): Promise<void> {
    this.store.delete(id);
  }
  public async count(): Promise<number> {
    return this.store.size;
  }
}

const emptyOutfitRepo: IOutfitRepository = {
  save: async () => undefined,
  findById: async () => null,
  findAll: async () => [],
  query: async () => [],
  findByOccasion: async () => [],
  delete: async () => undefined,
};

const entry = (
  garmentIds: GarmentId[],
  over: Partial<{
    wornOn: string;
    role: string;
    event: string;
    occasion: Occasion;
    satisfaction: number;
    createdAt: string;
  }> = {},
): OutfitHistoryEntry =>
  unwrap(
    OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
      garmentIds,
      wornOn: over.wornOn ?? '2026-07-01',
      createdAt: over.createdAt ?? `${over.wornOn ?? '2026-07-01'}T08:00:00.000Z`,
      ...(over.role !== undefined ? { role: over.role } : {}),
      ...(over.event !== undefined ? { event: over.event } : {}),
      ...(over.occasion !== undefined ? { occasion: over.occasion } : {}),
      ...(over.satisfaction !== undefined ? { satisfaction: over.satisfaction } : {}),
    }),
  );

describe('OutfitHistoryEntry', () => {
  it('validates inputs and derives an order-independent signature', () => {
    const a = toId<'Garment'>('g-a');
    const b = toId<'Garment'>('g-b');
    const e1 = unwrap(
      OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
        garmentIds: [a, b],
        wornOn: '2026-07-01',
        createdAt: '2026-07-01T00:00:00.000Z',
        role: 'drummer',
      }),
    );
    const e2 = unwrap(
      OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
        garmentIds: [b, a],
        wornOn: '2026-07-01',
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
    );
    expect(e1.signature).toBe(e2.signature);
    expect(e1.role).toBe('drummer');

    const bad = OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
      garmentIds: [],
      wornOn: '2026-07-01',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    expect(bad.ok).toBe(false);

    const badDate = OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
      garmentIds: [a],
      wornOn: '07/01/2026',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    expect(badDate.ok).toBe(false);

    const badSat = OutfitHistoryEntry.create(nextId('OutfitHistoryEntry'), {
      garmentIds: [a],
      wornOn: '2026-07-01',
      createdAt: '2026-07-01T00:00:00.000Z',
      satisfaction: 9,
    });
    expect(badSat.ok).toBe(false);
  });
});

describe('OutfitHistoryService', () => {
  const ga = toId<'Garment'>('g-a');
  const gb = toId<'Garment'>('g-b');
  const gc = toId<'Garment'>('g-c');
  const entries = [
    entry([ga, gb], { wornOn: '2026-07-01', role: 'pianist', event: 'service', satisfaction: 5 }),
    entry([ga, gc], { wornOn: '2026-07-05', role: 'drummer', event: 'concert', satisfaction: 3 }),
    entry([ga, gb], { wornOn: '2026-07-08', role: 'pianist', event: 'service', satisfaction: 4 }),
  ];

  it('filters by role, garment, date range and text', () => {
    expect(OutfitHistoryService.filter(entries, { role: 'pianist' })).toHaveLength(2);
    expect(OutfitHistoryService.filter(entries, { garmentId: gc })).toHaveLength(1);
    expect(
      OutfitHistoryService.filter(entries, { from: '2026-07-04', to: '2026-07-06' }),
    ).toHaveLength(1);
    expect(OutfitHistoryService.filter(entries, { text: 'concert' })).toHaveLength(1);
    expect(OutfitHistoryService.filter(entries, { minSatisfaction: 4 })).toHaveLength(2);
  });

  it('sorts by date ascending and descending', () => {
    const asc = OutfitHistoryService.sort(entries, { by: 'wornOn', direction: 'asc' });
    expect(asc.map((e) => e.wornOn)).toEqual(['2026-07-01', '2026-07-05', '2026-07-08']);
    const desc = OutfitHistoryService.sort(entries, { by: 'wornOn', direction: 'desc' });
    expect(desc[0]?.wornOn).toBe('2026-07-08');
  });

  it('paginates search results', () => {
    const page = OutfitHistoryService.search(entries, { page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
  });

  it('computes usage statistics', () => {
    const stats = OutfitHistoryService.statistics(entries);
    expect(stats.totalUses).toBe(3);
    expect(stats.uniqueOutfits).toBe(2); // [a,b] twice, [a,c] once
    expect(stats.byRole['pianist']).toBe(2);
    expect(stats.averageSatisfaction).toBeCloseTo((5 + 3 + 4) / 3);
    expect(stats.garmentUsage[0]?.[0]).toBe(ga); // most-used garment
    expect(stats.lastWornOn).toBe('2026-07-08');
  });

  it('detects recent repetitions by signature', () => {
    const reps = OutfitHistoryService.recentRepetitions(entries, 10);
    expect(reps).toHaveLength(1);
    expect(reps[0]?.count).toBe(2);
    expect([...reps[0]!.garmentIds].sort()).toEqual([ga, gb].sort());
  });
});

describe('history use cases', () => {
  it('RecordOutfitUsage persists an entry and marks garments worn', async () => {
    const garments = new InMemoryGarmentRepo();
    const history = new InMemoryHistoryRepo();
    const g1 = makeGarment('A');
    const g2 = makeGarment('B');
    await garments.save(g1);
    await garments.save(g2);
    const handler = new RecordOutfitUsageHandler(
      garments,
      history,
      new SequentialIdGenerator('h'),
      () => '2026-07-10T09:00:00.000Z',
    );
    const res = await handler.handle(
      new RecordOutfitUsageCommand([g1.id, g2.id], { role: 'guest', place: 'church' }),
    );
    expect(res.ok).toBe(true);
    expect(await history.count()).toBe(1);
    const stored = (await history.findAll())[0]!;
    expect(stored.wornOn).toBe('2026-07-10');
    expect(stored.role).toBe('guest');
    expect((await garments.findById(g1.id))?.wearCount).toBe(1);
    expect((await garments.findById(g1.id))?.lastWornAt).toBe('2026-07-10');
  });

  it('RecordOutfitFeedback records history + feeds memory when accepted, only memory when rejected', async () => {
    const garments = new InMemoryGarmentRepo();
    const history = new InMemoryHistoryRepo();
    const g1 = makeGarment('A');
    await garments.save(g1);
    const memory = new MemoryEngine(undefined, () => '2026-07-10T00:00:00.000Z');
    const handler = new RecordOutfitFeedbackHandler(
      garments,
      history,
      new SequentialIdGenerator('h'),
      memory,
      () => '2026-07-10T09:00:00.000Z',
    );

    const accepted = await handler.handle(
      new RecordOutfitFeedbackCommand({ garmentIds: [g1.id], accepted: true, context: { role: 'singer' } }),
    );
    expect(accepted.ok && accepted.value.historyEntryId !== null).toBe(true);
    expect(await history.count()).toBe(1);
    expect(memory.current().acceptCount).toBe(1);

    const rejected = await handler.handle(
      new RecordOutfitFeedbackCommand({ garmentIds: [g1.id], accepted: false }),
    );
    expect(rejected.ok && rejected.value.historyEntryId === null).toBe(true);
    expect(await history.count()).toBe(1); // unchanged — rejection records no history
    expect(memory.current().rejectCount).toBe(1);
  });

  it('RepeatOutfit re-issues a past outfit as a fresh usage', async () => {
    const garments = new InMemoryGarmentRepo();
    const history = new InMemoryHistoryRepo();
    const g1 = makeGarment('A');
    const g2 = makeGarment('B');
    await garments.save(g1);
    await garments.save(g2);
    const ids = new SequentialIdGenerator('h');
    const record = new RecordOutfitUsageHandler(garments, history, ids, () => '2026-07-01T09:00:00.000Z');
    const first = await record.handle(
      new RecordOutfitUsageCommand([g1.id, g2.id], { role: 'preacher' }),
    );
    expect(first.ok).toBe(true);
    const entryId = first.ok ? first.value : undefined;

    const repeat = new RepeatOutfitHandler(garments, history, ids, () => '2026-07-20T09:00:00.000Z');
    const res = await repeat.handle(new RepeatOutfitCommand({ entryId: entryId! }));
    expect(res.ok).toBe(true);
    expect(await history.count()).toBe(2);
    const repeated = (await history.findAll()).find((e) => e.source === 'repeat');
    expect(repeated?.wornOn).toBe('2026-07-20');
    expect(repeated?.role).toBe('preacher'); // carried from the source entry
  });

  it('AnnotateOutfitHistory edits comments and satisfaction', async () => {
    const history = new InMemoryHistoryRepo();
    const e = entry([toId<'Garment'>('g-a')]);
    await history.save(e);
    const handler = new AnnotateOutfitHistoryHandler(history);
    const res = await handler.handle(
      new AnnotateOutfitHistoryCommand({ entryId: e.id, comments: 'loved it', satisfaction: 5 }),
    );
    expect(res.ok).toBe(true);
    expect((await history.findById(e.id))?.comments).toBe('loved it');
    expect((await history.findById(e.id))?.satisfaction).toBe(5);
  });
});

describe('persisted history feeds the cognitive engine', () => {
  it('HistoryAnalyzer surfaces recorded-usage signatures for freshness/repetition', async () => {
    const history = new InMemoryHistoryRepo();
    const ga = toId<'Garment'>('g-a');
    const gb = toId<'Garment'>('g-b');
    await history.save(entry([ga, gb], { wornOn: '2026-07-08' }));

    const analyzer = new HistoryAnalyzer(emptyOutfitRepo, history);
    const insights = await analyzer.analyze();
    // The recorded combination's signature is available so the scorer's
    // "no recent repeats" rule can fire — proving history feeds the engine.
    expect(insights.recentSignatures).toContain([ga, gb].sort().join('|'));
    expect(insights.recentCount).toBe(1);
  });

  it('analyzer without a history source is unchanged (backwards-compatible)', async () => {
    const analyzer = new HistoryAnalyzer(emptyOutfitRepo);
    const insights = await analyzer.analyze();
    expect(insights.recentSignatures).toEqual([]);
    expect(insights.recentCount).toBe(0);
  });
});

describe('history queries', () => {
  it('SearchOutfitHistory / Statistics / RecentRepetitions read through the port', async () => {
    const history = new InMemoryHistoryRepo();
    const ga = toId<'Garment'>('g-a');
    const gb = toId<'Garment'>('g-b');
    await history.save(entry([ga, gb], { wornOn: '2026-07-01', role: 'pianist' }));
    await history.save(entry([ga, gb], { wornOn: '2026-07-05', role: 'pianist' }));

    const search = await new SearchOutfitHistoryHandler(history).handle(
      new SearchOutfitHistoryQuery({ filter: { role: 'pianist' } }),
    );
    expect(search.ok && search.value.total).toBe(2);

    const stats = await new GetOutfitHistoryStatisticsHandler(history).handle(
      new GetOutfitHistoryStatisticsQuery(),
    );
    expect(stats.ok && stats.value.uniqueOutfits).toBe(1);

    const reps = await new GetRecentRepetitionsHandler(history).handle(
      new GetRecentRepetitionsQuery(),
    );
    expect(reps.ok && reps.value.length).toBe(1);
  });
});
