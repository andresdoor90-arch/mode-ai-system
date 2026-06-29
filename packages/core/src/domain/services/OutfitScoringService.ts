import { type Garment } from '../entities/Garment';
import { type Outfit } from '../entities/Outfit';
import { LayerSlot } from '../value-objects/GarmentCategory';
import { type Occasion } from '../value-objects/Occasion';
import { type Season } from '../value-objects/Season';
import { type StylePreference } from '../value-objects/StylePreference';
import { type WeatherCondition } from '../value-objects/WeatherCondition';
import { ColorHarmonyService } from './ColorHarmonyService';
import { OccasionMatchingService } from './OccasionMatchingService';
import { SeasonalRecommendationService } from './SeasonalRecommendationService';
import { StyleCompatibilityService } from './StyleCompatibilityService';

/**
 * Relative weights for each scoring factor. They are documented here and sum to
 * exactly 1 so the weighted total maps cleanly onto a 0–100 scale.
 */
export const DEFAULT_SCORING_WEIGHTS = {
  colorCompatibility: 0.18,
  formalityCoherence: 0.12,
  thermalAdequacy: 0.12,
  eventAdequacy: 0.15,
  comfortMobility: 0.08,
  freshness: 0.08,
  visualBalance: 0.07,
  accessories: 0.05,
  userPreference: 0.1,
  seasonality: 0.05,
} as const;

export type ScoringWeights = typeof DEFAULT_SCORING_WEIGHTS;

/**
 * Stable, order-independent signature for a garment combination, keyed purely by
 * garment ids. Shared by {@link OutfitScoringService.signatureOf} and by the
 * persisted outfit-history layer so freshness / recent-repetition reasoning uses
 * ONE canonical definition (no rule duplication).
 */
export const signatureOfIds = (ids: readonly string[]): string => [...ids].sort().join('|');

/** Optional context that refines a score when available. */
export interface ScoringContext {
  readonly weather?: WeatherCondition;
  readonly stylePreference?: StylePreference;
  /** Signatures of recently-worn combinations, to discourage repetition. */
  readonly recentSignatures?: readonly string[];
  /** ISO "today" used to reason about how recently garments were worn. */
  readonly referenceDate?: string;
}

/** One contributing factor in the final score. */
export interface ScoreFactor {
  readonly name: keyof ScoringWeights;
  readonly weight: number;
  readonly value: number;
  readonly weighted: number;
}

/** A full, explainable scoring breakdown for an outfit. */
export interface OutfitScore {
  /** Final score in the inclusive range 0–100. */
  readonly score: number;
  /** True when a hard smart-rule disqualified the outfit (score forced to 0). */
  readonly disqualified: boolean;
  readonly violations: readonly string[];
  readonly factors: readonly ScoreFactor[];
}

/** Comfort/mobility rating (0–1) per subcategory; unknown items default to 0.8. */
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const daysBetween = (a: string, b: string): number => {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Math.floor(ms / 86_400_000);
};

/**
 * Computes a 0–100 quality score for an outfit by blending ten weighted factors
 * (colour, formality coherence, thermal adequacy, event adequacy, comfort,
 * freshness, visual balance, accessories, user preference and seasonality), and
 * applies the hard "smart rules" that disqualify an outfit outright.
 *
 * Smart rules that disqualify (score → 0):
 *  - contains a garment that is damaged, in the laundry or archived;
 *  - heavy coat/parka while the weather is hot;
 *  - a tie at an explicitly informal occasion;
 *  - clashing (incompatible) colours;
 *  - the exact combination was worn recently (no repeats).
 */
export class OutfitScoringService {
  public constructor(
    private readonly colorHarmony = new ColorHarmonyService(),
    private readonly compatibility = new StyleCompatibilityService(colorHarmony),
    private readonly seasonal = new SeasonalRecommendationService(),
    private readonly occasion = new OccasionMatchingService(),
    private readonly weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  ) {}

  /** Stable signature for a garment combination (order-independent). */
  public static signatureOf(garments: readonly Garment[]): string {
    return signatureOfIds(garments.map((g) => g.id));
  }

  /** Score a fully-formed {@link Outfit}. */
  public score(outfit: Outfit, context: ScoringContext = {}): OutfitScore {
    return this.scoreCombination(outfit.garments, outfit.occasion, outfit.season, context);
  }

  /** Score a raw garment combination for a target occasion and season. */
  public scoreCombination(
    garments: readonly Garment[],
    occasion: Occasion,
    season: Season,
    context: ScoringContext = {},
  ): OutfitScore {
    const violations = this.findRuleViolations(garments, occasion, context);

    const factors = this.computeFactors(garments, occasion, season, context);
    const weightedTotal = factors.reduce((sum, f) => sum + f.weighted, 0);
    const rawScore = Math.round(clamp01(weightedTotal) * 100);

    if (violations.length > 0) {
      return { score: 0, disqualified: true, violations, factors };
    }
    return { score: rawScore, disqualified: false, violations: [], factors };
  }

  /** Evaluate the hard smart-rules, returning a human-readable violation list. */
  public findRuleViolations(
    garments: readonly Garment[],
    occasion: Occasion,
    context: ScoringContext = {},
  ): readonly string[] {
    const violations: string[] = [];

    // 1. Never recommend unavailable garments.
    const unavailable = garments.filter((g) => !g.isWearable);
    for (const g of unavailable) {
      violations.push(`Garment "${g.name}" is ${g.status} and cannot be worn.`);
    }

    // 2. No heavy coat when it is hot.
    if (context.weather?.isHot === true) {
      const heavy = garments.filter((g) => g.isHeavyOuterwear);
      for (const g of heavy) {
        violations.push(`Heavy outerwear "${g.name}" is inappropriate for hot weather.`);
      }
    }

    // 3. No tie for informal events.
    if (this.occasion.hasTieOnInformalOccasion(garments, occasion)) {
      violations.push(`A tie is inappropriate for an informal ${occasion} occasion.`);
    }

    // 4. No incompatible (clashing) colours.
    if (this.colorHarmony.hasClash(garments.map((g) => g.color))) {
      violations.push('Outfit contains clashing colours.');
    }

    // 5. No recently-repeated combinations.
    const signature = OutfitScoringService.signatureOf(garments);
    if (context.recentSignatures?.includes(signature) === true) {
      violations.push('This exact combination was worn recently.');
    }

    return violations;
  }

  private computeFactors(
    garments: readonly Garment[],
    occasion: Occasion,
    season: Season,
    context: ScoringContext,
  ): readonly ScoreFactor[] {
    const values: Record<keyof ScoringWeights, number> = {
      colorCompatibility: this.colorHarmony.harmonyScore(garments.map((g) => g.color)),
      formalityCoherence: clamp01(1 - this.compatibility.formalitySpread(garments) / 10),
      thermalAdequacy: context.weather
        ? this.seasonal.thermalAdequacy(garments, context.weather)
        : 1,
      eventAdequacy: this.occasion.matchScore(garments, occasion),
      comfortMobility: this.comfortScore(garments),
      freshness: this.freshnessScore(garments, context.referenceDate),
      visualBalance: this.visualBalanceScore(garments),
      accessories: this.accessoriesScore(garments),
      userPreference: this.userPreferenceScore(garments, context.stylePreference),
      seasonality: this.seasonalityScore(garments, season),
    };

    return (Object.keys(this.weights) as Array<keyof ScoringWeights>).map((name) => {
      const weight = this.weights[name];
      const value = clamp01(values[name]);
      return { name, weight, value, weighted: weight * value };
    });
  }

  private comfortScore(garments: readonly Garment[]): number {
    if (garments.length === 0) {
      return 0;
    }
    const total = garments.reduce((sum, g) => sum + g.comfort, 0);
    return total / garments.length;
  }

  private freshnessScore(garments: readonly Garment[], referenceDate?: string): number {
    if (garments.length === 0) {
      return 1;
    }
    const perGarment = garments.map((g) => {
      let value = clamp01(1 - (Math.min(g.wearCount, 30) / 30) * 0.6);
      if (referenceDate !== undefined && g.lastWornAt !== undefined) {
        const days = daysBetween(referenceDate, g.lastWornAt);
        if (days <= 2) {
          value *= 0.5;
        } else if (days <= 6) {
          value *= 0.8;
        }
      }
      return clamp01(value);
    });
    return perGarment.reduce((a, b) => a + b, 0) / perGarment.length;
  }

  private visualBalanceScore(garments: readonly Garment[]): number {
    const slots = new Set(garments.map((g) => g.layerSlot));
    const accessoryCount = garments.filter((g) => g.layerSlot === LayerSlot.Accessory).length;

    let score = 1;
    const coreCovered =
      slots.has(LayerSlot.FullBody) ||
      (slots.has(LayerSlot.UpperBody) && slots.has(LayerSlot.LowerBody));
    if (!coreCovered) {
      score -= 0.5;
    }
    if (!slots.has(LayerSlot.Feet)) {
      score -= 0.2;
    }
    if (accessoryCount > 3) {
      score -= 0.2;
    }
    return clamp01(score);
  }

  private accessoriesScore(garments: readonly Garment[]): number {
    const count = garments.filter((g) => g.layerSlot === LayerSlot.Accessory).length;
    if (count === 1 || count === 2) {
      return 1;
    }
    if (count === 0) {
      return 0.7;
    }
    if (count === 3) {
      return 0.6;
    }
    return 0.3;
  }

  private userPreferenceScore(garments: readonly Garment[], preference?: StylePreference): number {
    if (preference === undefined) {
      return 0.7;
    }
    let score = 0.7;
    const names = garments
      .map((g) => g.color.name?.toLowerCase())
      .filter((n): n is string => n !== undefined);
    if (names.some((n) => preference.preferredColors.includes(n))) {
      score += 0.2;
    }
    if (names.some((n) => preference.avoidedColors.includes(n))) {
      score -= 0.4;
    }
    return clamp01(score);
  }

  private seasonalityScore(garments: readonly Garment[], season: Season): number {
    if (garments.length === 0) {
      return 1;
    }
    const total = garments.reduce((sum, g) => sum + this.seasonal.seasonalScore(g, season), 0);
    return total / garments.length;
  }
}
