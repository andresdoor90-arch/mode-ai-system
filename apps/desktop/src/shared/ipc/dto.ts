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
  readonly color: ColorDTO;
  readonly brand: string | null;
  readonly seasons: readonly string[];
  readonly images: readonly string[];
  readonly tags: readonly string[];
  readonly status: GarmentStatusDTO;
  readonly wearCount: number;
  readonly lastWornAt: string | null;
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
  readonly colorHex: string;
  readonly colorName?: string;
  readonly seasons: readonly string[];
  readonly brand?: string;
  readonly tags?: readonly string[];
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

export interface CategoryPayload {
  readonly category: string;
}

export interface SeasonPayload {
  readonly season: string;
}
