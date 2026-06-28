/**
 * AI-assisted tagging ports (Module 5).
 *
 * When the user adds photos, M-A-S analyses them and SUGGESTS metadata
 * (category, subcategory, predominant colours, garment type, season, formality,
 * estimated material). These are *suggestions only*: they are never applied
 * automatically — the user always confirms. The suggester is a provider-agnostic
 * port so the real vision model (deferred, requires network/native deps) can be
 * swapped in without touching the application or domain.
 */

/** A normalised RGB sample (0–255) used by the offline baseline extractor. */
export interface RgbSample {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** Optional weight (e.g. pixel count) for averaging. Defaults to 1. */
  readonly weight?: number;
}

/** Input describing the photos to analyse for a garment. */
export interface TagSuggestionInput {
  /** Opaque storage keys for the garment's photos (resolved by infra). */
  readonly photoKeys: readonly string[];
  /**
   * Optional pre-sampled pixels for the OFFLINE colour baseline. Vision models
   * do not need this; the deterministic colour extractor uses it to suggest
   * predominant colours with no network.
   */
  readonly colorSamples?: readonly RgbSample[];
  /** Any metadata the user already entered (used as weak priors only). */
  readonly hints?: {
    readonly category?: string;
    readonly subcategory?: string;
  };
}

/** A single suggested value with a confidence in [0, 1]. */
export interface Suggestion<T> {
  readonly value: T;
  readonly confidence: number;
}

/**
 * The full set of suggested tags. Every field is optional: a provider only
 * fills what it is confident about. NOTHING here is applied without explicit
 * user confirmation.
 */
export interface GarmentTagSuggestion {
  readonly category?: Suggestion<string>;
  readonly subcategory?: Suggestion<string>;
  /** Hex colours, most predominant first. */
  readonly colors?: Suggestion<readonly string[]>;
  readonly garmentType?: Suggestion<string>;
  readonly season?: Suggestion<string>;
  readonly formality?: Suggestion<number>;
  readonly material?: Suggestion<string>;
  /** Provider id that produced the suggestion (diagnostics/UX). */
  readonly source: string;
  /** True when the suggester could not analyse (e.g. vision deferred offline). */
  readonly unavailable: boolean;
}

/** Provider-agnostic tagging port. */
export interface IGarmentTagSuggester {
  readonly id: string;
  /** Whether the suggester can run right now. */
  isAvailable(): Promise<boolean>;
  suggest(input: TagSuggestionInput): Promise<GarmentTagSuggestion>;
}

/** Offline, non-AI colour extraction port (can run without network). */
export interface IColorExtractor {
  /** Return predominant hex colours (most predominant first). */
  extract(samples: readonly RgbSample[], topN?: number): readonly string[];
}
