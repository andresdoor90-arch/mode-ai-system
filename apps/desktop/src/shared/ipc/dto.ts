/**
 * Data Transfer Objects (DTOs) exchanged across the IPC boundary.
 *
 * Domain entities from `@mas/core` are rich class instances and are NOT
 * structured-cloneable, so they can never cross the Electron IPC boundary
 * directly. Instead the main process maps domain objects to these plain,
 * serialisable shapes. The renderer only ever sees DTOs — it has no reference
 * to the domain classes, which keeps the React layer fully decoupled from the
 * domain and infrastructure.
 *
 * This module contains *types only*: it has no runtime footprint and can be
 * imported from either the Node (main/preload) or the browser (renderer) side.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** Serialisable colour representation. */
export interface ColorDTO {
  readonly hex: string;
  readonly name: string;
  /** 'warm' | 'cool' | 'neutral'. */
  readonly category: string;
  readonly isNeutral: boolean;
}

/** Lifecycle status of a garment (mirrors the domain enum values). */
export type GarmentStatusDTO = 'available' | 'in-laundry' | 'damaged' | 'archived';

/* -------------------------------------------------------------------------- */
/* Aggregates                                                                 */
/* -------------------------------------------------------------------------- */

export interface GarmentDTO {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly categoryId: string | null;
  readonly color: ColorDTO;
  readonly secondaryColors: readonly ColorDTO[];
  readonly brand: string | null;
  readonly material: string | null;
  readonly seasons: readonly string[];
  readonly images: readonly string[];
  readonly photos: readonly PhotoDTO[];
  readonly tags: readonly string[];
  readonly status: GarmentStatusDTO;
  readonly wearCount: number;
  readonly formality: number;
  readonly lastWornAt: string | null;
  readonly purchaseDate: string | null;
  readonly notes: string | null;
  /** Rich, photo-analysis-derived attributes (pattern, sleeve, style, …). */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** A single garment photograph with its non-destructive transform metadata. */
export interface PhotoDTO {
  readonly id: string;
  readonly storageKey: string;
  readonly order: number;
  readonly rotation: number;
  readonly crop: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly isPrimary: boolean;
  readonly stage: string;
  /** Forward-compatible extension bag (e.g. `thumbnailKey`, dimensions). */
  readonly attributes?: Readonly<Record<string, string>>;
}

/** System metadata carried by a category (mirrors the domain VO). */
export interface CategoryMetadataDTO {
  readonly layerSlot: string;
  readonly formality: number;
  readonly comfort: number;
  readonly heavyOuterwear: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

/** A user-defined taxonomy node. */
export interface CategoryDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly group: string | null;
  readonly order: number;
  readonly seeded: boolean;
  readonly metadata: CategoryMetadataDTO;
}

/** A category and its direct subcategories, for the management tree. */
export interface CategoryNodeDTO {
  readonly category: CategoryDTO;
  readonly children: readonly CategoryDTO[];
}

/** AI-tagging suggestion crossing the IPC boundary. */
export interface TagSuggestionDTO {
  readonly source: string;
  readonly unavailable: boolean;
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly colors: readonly string[];
  readonly season: string | null;
  readonly material: string | null;
  readonly formality: number | null;
}

export interface CollectionDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly garmentIds: readonly string[];
}

export interface WardrobeViewDTO {
  readonly garments: readonly GarmentDTO[];
  readonly collections: readonly CollectionDTO[];
}

export interface OutfitDTO {
  readonly id: string;
  readonly name: string;
  readonly garments: readonly GarmentDTO[];
  readonly occasion: string;
  readonly season: string;
  readonly rating: number | null;
  readonly notes: string | null;
  readonly createdAt: string;
}

/** A scored outfit suggestion produced by the application layer. */
export interface OutfitSuggestionDTO {
  readonly garments: readonly GarmentDTO[];
  readonly score: number;
}

/* -------------------------------------------------------------------------- */
/* AI engine (recommendations)                                                */
/* -------------------------------------------------------------------------- */

/** One explained recommendation crossing the IPC boundary. */
export interface OutfitRecommendationDTO {
  /** 'principal' | 'mas-elegante' | 'mas-comoda'. */
  readonly kind: string;
  /** Display label, e.g. 'Principal', 'Más elegante', 'Más cómoda'. */
  readonly label: string;
  readonly garments: readonly GarmentDTO[];
  readonly score: number;
  readonly explanation: string;
}

/** The full result of one orchestration run, in serialisable form. */
export interface RecommendationSetDTO {
  readonly occasion: string;
  readonly season: string;
  readonly recommendations: readonly OutfitRecommendationDTO[];
  /** Id of the AI provider that enriched the run, or null when offline. */
  readonly providerId: string | null;
  /** True when only domain rules were used (no provider available). */
  readonly degraded: boolean;
  readonly notes: readonly string[];
}

/** Reflects the AI engine's current capability for the UI status indicator. */
export interface AiStatusDTO {
  /** A text/embedding provider is configured and available. */
  readonly providerAvailable: boolean;
  /** Id of the active provider, or null. */
  readonly providerId: string | null;
  /** Recommendations are available at all (always true — rules work offline). */
  readonly recommendationsEnabled: boolean;
  /** True when running on domain rules only (no provider). */
  readonly degraded: boolean;
}

export interface StyleAnalysisDTO {
  readonly totalGarments: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly averageFormality: number;
  readonly colorTemperature: {
    readonly warm: number;
    readonly cool: number;
    readonly neutral: number;
  };
  readonly paletteHarmony: number;
  readonly dominantSubcategory: string | null;
}

export interface ColorPaletteDTO {
  readonly colors: readonly ColorDTO[];
}

/** The current user's profile crossing the IPC boundary. */
export interface UserProfileDTO {
  readonly id: string;
  readonly name: string;
}

export interface AppInfoDTO {
  readonly name: string;
  readonly version: string;
  readonly platform: string;
  readonly versions: {
    readonly node: string;
    readonly chrome: string;
    readonly electron: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Command / query input payloads                                             */
/* -------------------------------------------------------------------------- */

export interface AddGarmentPayload {
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly categoryId?: string;
  readonly colorHex: string;
  readonly colorName?: string;
  readonly secondaryColorHexes?: readonly string[];
  readonly seasons: readonly string[];
  readonly brand?: string;
  readonly material?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
  /** Rich analysis-derived attributes persisted on the garment. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface UpdateGarmentPayload {
  readonly id: string;
  readonly name?: string;
  readonly colorHex?: string;
  readonly colorName?: string;
  readonly tags?: readonly string[];
  readonly status?: GarmentStatusDTO;
}

export interface SuggestionsPayload {
  readonly occasion: string;
  readonly season: string;
  readonly limit?: number;
}

/** Free-text (plus optional overrides) request for AI recommendations. */
export interface RecommendationRequestPayload {
  readonly message: string;
  readonly occasion?: string;
  readonly season?: string;
  readonly referenceDate?: string;
}

export interface CategoryPayload {
  readonly category: string;
}

export interface SeasonPayload {
  readonly season: string;
}

/* ----------------------------- Phase 6.5 payloads ------------------------- */

export interface CategoryMetadataPayload {
  readonly layerSlot?: string;
  readonly formality?: number;
  readonly comfort?: number;
  readonly heavyOuterwear?: boolean;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface CreateCategoryPayload {
  readonly name: string;
  readonly parentId?: string | null;
  readonly group?: string | null;
  readonly metadata?: CategoryMetadataPayload;
}

export interface UpdateCategoryPayload {
  readonly id: string;
  readonly name?: string;
  readonly group?: string | null;
  readonly parentId?: string | null;
  readonly metadata?: CategoryMetadataPayload;
}

export interface ReorderPayload {
  readonly orderedIds: readonly string[];
}

export interface GarmentSearchPayload {
  readonly text?: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly status?: GarmentStatusDTO;
  readonly season?: string;
  readonly tags?: readonly string[];
  readonly includeArchived?: boolean;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PhotoTransformPayload {
  readonly garmentId: string;
  readonly photoId: string;
  readonly rotation?: number;
  readonly crop?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly setPrimary?: boolean;
}

export interface ConfirmTagsPayload {
  readonly garmentId: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly categoryId?: string;
  readonly primaryColorHex?: string;
  readonly secondaryColorHexes?: readonly string[];
  readonly material?: string;
  readonly seasons?: readonly string[];
  readonly tags?: readonly string[];
}

/* ------------------------- Phase 7 outfit history ------------------------- */

/** A persisted outfit-usage record crossing the IPC boundary. */
export interface OutfitHistoryEntryDTO {
  readonly id: string;
  readonly garmentIds: readonly string[];
  readonly signature: string;
  readonly outfitId: string | null;
  readonly label: string | null;
  readonly wornOn: string;
  readonly time: string | null;
  readonly place: string | null;
  readonly event: string | null;
  readonly occasion: string | null;
  readonly weather: string | null;
  readonly temperatureC: number | null;
  readonly role: string | null;
  readonly comments: string | null;
  readonly satisfaction: number | null;
  readonly source: string;
  readonly createdAt: string;
}

export interface OutfitHistoryPageDTO {
  readonly items: readonly OutfitHistoryEntryDTO[];
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

export interface OutfitHistoryStatisticsDTO {
  readonly totalUses: number;
  readonly uniqueOutfits: number;
  readonly byRole: Readonly<Record<string, number>>;
  readonly byEvent: Readonly<Record<string, number>>;
  readonly byOccasion: Readonly<Record<string, number>>;
  readonly averageSatisfaction: number | null;
  readonly garmentUsage: ReadonlyArray<readonly [string, number]>;
  readonly lastWornOn: string | null;
}

export interface RepetitionGroupDTO {
  readonly signature: string;
  readonly count: number;
  readonly garmentIds: readonly string[];
  readonly wornOn: readonly string[];
}

/** Extensible usage context captured when recording a usage. */
export interface OutfitUsageContextPayload {
  readonly wornOn?: string;
  readonly time?: string;
  readonly place?: string;
  readonly event?: string;
  readonly occasion?: string;
  readonly weather?: string;
  readonly temperatureC?: number;
  readonly role?: string;
  readonly comments?: string;
  readonly satisfaction?: number;
  readonly label?: string;
}

export interface RecordUsagePayload {
  readonly garmentIds: readonly string[];
  readonly context?: OutfitUsageContextPayload;
}

export interface RecordFeedbackPayload {
  readonly garmentIds: readonly string[];
  readonly accepted: boolean;
  readonly context?: OutfitUsageContextPayload;
}

export interface RepeatOutfitPayload {
  readonly entryId: string;
  readonly context?: OutfitUsageContextPayload;
}

export interface AnnotateHistoryPayload {
  readonly entryId: string;
  readonly place?: string | null;
  readonly event?: string | null;
  readonly role?: string | null;
  readonly comments?: string | null;
  readonly label?: string | null;
  readonly satisfaction?: number | null;
}

export interface HistorySearchPayload {
  readonly text?: string;
  readonly role?: string;
  readonly event?: string;
  readonly place?: string;
  readonly occasion?: string;
  readonly source?: string;
  readonly minSatisfaction?: number;
  readonly from?: string;
  readonly to?: string;
  readonly sortBy?: 'wornOn' | 'satisfaction' | 'createdAt';
  readonly sortDirection?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

/* -------------------------------------------------------------------------- */
/* Photo-first vision analysis + image bytes                                  */
/* -------------------------------------------------------------------------- */

/** Provenance of an analysed value. Mirrors the core `AnalysisSource`. */
export type AnalysisSourceDTO = 'baseline' | 'vision' | 'user';

/** A single analysed value with provenance + confidence (mirrors core). */
export interface AnalyzedFieldDTO<T> {
  readonly value: T;
  readonly confidence: number;
  readonly source: AnalysisSourceDTO;
}

/**
 * The full rich analysis crossing the IPC boundary. Every field is optional:
 * an absent field means "not determined" and is rendered empty, never guessed.
 * Structurally identical to the core `GarmentAnalysis`.
 */
export interface GarmentAnalysisDTO {
  readonly suggestedName?: AnalyzedFieldDTO<string>;
  readonly garmentType?: AnalyzedFieldDTO<string>;
  readonly category?: AnalyzedFieldDTO<string>;
  readonly subcategory?: AnalyzedFieldDTO<string>;
  /** The user (SQLite) category the model chose — exact name from the input. */
  readonly detectedCategory?: AnalyzedFieldDTO<string>;
  /** Canonical attribute keys relevant to this garment (drives dynamic fields). */
  readonly applicableAttributes?: AnalyzedFieldDTO<readonly string[]>;
  /** Generic type-specific descriptor ("analógico", "Oxford", …). */
  readonly subtype?: AnalyzedFieldDTO<string>;
  readonly primaryColor?: AnalyzedFieldDTO<string>;
  readonly primaryColorName?: AnalyzedFieldDTO<string>;
  readonly secondaryColors?: AnalyzedFieldDTO<readonly string[]>;
  readonly material?: AnalyzedFieldDTO<string>;
  readonly pattern?: AnalyzedFieldDTO<string>;
  readonly texture?: AnalyzedFieldDTO<string>;
  readonly sleeve?: AnalyzedFieldDTO<string>;
  readonly length?: AnalyzedFieldDTO<string>;
  readonly neckline?: AnalyzedFieldDTO<string>;
  readonly fit?: AnalyzedFieldDTO<string>;
  readonly style?: AnalyzedFieldDTO<string>;
  readonly formality?: AnalyzedFieldDTO<number>;
  readonly season?: AnalyzedFieldDTO<string>;
  readonly gender?: AnalyzedFieldDTO<string>;
  readonly occasions?: AnalyzedFieldDTO<readonly string[]>;
  readonly brand?: AnalyzedFieldDTO<string>;
  readonly notes?: AnalyzedFieldDTO<string>;
  readonly suggestedTags?: AnalyzedFieldDTO<readonly string[]>;
  readonly compatibleCategories?: AnalyzedFieldDTO<readonly string[]>;
}

/** The merged analysis plus diagnostics about how it was produced. */
export interface GarmentAnalysisResultDTO {
  readonly analysis: GarmentAnalysisDTO;
  readonly providers: readonly string[];
  readonly visionAvailable: boolean;
  readonly overallConfidence: number;
  readonly populatedFields: number;
}

/** A sampled pixel for the offline colour baseline. */
export interface RgbSampleDTO {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly weight?: number;
}

/** Request to analyse a garment photo. */
export interface AnalyzeGarmentPayload {
  readonly colorSamples?: readonly RgbSampleDTO[];
  readonly freeText?: string;
  /**
   * The user's category names (from SQLite). Passed so the vision model can
   * classify the garment against the user's OWN categories — no fixed list.
   */
  readonly categoryNames?: readonly string[];
  /** Image bytes for vision providers (e.g. Ollama). */
  readonly image?: { readonly base64: string; readonly mimeType: string };
}

/** Request to persist image bytes (original + optional thumbnail). */
export interface SaveImagePayload {
  /** Base64 of the original image bytes. */
  readonly dataBase64: string;
  readonly mimeType: string;
  /** File extension without the dot (png/jpg/webp/…). */
  readonly extension: string;
  readonly originalName?: string;
  /** Base64 of a pre-rendered optimized thumbnail (WebP). */
  readonly thumbnailBase64?: string;
}

/** Result of persisting an image: the keys used to reference it. */
export interface SaveImageResultDTO {
  readonly storageKey: string;
  readonly thumbnailKey: string | null;
}

/** Image bytes returned to the renderer (base64) for direct <img> display. */
export interface ImageDataDTO {
  readonly base64: string;
  readonly mimeType: string;
}
