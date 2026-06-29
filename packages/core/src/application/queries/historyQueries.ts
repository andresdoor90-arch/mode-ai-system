/**
 * Outfit-history queries (Phase 7 Part B): search/filter/sort, usage statistics
 * and recent-repetition detection. Each handler reads the persisted history via
 * the {@link IOutfitHistoryRepository} port and delegates to the pure
 * {@link OutfitHistoryService} — no business logic lives in the handler.
 */
import { type GarmentId } from '../../shared/Identifier';
import { ok, type Result } from '../../shared/Result';
import { type IOutfitHistoryRepository } from '../../domain/repositories/IOutfitHistoryRepository';
import { type Query, type RequestHandler } from '../bus/types';
import {
  OutfitHistoryService,
  type OutfitHistoryPage,
  type OutfitHistoryQueryOptions,
  type OutfitHistoryStatistics,
  type RepetitionGroup,
} from '../history/OutfitHistoryService';

/* ---------------------------- SearchOutfitHistory ------------------------- */

export const SEARCH_OUTFIT_HISTORY = 'history.search';

export class SearchOutfitHistoryQuery implements Query<OutfitHistoryPage> {
  public readonly type = SEARCH_OUTFIT_HISTORY;
  public constructor(public readonly options: OutfitHistoryQueryOptions = {}) {}
}

export class SearchOutfitHistoryHandler
  implements RequestHandler<SearchOutfitHistoryQuery, OutfitHistoryPage>
{
  public constructor(private readonly history: IOutfitHistoryRepository) {}

  public async handle(query: SearchOutfitHistoryQuery): Promise<Result<OutfitHistoryPage>> {
    const entries = await this.history.findAll();
    return ok(OutfitHistoryService.search(entries, query.options));
  }
}

/* ------------------------- GetOutfitHistoryStatistics --------------------- */

export const GET_OUTFIT_HISTORY_STATISTICS = 'history.statistics';

export class GetOutfitHistoryStatisticsQuery implements Query<OutfitHistoryStatistics> {
  public readonly type = GET_OUTFIT_HISTORY_STATISTICS;
}

export class GetOutfitHistoryStatisticsHandler
  implements RequestHandler<GetOutfitHistoryStatisticsQuery, OutfitHistoryStatistics>
{
  public constructor(private readonly history: IOutfitHistoryRepository) {}

  public async handle(): Promise<Result<OutfitHistoryStatistics>> {
    const entries = await this.history.findAll();
    return ok(OutfitHistoryService.statistics(entries));
  }
}

/* --------------------------- GetRecentRepetitions ------------------------- */

export const GET_RECENT_REPETITIONS = 'history.recent-repetitions';

export class GetRecentRepetitionsQuery implements Query<readonly RepetitionGroup[]> {
  public readonly type = GET_RECENT_REPETITIONS;
  public constructor(public readonly window?: number) {}
}

export class GetRecentRepetitionsHandler
  implements RequestHandler<GetRecentRepetitionsQuery, readonly RepetitionGroup[]>
{
  public constructor(private readonly history: IOutfitHistoryRepository) {}

  public async handle(
    query: GetRecentRepetitionsQuery,
  ): Promise<Result<readonly RepetitionGroup[]>> {
    const entries = await this.history.findAll();
    return ok(
      query.window !== undefined
        ? OutfitHistoryService.recentRepetitions(entries, query.window)
        : OutfitHistoryService.recentRepetitions(entries),
    );
  }
}

/* ------------------------------ GetOutfitHistory -------------------------- */

export const GET_GARMENT_USAGE_HISTORY = 'history.by-garment';

/** All usages that include a given garment, most-recent first. */
export class GetGarmentUsageHistoryQuery implements Query<OutfitHistoryPage> {
  public readonly type = GET_GARMENT_USAGE_HISTORY;
  public constructor(public readonly garmentId: GarmentId) {}
}

export class GetGarmentUsageHistoryHandler
  implements RequestHandler<GetGarmentUsageHistoryQuery, OutfitHistoryPage>
{
  public constructor(private readonly history: IOutfitHistoryRepository) {}

  public async handle(query: GetGarmentUsageHistoryQuery): Promise<Result<OutfitHistoryPage>> {
    const entries = await this.history.findByGarment(query.garmentId);
    return ok(
      OutfitHistoryService.search(entries, {
        sort: { by: 'wornOn', direction: 'desc' },
      }),
    );
  }
}
