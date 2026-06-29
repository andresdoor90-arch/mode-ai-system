/**
 * Outfit-history application service — PURE logic over recorded usage entries.
 *
 * Provides the history capabilities the product requires (search, filter, sort,
 * usage statistics and recent-repetition detection) as deterministic functions
 * over a list of {@link OutfitHistoryEntry}. Keeping this pure (no repository,
 * no I/O) makes it trivially unit-testable offline and lets the SQL or in-memory
 * repository stay a thin {@link IOutfitHistoryRepository#findAll} provider.
 *
 * Recent-repetition detection reuses each entry's canonical combination
 * {@link OutfitHistoryEntry.signature} — the SAME definition the scorer uses —
 * so there is no duplicated freshness rule.
 */
import { type GarmentId } from '../../shared/Identifier';
import {
  type OutfitHistoryEntry,
  type OutfitUsageSource,
} from '../../domain/entities/OutfitHistoryEntry';
import { type Occasion } from '../../domain/value-objects/Occasion';

/** Criteria for narrowing the history. Omitted fields are not constrained. */
export interface OutfitHistoryFilter {
  /** Free-text match against label/place/event/role/comments/weather/occasion. */
  readonly text?: string;
  readonly role?: string;
  readonly event?: string;
  readonly place?: string;
  readonly occasion?: Occasion;
  readonly garmentId?: GarmentId;
  readonly source?: OutfitUsageSource;
  /** Minimum satisfaction (1–5). */
  readonly minSatisfaction?: number;
  /** Inclusive ISO date lower bound (worn on/after). */
  readonly from?: string;
  /** Inclusive ISO date upper bound (worn on/before). */
  readonly to?: string;
}

export type OutfitHistorySortBy = 'wornOn' | 'satisfaction' | 'createdAt';
/** Local sort direction (the public `SortDirection` lives in garmentSearch). */
type SortDirection = 'asc' | 'desc';

export interface OutfitHistorySort {
  readonly by: OutfitHistorySortBy;
  readonly direction: SortDirection;
}

export interface OutfitHistoryQueryOptions {
  readonly filter?: OutfitHistoryFilter;
  readonly sort?: OutfitHistorySort;
  /** 1-based page number (defaults to 1). */
  readonly page?: number;
  /** Page size (defaults to all results). */
  readonly pageSize?: number;
}

export interface OutfitHistoryPage {
  readonly items: readonly OutfitHistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

/** Aggregate usage statistics. */
export interface OutfitHistoryStatistics {
  readonly totalUses: number;
  /** Distinct combinations (by signature). */
  readonly uniqueOutfits: number;
  readonly byRole: Readonly<Record<string, number>>;
  readonly byEvent: Readonly<Record<string, number>>;
  readonly byOccasion: Readonly<Record<string, number>>;
  /** Average satisfaction across entries that recorded one, or null. */
  readonly averageSatisfaction: number | null;
  /** Garment id → number of usages, most-used first. */
  readonly garmentUsage: ReadonlyArray<readonly [GarmentId, number]>;
  /** ISO date of the most recent usage, or null. */
  readonly lastWornOn: string | null;
}

/** A repeated combination detected within the recent window. */
export interface RepetitionGroup {
  readonly signature: string;
  readonly count: number;
  readonly garmentIds: readonly GarmentId[];
  /** ISO dates (most recent first) the combination was worn. */
  readonly wornOn: readonly string[];
}

const norm = (v: string): string => v.trim().toLowerCase();

/** Default recent-repetition window (number of most-recent entries scanned). */
export const DEFAULT_REPETITION_WINDOW = 10;

export class OutfitHistoryService {
  /** Apply a filter, returning a NEW array (input untouched). */
  public static filter(
    entries: readonly OutfitHistoryEntry[],
    filter: OutfitHistoryFilter = {},
  ): readonly OutfitHistoryEntry[] {
    return entries.filter((e) => {
      if (filter.text !== undefined && filter.text.trim().length > 0) {
        if (!e.searchText.includes(norm(filter.text))) {
          return false;
        }
      }
      if (filter.role !== undefined && norm(e.role ?? '') !== norm(filter.role)) {
        return false;
      }
      if (filter.event !== undefined && norm(e.event ?? '') !== norm(filter.event)) {
        return false;
      }
      if (filter.place !== undefined && norm(e.place ?? '') !== norm(filter.place)) {
        return false;
      }
      if (filter.occasion !== undefined && e.occasion !== filter.occasion) {
        return false;
      }
      if (filter.source !== undefined && e.source !== filter.source) {
        return false;
      }
      if (filter.garmentId !== undefined && !e.garmentIds.includes(filter.garmentId)) {
        return false;
      }
      if (filter.minSatisfaction !== undefined && (e.satisfaction ?? -1) < filter.minSatisfaction) {
        return false;
      }
      if (filter.from !== undefined && e.wornOn < filter.from) {
        return false;
      }
      if (filter.to !== undefined && e.wornOn > filter.to) {
        return false;
      }
      return true;
    });
  }

  /** Sort by the requested key, returning a NEW array. */
  public static sort(
    entries: readonly OutfitHistoryEntry[],
    sort: OutfitHistorySort = { by: 'wornOn', direction: 'desc' },
  ): readonly OutfitHistoryEntry[] {
    const dir = sort.direction === 'asc' ? 1 : -1;
    const keyOf = (e: OutfitHistoryEntry): string | number => {
      switch (sort.by) {
        case 'satisfaction':
          return e.satisfaction ?? 0;
        case 'createdAt':
          return e.createdAt;
        case 'wornOn':
        default:
          // Use date + creation time as a stable tiebreaker.
          return `${e.wornOn}T${e.createdAt}`;
      }
    };
    return [...entries].sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      if (ka < kb) {
        return -1 * dir;
      }
      if (ka > kb) {
        return 1 * dir;
      }
      return 0;
    });
  }

  /** Filter + sort + paginate in one call. */
  public static search(
    entries: readonly OutfitHistoryEntry[],
    options: OutfitHistoryQueryOptions = {},
  ): OutfitHistoryPage {
    const filtered = OutfitHistoryService.filter(entries, options.filter);
    const sorted = OutfitHistoryService.sort(
      filtered,
      options.sort ?? { by: 'wornOn', direction: 'desc' },
    );
    const total = sorted.length;
    const pageSize = options.pageSize !== undefined && options.pageSize > 0 ? options.pageSize : total;
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const page = Math.min(Math.max(1, options.page ?? 1), totalPages);
    const start = (page - 1) * pageSize;
    const items = pageSize > 0 ? sorted.slice(start, start + pageSize) : sorted;
    return { items, total, page, totalPages };
  }

  /** Aggregate usage statistics across all supplied entries. */
  public static statistics(entries: readonly OutfitHistoryEntry[]): OutfitHistoryStatistics {
    const byRole: Record<string, number> = {};
    const byEvent: Record<string, number> = {};
    const byOccasion: Record<string, number> = {};
    const garmentUsage = new Map<string, number>();
    const signatures = new Set<string>();
    let satTotal = 0;
    let satCount = 0;
    let lastWornOn: string | null = null;

    for (const e of entries) {
      signatures.add(e.signature);
      if (e.role !== undefined) {
        byRole[e.role] = (byRole[e.role] ?? 0) + 1;
      }
      if (e.event !== undefined) {
        byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
      }
      if (e.occasion !== undefined) {
        byOccasion[e.occasion] = (byOccasion[e.occasion] ?? 0) + 1;
      }
      if (e.satisfaction !== undefined) {
        satTotal += e.satisfaction;
        satCount += 1;
      }
      for (const id of e.garmentIds) {
        garmentUsage.set(id, (garmentUsage.get(id) ?? 0) + 1);
      }
      if (lastWornOn === null || e.wornOn > lastWornOn) {
        lastWornOn = e.wornOn;
      }
    }

    return {
      totalUses: entries.length,
      uniqueOutfits: signatures.size,
      byRole,
      byEvent,
      byOccasion,
      averageSatisfaction: satCount > 0 ? satTotal / satCount : null,
      garmentUsage: [...garmentUsage.entries()]
        .map(([id, n]) => [id as GarmentId, n] as const)
        .sort((a, b) => b[1] - a[1]),
      lastWornOn,
    };
  }

  /**
   * Detect combinations worn more than once within the most-recent `window`
   * entries. Reuses each entry's canonical signature (no duplicated rule).
   */
  public static recentRepetitions(
    entries: readonly OutfitHistoryEntry[],
    window = DEFAULT_REPETITION_WINDOW,
  ): readonly RepetitionGroup[] {
    const recent = OutfitHistoryService.sort(entries, { by: 'wornOn', direction: 'desc' }).slice(
      0,
      Math.max(0, window),
    );
    const groups = new Map<string, { garmentIds: readonly GarmentId[]; wornOn: string[] }>();
    for (const e of recent) {
      const existing = groups.get(e.signature);
      if (existing === undefined) {
        groups.set(e.signature, { garmentIds: e.garmentIds, wornOn: [e.wornOn] });
      } else {
        existing.wornOn.push(e.wornOn);
      }
    }
    return [...groups.entries()]
      .filter(([, g]) => g.wornOn.length > 1)
      .map(([signature, g]) => ({
        signature,
        count: g.wornOn.length,
        garmentIds: g.garmentIds,
        wornOn: [...g.wornOn].sort((a, b) => (a < b ? 1 : -1)),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
