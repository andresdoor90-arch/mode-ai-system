/**
 * AI Orchestrator — the cognitive core of M-A-S.
 *
 * Coordinates the full recommendation process from a free-text request to three
 * explained outfits. ALL intelligence lives here and in the domain; AI models
 * are reached only through abstract ports and are strictly optional. With no
 * provider configured the orchestrator still produces complete recommendations
 * from domain rules + scoring alone (MANDATORY graceful degradation). When a
 * provider is available it ADDS a semantic ranking boost and natural-language
 * explanations — never overriding a hard domain rule.
 *
 * The pipeline implements exactly the required flow:
 *   1. interpret the user's message            (ContextAnalyzer)
 *   2. extract structured context              (ContextAnalyzer)
 *   3. analyze outfit history                  (HistoryAnalyzer)
 *   4. analyze learned preferences             (MemoryEngine + PreferenceEngine)
 *   5. query inventory                         (InventoryAnalyzer)
 *   6. get candidates                          (OutfitCandidateGenerator)
 *   7. evaluate with DOMAIN rules              (OutfitRankingEngine + OutfitScoringService)
 *   8. optionally enrich via an AI provider    (AIProviderRouter + EmbeddingManager)
 *   9. generate THREE recommendations          (Principal / Más elegante / Más cómoda)
 *  10. explain the reasoning for each          (ExplanationGenerator)
 */
import { type Garment } from '../../domain/entities/Garment';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type IOutfitHistoryRepository } from '../../domain/repositories/IOutfitHistoryRepository';
import { type IOutfitRepository } from '../../domain/repositories/IOutfitRepository';
import { type IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { garmentFormality } from '../../domain/services/formality';
import {
  OutfitScoringService,
  type ScoringContext,
} from '../../domain/services/OutfitScoringService';

import { ContextAnalyzer } from './ContextAnalyzer';
import { HistoryAnalyzer } from './HistoryAnalyzer';
import { InventoryAnalyzer } from './InventoryAnalyzer';
import { OutfitCandidateGenerator } from './OutfitCandidateGenerator';
import { OutfitRankingEngine, type RankedCandidate } from './OutfitRankingEngine';
import { ExplanationGenerator } from './ExplanationGenerator';
import { PreferenceEngine } from './PreferenceEngine';
import { MemoryEngine } from './MemoryEngine';
import { AIProviderRouter } from './AIProviderRouter';
import { EmbeddingManager } from './EmbeddingManager';
import { type ITextProvider } from './ports';
import {
  RECOMMENDATION_LABELS,
  type OutfitRecommendation,
  type RecommendationContext,
  type RecommendationKind,
  type RecommendationRequest,
  type RecommendationSet,
} from './types';

/** Collaborators the orchestrator depends on. All AI parts are optional. */
export interface AIOrchestratorDeps {
  readonly garments: IGarmentRepository;
  readonly outfits: IOutfitRepository;
  readonly profiles: IUserProfileRepository;
  /** Persisted outfit-usage history; when present it feeds freshness/repetition. */
  readonly history?: IOutfitHistoryRepository;
  /** Router over text providers; absent/empty ⇒ offline, rules-only. */
  readonly router?: AIProviderRouter;
  /** Semantic embeddings manager; absent/unavailable ⇒ no semantic boost. */
  readonly embeddings?: EmbeddingManager;
  /** Persistent preference memory; absent ⇒ no learning applied. */
  readonly memory?: MemoryEngine;
  /** Override the domain scorer (e.g. custom weights). */
  readonly scoring?: OutfitScoringService;
  /** Injectable clock for deterministic timestamps/reference dates. */
  readonly clock?: () => string;
}

/** How many top candidates to consider when picking the three roles. */
const SELECTION_POOL = 25;

export class AIOrchestrator {
  private readonly contextAnalyzer = new ContextAnalyzer();
  private readonly history: HistoryAnalyzer;
  private readonly inventory: InventoryAnalyzer;
  private readonly generator = new OutfitCandidateGenerator();
  private readonly ranking: OutfitRankingEngine;
  private readonly explanations = new ExplanationGenerator();
  private readonly preferences = new PreferenceEngine();

  public constructor(private readonly deps: AIOrchestratorDeps) {
    this.history = new HistoryAnalyzer(deps.outfits, deps.history);
    this.inventory = new InventoryAnalyzer(deps.garments);
    this.ranking = new OutfitRankingEngine(deps.scoring ?? new OutfitScoringService());
  }

  /** Run the full pipeline and return up to three explained recommendations. */
  public async recommend(request: RecommendationRequest): Promise<RecommendationSet> {
    const notes: string[] = [];
    const referenceDate = request.referenceDate ?? this.today();

    // 1–2. Interpret the message and extract structured context.
    const analysis = this.contextAnalyzer.analyze(request);
    const context: RecommendationContext = analysis.ok
      ? analysis.value
      : this.fallbackContext(request);
    notes.push('Context extracted from the user message (rule-based, offline).');

    // 3. Analyze outfit history (freshness / repetition).
    const history = await this.history.analyze();
    notes.push(`History analyzed: ${history.recentCount} recent outfit(s).`);

    // 4. Analyze learned preferences.
    const memorySnapshot = this.deps.memory ? await this.deps.memory.load() : undefined;
    const profile = await this.deps.profiles.getCurrent();
    const derived = memorySnapshot
      ? this.preferences.derive(memorySnapshot, profile?.stylePreference)
      : undefined;
    const stylePreference = derived?.stylePreference ?? profile?.stylePreference;
    if (memorySnapshot) {
      notes.push(
        `Preferences applied (accepted ${memorySnapshot.acceptCount}, rejected ${memorySnapshot.rejectCount}).`,
      );
    }

    // 5. Query inventory.
    const inventory = await this.inventory.forContext(context);
    notes.push(`Inventory: ${inventory.all.length} eligible garment(s).`);

    // 8a. Decide on a provider up-front (drives explanations + degradation flag).
    const selection = this.deps.router
      ? await this.deps.router.select()
      : { provider: null, probed: [], note: 'No router configured; offline mode.' };
    notes.push(selection.note);
    const provider = selection.provider ?? undefined;

    // 8b. Index + semantic scores (optional, additive — never gates correctness).
    const embeddings = this.deps.embeddings;
    let semanticScores: ReadonlyMap<string, number> | undefined;
    if (embeddings?.available === true) {
      await embeddings.indexGarments(inventory.all);
      semanticScores = await embeddings.scoreByQuery(
        context.activity ?? context.rawMessage,
        SELECTION_POOL,
      );
      notes.push('Semantic similarity boost applied (additive).');
    }

    // 6. Generate candidates.
    const candidates = this.generator.generate(inventory, context, request.maxCandidates);

    // 7. Evaluate with DOMAIN rules (+ optional additive enrichment from 8).
    const scoringContext: ScoringContext = {
      ...(context.weather !== undefined ? { weather: context.weather } : {}),
      ...(stylePreference !== undefined ? { stylePreference } : {}),
      recentSignatures: history.recentSignatures,
      referenceDate,
    };
    const ranked = this.ranking.rank(candidates, context.occasion, context.season, scoringContext, {
      ...(semanticScores !== undefined ? { semanticScores } : {}),
      ...(memorySnapshot !== undefined
        ? {
            affinityBias: (g: readonly Garment[]) =>
              this.preferences.affinityBias(g, memorySnapshot),
          }
        : {}),
    });

    // 9. Select the three roles, then 10. explain each.
    const enrichedContext: RecommendationContext = {
      ...context,
      enrichedByProvider: provider !== undefined,
    };
    const picks = this.selectThree(ranked);
    const recommendations = await this.buildRecommendations(picks, enrichedContext, provider);

    const degraded = provider === undefined && embeddings?.available !== true;
    return {
      context: enrichedContext,
      recommendations,
      providerId: provider?.id ?? null,
      degraded,
      candidatesEvaluated: ranked.length,
      notes,
    };
  }

  /** Pick the three distinct roles from the ranked pool. */
  private selectThree(
    ranked: readonly RankedCandidate[],
  ): ReadonlyArray<readonly [RecommendationKind, RankedCandidate]> {
    if (ranked.length === 0) {
      return [];
    }
    const pool = ranked.slice(0, SELECTION_POOL);
    const used = new Set<string>();
    const sig = (c: RankedCandidate): string => OutfitScoringService.signatureOf(c.garments);

    const pickFrom = (sorted: readonly RankedCandidate[]): RankedCandidate | undefined => {
      for (const candidate of sorted) {
        const signature = sig(candidate);
        if (!used.has(signature)) {
          used.add(signature);
          return candidate;
        }
      }
      return undefined;
    };

    const formalityOf = (c: RankedCandidate): number =>
      c.garments.reduce((sum, g) => sum + garmentFormality(g.subcategory), 0) /
      Math.max(1, c.garments.length);
    const comfortOf = (c: RankedCandidate): number =>
      c.breakdown.factors.find((f) => f.name === 'comfortMobility')?.value ?? 0;

    // Principal: the best overall (pool is already ordered by final score).
    const principal = pickFrom(pool);

    // Más elegante: highest average formality, tie-broken by score.
    const byFormality = [...pool].sort(
      (a, b) => formalityOf(b) - formalityOf(a) || b.finalScore - a.finalScore,
    );
    const elegante = pickFrom(byFormality);

    // Más cómoda: highest comfort/mobility, tie-broken by score.
    const byComfort = [...pool].sort(
      (a, b) => comfortOf(b) - comfortOf(a) || b.finalScore - a.finalScore,
    );
    const comoda = pickFrom(byComfort);

    const result: Array<readonly [RecommendationKind, RankedCandidate]> = [];
    if (principal) {
      result.push(['principal', principal]);
    }
    if (elegante) {
      result.push(['mas-elegante', elegante]);
    }
    if (comoda) {
      result.push(['mas-comoda', comoda]);
    }
    return result;
  }

  private async buildRecommendations(
    picks: ReadonlyArray<readonly [RecommendationKind, RankedCandidate]>,
    context: RecommendationContext,
    provider: ITextProvider | undefined,
  ): Promise<readonly OutfitRecommendation[]> {
    const recommendations: OutfitRecommendation[] = [];
    for (const [kind, candidate] of picks) {
      const explanation = await this.explanations.explain(candidate, kind, context, provider);
      recommendations.push({
        kind,
        label: RECOMMENDATION_LABELS[kind],
        garments: candidate.garments,
        score: candidate.finalScore,
        breakdown: candidate.breakdown,
        explanation: explanation.text,
        ...(candidate.semanticBoost > 0 ? { semanticBoost: candidate.semanticBoost } : {}),
      });
    }
    return recommendations;
  }

  private fallbackContext(request: RecommendationRequest): RecommendationContext {
    // ContextAnalyzer.analyze never errors today, but keep a typed safety net.
    return {
      rawMessage: request.message,
      occasion: request.occasion ?? ('casual' as RecommendationContext['occasion']),
      season: request.season ?? ('all-season' as RecommendationContext['season']),
      ...(request.weather !== undefined ? { weather: request.weather } : {}),
      targetFormality: 3,
      comfortPriority: 0.5,
      mobilityNeed: 0.3,
      notes: ['Context analysis fell back to defaults.'],
      enrichedByProvider: false,
    };
  }

  private today(): string {
    const iso = (this.deps.clock ?? (() => new Date().toISOString()))();
    return iso.slice(0, 10);
  }
}
