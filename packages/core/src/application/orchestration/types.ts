/**
 * Public value types of the AI orchestration layer.
 *
 * These describe what flows INTO the orchestrator (a request) and what comes
 * OUT (a structured set of three explained recommendations). They are plain,
 * serialisable-friendly shapes; the recommendation carries live `Garment`
 * domain objects which the application boundary maps to DTOs before crossing a
 * process/IPC boundary.
 */
import { type Garment } from '../../domain/entities/Garment';
import { type Occasion } from '../../domain/value-objects/Occasion';
import { type Season } from '../../domain/value-objects/Season';
import { type WeatherCondition } from '../../domain/value-objects/WeatherCondition';
import { type OutfitScore } from '../../domain/services/OutfitScoringService';

/** A request to the AI orchestrator. The message is free text. */
export interface RecommendationRequest {
  /** The user's natural-language message, e.g. "tengo una boda el sábado". */
  readonly message: string;
  /** Explicit occasion override (skips inference when provided). */
  readonly occasion?: Occasion;
  /** Explicit season override (skips inference when provided). */
  readonly season?: Season;
  /** Explicit weather, when known from a sensor/API rather than the message. */
  readonly weather?: WeatherCondition;
  /** ISO "today" used for freshness/seasonality reasoning. */
  readonly referenceDate?: string;
  /** Upper bound on candidate combinations evaluated (perf guard). */
  readonly maxCandidates?: number;
}

/**
 * Structured context extracted from the user's message (step 2 of the flow).
 * Everything here is derived by M-A-S logic; a provider may only *enrich* the
 * free-text `summary`/`activity`, never the fields that drive the hard rules.
 */
export interface RecommendationContext {
  /** The original message, untouched. */
  readonly rawMessage: string;
  readonly occasion: Occasion;
  readonly season: Season;
  /** Present when temperature/weather could be inferred or was supplied. */
  readonly weather?: WeatherCondition;
  /** Target formality 0–10 implied by the occasion and any explicit cues. */
  readonly targetFormality: number;
  /** How much the user values comfort right now, 0–1. */
  readonly comfortPriority: number;
  /** How much movement the day involves, 0–1 (commuting, standing, walking). */
  readonly mobilityNeed: number;
  /** Rough part of day, when detectable. */
  readonly timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  /** A short free-text activity label, when detectable/enriched. */
  readonly activity?: string;
  /** Human-readable notes describing how the context was derived. */
  readonly notes: readonly string[];
  /** True when a provider enriched the free-text fields. */
  readonly enrichedByProvider: boolean;
}

/** The three fixed recommendation roles M-A-S always tries to produce. */
export type RecommendationKind = 'principal' | 'mas-elegante' | 'mas-comoda';

/** Display labels for each recommendation kind (Spanish product copy). */
export const RECOMMENDATION_LABELS: Readonly<Record<RecommendationKind, string>> = {
  principal: 'Principal',
  'mas-elegante': 'Más elegante',
  'mas-comoda': 'Más cómoda',
};

/** One fully-explained recommendation. */
export interface OutfitRecommendation {
  readonly kind: RecommendationKind;
  readonly label: string;
  readonly garments: readonly Garment[];
  /** Final 0–100 domain score (after any additive semantic re-ranking). */
  readonly score: number;
  /** The domain scoring breakdown (factors + smart-rule violations). */
  readonly breakdown: OutfitScore;
  /** Clear, human-readable reasoning for this pick. */
  readonly explanation: string;
  /** Optional semantic boost in [0, 1] applied when a provider was available. */
  readonly semanticBoost?: number;
}

/** The complete result of one orchestration run. */
export interface RecommendationSet {
  readonly context: RecommendationContext;
  /** Up to three recommendations (principal / más elegante / más cómoda). */
  readonly recommendations: readonly OutfitRecommendation[];
  /** Id of the text provider that enriched the run, or `null` when offline. */
  readonly providerId: string | null;
  /** True when NO provider was available — the run used only domain rules. */
  readonly degraded: boolean;
  /** How many non-disqualified candidates were evaluated. */
  readonly candidatesEvaluated: number;
  /** Run-level diagnostics (pipeline steps, fallbacks taken...). */
  readonly notes: readonly string[];
}
