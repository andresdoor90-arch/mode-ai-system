/**
 * Vision analysis ports (Increment 2 — "the photo IS the garment").
 *
 * When the user adds a garment they pick a PHOTO; the system then analyses that
 * photo and fills in as many attributes as it can. This module defines the
 * provider-agnostic contracts for that analysis so the engine can be swapped
 * (offline colour baseline today; OpenAI Vision / Ollama / a local model later)
 * WITHOUT touching the application, IPC or UI layers.
 *
 * Two hard rules are encoded in the types:
 *  1. NEVER fabricate. Every attribute is optional — a provider only emits a
 *     field when it has a real signal for it. Absent field === "unknown",
 *     which the UI renders as empty rather than guessing.
 *  2. Every value is traceable. Each {@link AnalyzedField} records its source
 *     and confidence so the merge logic and the UI can reason about precedence
 *     (user corrections beat the model; the model beats the colour baseline).
 */
import { type RgbSample } from '../tagging/ports';

/** Where an analysed value came from. Drives merge precedence and UX badges. */
export type AnalysisSource = 'baseline' | 'vision' | 'user';

/** Numeric precedence for a source: user corrections win over everything. */
export const sourceRank = (source: AnalysisSource): number => {
  switch (source) {
    case 'user':
      return 3;
    case 'vision':
      return 2;
    case 'baseline':
      return 1;
    default:
      return 0;
  }
};

/** A single analysed value with provenance and a confidence in [0, 1]. */
export interface AnalyzedField<T> {
  readonly value: T;
  readonly confidence: number;
  readonly source: AnalysisSource;
}

/**
 * The full, rich result of analysing a garment photo. Every field is optional:
 * a missing field means "not determined" and must be shown empty, never faked.
 *
 * Free-form string vocabularies (material, pattern, sleeve, …) are intentionally
 * open: providers map their own labels and the UI title-cases them. Where a
 * field corresponds to a domain enum (category/subcategory/season) providers
 * should emit the enum's slug so confirmation maps cleanly to the domain.
 */
export interface GarmentAnalysis {
  /** A friendly name proposed for the garment (e.g. "Camisa de lino azul"). */
  readonly suggestedName?: AnalyzedField<string>;
  /** Free label for the kind of garment ("camisa", "chaqueta", …). */
  readonly garmentType?: AnalyzedField<string>;
  /** Domain category slug (GarmentCategory). */
  readonly category?: AnalyzedField<string>;
  /** Domain subcategory slug (GarmentSubcategory). */
  readonly subcategory?: AnalyzedField<string>;
  /** Predominant colour as a hex string (#rrggbb). */
  readonly primaryColor?: AnalyzedField<string>;
  /** Human-readable name for the predominant colour. */
  readonly primaryColorName?: AnalyzedField<string>;
  /** Secondary colours as hex strings, most predominant first. */
  readonly secondaryColors?: AnalyzedField<readonly string[]>;
  readonly material?: AnalyzedField<string>;
  readonly pattern?: AnalyzedField<string>;
  readonly texture?: AnalyzedField<string>;
  readonly sleeve?: AnalyzedField<string>;
  readonly length?: AnalyzedField<string>;
  readonly neckline?: AnalyzedField<string>;
  readonly fit?: AnalyzedField<string>;
  readonly style?: AnalyzedField<string>;
  /** Formality on the domain's 0–10 scale. */
  readonly formality?: AnalyzedField<number>;
  /** Season slug (Season). */
  readonly season?: AnalyzedField<string>;
  /** Target gender ("male" | "female" | "unisex"). */
  readonly gender?: AnalyzedField<string>;
  /** Recommended occasion slugs (Occasion). */
  readonly occasions?: AnalyzedField<readonly string[]>;
  /** Brand name — only when a logo/label is genuinely visible. */
  readonly brand?: AnalyzedField<string>;
  /** A short, useful free-text observation about the garment. */
  readonly notes?: AnalyzedField<string>;
  /** Free-form suggested tags. */
  readonly suggestedTags?: AnalyzedField<readonly string[]>;
  /** Category slugs this garment pairs well with. */
  readonly compatibleCategories?: AnalyzedField<readonly string[]>;
}

/** Every key of {@link GarmentAnalysis}. */
export type GarmentAnalysisField = keyof GarmentAnalysis;

/** Ordered list of all analysis fields (stable iteration for merge/summary). */
export const GARMENT_ANALYSIS_FIELDS: readonly GarmentAnalysisField[] = [
  'suggestedName',
  'garmentType',
  'category',
  'subcategory',
  'primaryColor',
  'primaryColorName',
  'secondaryColors',
  'material',
  'pattern',
  'texture',
  'sleeve',
  'length',
  'neckline',
  'fit',
  'style',
  'formality',
  'season',
  'gender',
  'occasions',
  'brand',
  'notes',
  'suggestedTags',
  'compatibleCategories',
];

/** Input describing what to analyse. */
export interface VisionAnalysisInput {
  /** Reference to the stored image the provider should look at. */
  readonly image?: {
    readonly storageKey?: string;
    readonly mimeType?: string;
    /** Base64 of the image bytes, for providers that need the pixels inline. */
    readonly base64?: string;
  };
  /**
   * Pre-sampled pixels for the OFFLINE colour baseline. The baseline provider
   * uses these to extract predominant colours with no network/native deps.
   */
  readonly colorSamples?: readonly RgbSample[];
  /** Optional Spanish free text from the "help improve the analysis" box. */
  readonly freeText?: string;
}

/**
 * A swappable vision analysis engine. Implementations MUST NOT fabricate: emit
 * a field only when there is a genuine signal for it.
 */
export interface IVisionProvider {
  readonly id: string;
  /** Whether the provider can run right now (model present, creds set, …). */
  isAvailable(): Promise<boolean>;
  /** Produce a (possibly partial) analysis from the input. */
  analyze(input: VisionAnalysisInput): Promise<GarmentAnalysis>;
}

/** The merged outcome plus diagnostics about how it was produced. */
export interface VisionAnalysisResult {
  readonly analysis: GarmentAnalysis;
  /** Ids of the providers that contributed (in run order). */
  readonly providers: readonly string[];
  /** Whether a real (non-baseline) vision provider ran. */
  readonly visionAvailable: boolean;
  /** Mean confidence across the populated fields (0 when empty). */
  readonly overallConfidence: number;
  /** Count of fields that were actually populated. */
  readonly populatedFields: number;
}

/** Mean confidence across populated fields; 0 for an empty analysis. */
export const overallConfidence = (analysis: GarmentAnalysis): number => {
  let sum = 0;
  let count = 0;
  for (const key of GARMENT_ANALYSIS_FIELDS) {
    const field = analysis[key];
    if (field !== undefined) {
      sum += field.confidence;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
};

/** Number of populated fields in an analysis. */
export const countPopulatedFields = (analysis: GarmentAnalysis): number => {
  let count = 0;
  for (const key of GARMENT_ANALYSIS_FIELDS) {
    if (analysis[key] !== undefined) {
      count += 1;
    }
  }
  return count;
};

/**
 * Merge analyses in priority order. For each field the candidate with the
 * highest {@link sourceRank} wins; on a tie, the LATER analysis in the list
 * wins. This makes precedence explicit:
 *
 *   mergeAnalyses([baseline, vision, existingManualEdits, freshUserHints])
 *
 * yields user hints > prior manual edits > vision model > colour baseline,
 * exactly the behaviour the product requires (including for photo replacement,
 * where compatible manual edits survive a re-analysis).
 */
export const mergeAnalyses = (ordered: readonly GarmentAnalysis[]): GarmentAnalysis => {
  const result: Record<string, AnalyzedField<unknown> | undefined> = {};
  for (const analysis of ordered) {
    for (const key of GARMENT_ANALYSIS_FIELDS) {
      const candidate = analysis[key] as AnalyzedField<unknown> | undefined;
      if (candidate === undefined) {
        continue;
      }
      const current = result[key];
      if (current === undefined || sourceRank(candidate.source) >= sourceRank(current.source)) {
        result[key] = candidate;
      }
    }
  }
  return result as GarmentAnalysis;
};

/** Keep only the user-sourced (manually corrected) fields of an analysis. */
export const manualFieldsOnly = (analysis: GarmentAnalysis): GarmentAnalysis => {
  const result: Record<string, AnalyzedField<unknown> | undefined> = {};
  for (const key of GARMENT_ANALYSIS_FIELDS) {
    const field = analysis[key] as AnalyzedField<unknown> | undefined;
    if (field !== undefined && field.source === 'user') {
      result[key] = field;
    }
  }
  return result as GarmentAnalysis;
};
