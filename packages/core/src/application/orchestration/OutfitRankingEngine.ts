/**
 * Outfit Ranking Engine (step 7, and the ranking part of step 8).
 *
 * Ranks candidate outfits using the DOMAIN {@link OutfitScoringService} — the
 * canonical 0–100 score across ten weighted factors plus the hard "smart
 * rules". Candidates the smart rules disqualify are dropped outright and can
 * never be revived.
 *
 * On top of the domain score it applies two OPTIONAL, purely additive signals:
 *  - a semantic boost (from the {@link EmbeddingManager}), and
 *  - a learned-preference affinity bias (from the {@link PreferenceEngine}).
 *
 * Both only re-order outfits that already passed every hard rule; neither can
 * change a disqualification or violate a domain rule. With no provider and no
 * learned memory, ranking is exactly the domain score — fully offline.
 */
import { type Garment } from '../../domain/entities/Garment';
import { type Occasion } from '../../domain/value-objects/Occasion';
import { type Season } from '../../domain/value-objects/Season';
import {
  OutfitScoringService,
  type OutfitScore,
  type ScoringContext,
} from '../../domain/services/OutfitScoringService';
import { type Candidate } from './OutfitCandidateGenerator';

/** Maximum points a perfect semantic match can add to the 0–100 score. */
export const SEMANTIC_WEIGHT = 6;
/** Maximum points a fully-aligned learned preference can add/subtract. */
export const AFFINITY_WEIGHT = 8;

/** A scored, rankable candidate with a full provenance trail. */
export interface RankedCandidate {
  readonly garments: readonly Garment[];
  readonly breakdown: OutfitScore;
  /** Pure domain score, 0–100. */
  readonly baseScore: number;
  /** Semantic similarity in [0, 1] (0 when no provider). */
  readonly semanticBoost: number;
  /** Learned-preference affinity in [-1, 1] (0 when nothing learned). */
  readonly affinityBias: number;
  /** Domain score plus additive signals, clamped to 0–100. */
  readonly finalScore: number;
}

/** Optional, additive enrichment signals for ranking. */
export interface RankingEnrichment {
  /** Garment-id → semantic similarity in [0, 1]. */
  readonly semanticScores?: ReadonlyMap<string, number>;
  /** Per-outfit learned-preference affinity in [-1, 1]. */
  readonly affinityBias?: (garments: readonly Garment[]) => number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export class OutfitRankingEngine {
  public constructor(private readonly scoring = new OutfitScoringService()) {}

  /**
   * Score and rank candidates. Disqualified outfits are excluded; the rest are
   * returned sorted by final score (descending), tie-broken by the pure domain
   * score so enrichment never masks a domain-quality difference.
   */
  public rank(
    candidates: readonly Candidate[],
    occasion: Occasion,
    season: Season,
    scoringContext: ScoringContext = {},
    enrichment: RankingEnrichment = {},
  ): readonly RankedCandidate[] {
    const ranked: RankedCandidate[] = [];

    for (const garments of candidates) {
      if (garments.length === 0) {
        continue;
      }
      const breakdown = this.scoring.scoreCombination(garments, occasion, season, scoringContext);
      if (breakdown.disqualified) {
        continue; // hard rules are absolute — never ranked.
      }

      const semanticBoost = this.semanticFor(garments, enrichment.semanticScores);
      const affinityBias = enrichment.affinityBias?.(garments) ?? 0;
      const finalScore = clamp(
        breakdown.score + semanticBoost * SEMANTIC_WEIGHT + affinityBias * AFFINITY_WEIGHT,
        0,
        100,
      );

      ranked.push({
        garments,
        breakdown,
        baseScore: breakdown.score,
        semanticBoost,
        affinityBias,
        finalScore,
      });
    }

    ranked.sort((a, b) => b.finalScore - a.finalScore || b.baseScore - a.baseScore);
    return ranked;
  }

  private semanticFor(garments: readonly Garment[], scores?: ReadonlyMap<string, number>): number {
    if (scores === undefined || scores.size === 0) {
      return 0;
    }
    let total = 0;
    let counted = 0;
    for (const garment of garments) {
      const score = scores.get(garment.id);
      if (score !== undefined) {
        total += score;
        counted += 1;
      }
    }
    return counted === 0 ? 0 : total / counted;
  }
}
