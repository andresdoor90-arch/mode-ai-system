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
import {
  type GarmentImageLoader,
  type IOutfitPlanner,
  type ITextProvider,
  type PlannedOutfit,
  type PlannerContext,
  type PlannerGarment,
} from './ports';
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
  /**
   * Optional LLM outfit planner. When available it MAKES the styling decision
   * (selects the garments) and explains it; the orchestrator validates its
   * choices against the wardrobe and re-scores them, and falls back to the rule
   * engine when it is unavailable or returns nothing usable.
   */
  readonly planner?: IOutfitPlanner;
  /**
   * Loads garment thumbnails (base64) so the planner can SEE the garments.
   * Optional: without it the planner reasons from text attributes only.
   */
  readonly imageLoader?: GarmentImageLoader;
  /** Override the domain scorer (e.g. custom weights). */
  readonly scoring?: OutfitScoringService;
  /** Injectable clock for deterministic timestamps/reference dates. */
  readonly clock?: () => string;
}

/** How many top candidates to consider when picking the three roles. */
const SELECTION_POOL = 25;

/**
 * Upper bound on garment thumbnails attached to a single planning prompt.
 * Keeps the multimodal request within practical model/context limits; extra
 * garments are still listed as text and remain selectable by id.
 */
const MAX_PLANNER_IMAGES = 16;

export class AIOrchestrator {
  private readonly contextAnalyzer = new ContextAnalyzer();
  private readonly history: HistoryAnalyzer;
  private readonly inventory: InventoryAnalyzer;
  private readonly generator = new OutfitCandidateGenerator();
  private readonly ranking: OutfitRankingEngine;
  private readonly explanations = new ExplanationGenerator();
  private readonly preferences = new PreferenceEngine();
  private readonly scorer: OutfitScoringService;

  public constructor(private readonly deps: AIOrchestratorDeps) {
    this.history = new HistoryAnalyzer(deps.outfits, deps.history);
    this.inventory = new InventoryAnalyzer(deps.garments);
    this.scorer = deps.scoring ?? new OutfitScoringService();
    this.ranking = new OutfitRankingEngine(this.scorer);
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

    // 6′. LLM-DRIVEN SELECTION (preferred). When an outfit planner (a real LLM,
    // e.g. local qwen2.5vl via Ollama) is available, let it MAKE the styling
    // decision and write the explanation, reasoning over the eligible wardrobe.
    // We validate its choices and re-score them with the domain scorer. If it is
    // unavailable or returns nothing usable, we fall through to the rule engine.
    if (this.deps.planner !== undefined) {
      let plannerAvailable = false;
      try {
        plannerAvailable = await this.deps.planner.isAvailable();
      } catch {
        plannerAvailable = false;
      }
      if (plannerAvailable) {
        const llm = await this.tryLlmRecommend(context, inventory.all, referenceDate, notes);
        if (llm !== null) {
          return llm;
        }
      } else {
        notes.push('LLM planner not available; using domain rules.');
      }
    }

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

  /**
   * Try to produce recommendations via the LLM planner. Returns `null` (so the
   * caller falls back to rules) when the planner errors, the wardrobe is empty,
   * or every proposed outfit is unusable (e.g. hallucinated ids). All returned
   * garments are real wardrobe items and every outfit is re-scored by the domain
   * scorer; the explanation is the model's own.
   */
  private async tryLlmRecommend(
    context: RecommendationContext,
    garments: readonly Garment[],
    referenceDate: string,
    notes: string[],
  ): Promise<RecommendationSet | null> {
    const planner = this.deps.planner;
    if (planner === undefined || garments.length === 0) {
      return null;
    }
    let planned: readonly PlannedOutfit[];
    try {
      planned = await planner.plan(
        this.toPlannerContext(context),
        await this.toPlannerCatalog(garments),
      );
    } catch {
      notes.push('LLM planner errored; falling back to domain rules.');
      return null;
    }

    const byId = new Map<string, Garment>(garments.map((g) => [g.id, g]));
    const scoringContext: ScoringContext = {
      ...(context.weather !== undefined ? { weather: context.weather } : {}),
      referenceDate,
    };

    const recommendations: OutfitRecommendation[] = [];
    const usedKinds = new Set<RecommendationKind>();
    const usedSignatures = new Set<string>();
    const kindOrder: readonly RecommendationKind[] = ['principal', 'mas-elegante', 'mas-comoda'];

    for (const outfit of planned) {
      const chosen: Garment[] = [];
      const seen = new Set<string>();
      for (const id of outfit.garmentIds) {
        const garment = byId.get(id);
        if (garment !== undefined && !seen.has(garment.id)) {
          seen.add(garment.id);
          chosen.push(garment);
        }
      }
      if (chosen.length === 0) {
        continue; // ignore hallucinated / empty selections
      }
      const signature = OutfitScoringService.signatureOf(chosen);
      if (usedSignatures.has(signature)) {
        continue; // skip duplicate outfits
      }
      let kind = this.normalizeKind(outfit.kind);
      if (kind === null || usedKinds.has(kind)) {
        kind = kindOrder.find((k) => !usedKinds.has(k)) ?? null;
      }
      if (kind === null) {
        break; // the three roles are filled
      }
      usedKinds.add(kind);
      usedSignatures.add(signature);
      const breakdown = this.scorer.scoreCombination(
        chosen,
        context.occasion,
        context.season,
        scoringContext,
      );
      const explanation = outfit.explanation.trim();
      recommendations.push({
        kind,
        label: RECOMMENDATION_LABELS[kind],
        garments: chosen,
        score: breakdown.score,
        breakdown,
        explanation:
          explanation.length > 0
            ? explanation
            : 'Conjunto elegido por el asesor según tu contexto y tu guardarropa.',
      });
    }

    if (recommendations.length === 0) {
      notes.push('LLM planner returned no usable outfit; falling back to domain rules.');
      return null;
    }

    notes.push(`Outfits selected and explained by the LLM planner "${planner.id}".`);
    return {
      context: { ...context, enrichedByProvider: true },
      recommendations,
      providerId: planner.id,
      degraded: false,
      candidatesEvaluated: garments.length,
      notes,
    };
  }

  /**
   * Map the eligible inventory into the flat catalog the planner reasons over.
   * When an image loader is configured, attach each garment's thumbnail (base64)
   * so a multimodal planner can SEE the garment. Image loading is bounded by
   * {@link MAX_PLANNER_IMAGES} to keep the prompt within model limits; garments
   * beyond the cap (or without a photo) are still listed as text and remain
   * selectable by id.
   */
  private async toPlannerCatalog(garments: readonly Garment[]): Promise<PlannerGarment[]> {
    const loader = this.deps.imageLoader;
    const out: PlannerGarment[] = [];
    let imagesAttached = 0;
    for (const g of garments) {
      const base: PlannerGarment = {
        id: g.id,
        name: g.name,
        category: String(g.category),
        subcategory: String(g.subcategory),
        colorName: g.color.name ?? '',
        colorHex: g.color.hex,
        formality: garmentFormality(g.subcategory),
        layerSlot: String(g.layerSlot),
        seasons: g.seasons.map((s) => String(s)),
      };
      if (loader !== undefined && imagesAttached < MAX_PLANNER_IMAGES) {
        const key = AIOrchestrator.thumbnailKey(g);
        if (key !== undefined) {
          let base64: string | null = null;
          try {
            base64 = await loader(key);
          } catch {
            base64 = null;
          }
          if (base64 !== null && base64.length > 0) {
            out.push({ ...base, imageBase64: base64 });
            imagesAttached += 1;
            continue;
          }
        }
      }
      out.push(base);
    }
    return out;
  }

  /** Storage key of the garment's cover thumbnail (primary photo, else first). */
  private static thumbnailKey(garment: Garment): string | undefined {
    const photos = garment.photos;
    if (photos.length === 0) {
      return undefined;
    }
    const primary =
      photos.find((p) => p.isPrimary) ??
      [...photos].sort((a, b) => a.order - b.order)[0] ??
      photos[0];
    if (primary === undefined) {
      return undefined;
    }
    return primary.attributes['thumbnailKey'] ?? primary.storageKey;
  }

  /** Project the derived context into the planner's plain shape. */
  private toPlannerContext(context: RecommendationContext): PlannerContext {
    const weather =
      context.weather?.isHot === true
        ? 'caluroso'
        : context.weather?.isCold === true
          ? 'frío'
          : undefined;
    return {
      message: context.rawMessage,
      occasion: String(context.occasion),
      season: String(context.season),
      targetFormality: context.targetFormality,
      ...(weather !== undefined ? { weather } : {}),
      ...(context.timeOfDay !== undefined ? { timeOfDay: context.timeOfDay } : {}),
      ...(context.activity !== undefined ? { activity: context.activity } : {}),
    };
  }

  /** Map a free planner label onto one of the three recommendation roles. */
  private normalizeKind(raw: string): RecommendationKind | null {
    const k = raw.toLowerCase();
    if (/eleg|formal/.test(k)) {
      return 'mas-elegante';
    }
    if (/comod|cómod|casual|relaj|comfort/.test(k)) {
      return 'mas-comoda';
    }
    if (/princip|main|mejor|best/.test(k)) {
      return 'principal';
    }
    return null;
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
