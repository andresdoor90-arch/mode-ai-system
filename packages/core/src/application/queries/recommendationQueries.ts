/**
 * Recommendation query — exposes the AI Orchestrator through the application
 * bus, so callers (the desktop main process, tests, a future API) reach the
 * cognitive engine the same CQRS way they reach every other use case:
 * `queries.ask(new RecommendOutfitsQuery(...))`.
 *
 * The handler is a thin adapter: it owns no intelligence itself, it simply
 * delegates to the {@link AIOrchestrator} and wraps the result in a `Result`.
 */
import { ok, type Result } from '../../shared/Result';
import { type Query, type RequestHandler } from '../bus/types';
import { type AIOrchestrator } from '../orchestration/AIOrchestrator';
import { type RecommendationRequest, type RecommendationSet } from '../orchestration/types';

export const RECOMMEND_OUTFITS = 'outfit.recommend';

/** Ask the AI engine for three explained outfit recommendations. */
export class RecommendOutfitsQuery implements Query<RecommendationSet> {
  public readonly type = RECOMMEND_OUTFITS;
  public constructor(public readonly input: RecommendationRequest) {}
}

export class RecommendOutfitsHandler implements RequestHandler<
  RecommendOutfitsQuery,
  RecommendationSet
> {
  public constructor(private readonly orchestrator: AIOrchestrator) {}

  public async handle(query: RecommendOutfitsQuery): Promise<Result<RecommendationSet>> {
    const set = await this.orchestrator.recommend(query.input);
    return ok(set);
  }
}
