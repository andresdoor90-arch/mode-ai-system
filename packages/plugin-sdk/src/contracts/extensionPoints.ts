/**
 * Extension-point catalog — the STABLE, versioned public surface plugins use to
 * extend M-A-S WITHOUT modifying the core.
 *
 * Each extension point hooks a plugin contribution onto an existing M-A-S seam:
 *  - AI_PROVIDER / EMBEDDER   → the Phase 5 `ITextProvider` / `IEmbedder` ports
 *                               (fed into the `AIProviderRouter` / embedding seam)
 *  - RENDER_ENGINE            → the Phase 6 `IRenderEngine` rendering seam
 *  - ANALYZER                 → a new wardrobe analyzer
 *  - IMPORTER / EXPORTER       → new portable-data formats
 *  - IMAGE_FORMAT             → new image decoders/encoders
 *  - RECOMMENDATION_RULE      → DECLARATIVE weights the core's additive ranking
 *                               evaluates (never executable business rules)
 *  - UI_PANEL                 → a renderer extension-point (metadata only)
 *  - GARMENT_TYPE / CATEGORY_TYPE → new dynamic garment/category types
 *
 * CRITICAL: contributions are DATA + thin strategy objects the core invokes
 * through controlled APIs. No contribution may contain a domain business rule;
 * the recommendation contribution in particular is purely declarative so the
 * core (not the plugin) decides, and an additive bias can never revive a
 * disqualified outfit.
 */
import {
  type Garment,
  type IEmbedder,
  type ITextProvider,
  type Occasion,
  type Season,
} from '@mas/core';

import { type PluginCapability } from './permissions';

/** The closed set of extension points. */
export enum ExtensionPointId {
  AiProvider = 'ai-provider',
  Embedder = 'embedder',
  RenderEngine = 'render-engine',
  Analyzer = 'analyzer',
  Importer = 'importer',
  Exporter = 'exporter',
  ImageFormat = 'image-format',
  RecommendationRule = 'recommendation-rule',
  UiPanel = 'ui-panel',
  GarmentType = 'garment-type',
  CategoryType = 'category-type',
}

/**
 * Capability each extension point REQUIRES. The host refuses to register a
 * contribution unless the plugin holds the mapped capability, so declaring a
 * contribution without its permission is impossible.
 */
export const EXTENSION_POINT_CAPABILITY: Readonly<Record<ExtensionPointId, PluginCapability>> = {
  [ExtensionPointId.AiProvider]: 'ai:provide',
  [ExtensionPointId.Embedder]: 'embedding:provide',
  [ExtensionPointId.RenderEngine]: 'rendering:provide',
  [ExtensionPointId.Analyzer]: 'analyzer:provide',
  [ExtensionPointId.Importer]: 'import:provide',
  [ExtensionPointId.Exporter]: 'export:provide',
  [ExtensionPointId.ImageFormat]: 'imageFormat:provide',
  [ExtensionPointId.RecommendationRule]: 'recommendation:contribute',
  [ExtensionPointId.UiPanel]: 'ui:contribute',
  [ExtensionPointId.GarmentType]: 'garmentType:contribute',
  [ExtensionPointId.CategoryType]: 'categoryType:contribute',
};

/* ----------------------------- AI provider -------------------------------- */

/** A new AI text provider, assignable to the core `ITextProvider` port. */
export interface AiProviderContribution {
  readonly point: ExtensionPointId.AiProvider;
  /** Priority hint for the router (lower = tried earlier). */
  readonly priority?: number;
  readonly provider: ITextProvider;
}

/** A new embedding provider, assignable to the core `IEmbedder` port. */
export interface EmbedderContribution {
  readonly point: ExtensionPointId.Embedder;
  readonly embedder: IEmbedder;
}

/* --------------------------- rendering engine ----------------------------- */

/**
 * Structural shape of a graphics engine, mirroring `@mas/rendering`'s
 * `IRenderEngine` WITHOUT importing it (keeps the SDK dependency-light). The
 * desktop host narrows the produced engine to the real `IRenderEngine`.
 */
export interface RenderEngineLike {
  readonly id: string;
  mount(target: unknown): void;
  render(scene: unknown): void;
  updateCamera(camera: unknown): void;
  captureScreenshot(request: unknown): Promise<unknown>;
  dispose(): void;
}

/** A new rendering engine plugged into the Phase 6 `IRenderEngine` seam. */
export interface RenderEngineContribution {
  readonly point: ExtensionPointId.RenderEngine;
  readonly engineId: string;
  /** Lazily construct the engine (so registration is cheap and side-effect free). */
  create(): RenderEngineLike;
}

/* ------------------------------- analyzer --------------------------------- */

/** A read-only snapshot of a garment handed to analyzers (no domain mutation). */
export interface GarmentView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly colorName: string;
  readonly tags: readonly string[];
  readonly formality: number;
}

/** A new wardrobe analyzer producing arbitrary structured insights. */
export interface AnalyzerContribution<TResult = unknown> {
  readonly point: ExtensionPointId.Analyzer;
  readonly analyzerId: string;
  readonly title: string;
  analyze(garments: readonly GarmentView[]): TResult | Promise<TResult>;
}

/* --------------------------- import / export ------------------------------ */

/** A neutral garment record produced by an importer (mapped to commands by host). */
export interface RawGarmentRecord {
  readonly name: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly colorHex?: string;
  readonly colorName?: string;
  readonly seasons?: readonly string[];
  readonly tags?: readonly string[];
  readonly brand?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** A new importer for a third-party wardrobe format. */
export interface ImporterContribution {
  readonly point: ExtensionPointId.Importer;
  readonly formatId: string;
  readonly label: string;
  readonly extensions: readonly string[];
  /** Decide whether this importer handles a given file name. */
  canImport(fileName: string): boolean;
  /** Parse raw bytes into neutral garment records. */
  import(bytes: Uint8Array): Promise<readonly RawGarmentRecord[]>;
}

/** A new exporter for a third-party wardrobe format. */
export interface ExporterContribution {
  readonly point: ExtensionPointId.Exporter;
  readonly formatId: string;
  readonly label: string;
  readonly extension: string;
  /** Serialise the supplied garment views into bytes. */
  export(garments: readonly GarmentView[]): Promise<Uint8Array>;
}

/* ------------------------------ image format ------------------------------ */

/** A decoded image (raw RGBA + dimensions). */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** A new image format decoder/encoder. */
export interface ImageFormatContribution {
  readonly point: ExtensionPointId.ImageFormat;
  readonly formatId: string;
  readonly mimeType: string;
  readonly extensions: readonly string[];
  decode(bytes: Uint8Array): Promise<DecodedImage>;
  encode?(image: DecodedImage): Promise<Uint8Array>;
}

/* -------------------------- recommendation rule --------------------------- */

/**
 * A DECLARATIVE recommendation contribution: additive weight hints keyed by
 * tag / colour name / subcategory, each in roughly [-1, 1]. The CORE evaluates
 * these into the additive `affinityBias` the `OutfitRankingEngine` already
 * applies (capped, never able to revive a disqualified outfit). The plugin
 * supplies preferences, NOT decisions — no business rule lives in the plugin.
 */
export interface RecommendationRuleContribution {
  readonly point: ExtensionPointId.RecommendationRule;
  readonly ruleId: string;
  readonly description: string;
  readonly weights: {
    readonly tags?: Readonly<Record<string, number>>;
    readonly colors?: Readonly<Record<string, number>>;
    readonly subcategories?: Readonly<Record<string, number>>;
  };
  /** Optional restriction: only apply for these occasions/seasons. */
  readonly appliesTo?: {
    readonly occasions?: readonly Occasion[];
    readonly seasons?: readonly Season[];
  };
}

/* -------------------------------- UI panel -------------------------------- */

/** Metadata describing a renderer panel a plugin contributes (surfaced by UI). */
export interface UiPanelContribution {
  readonly point: ExtensionPointId.UiPanel;
  readonly panelId: string;
  readonly title: string;
  /** Route the renderer mounts the panel at (e.g. "/plugins/laundry"). */
  readonly route: string;
  /** Optional icon name (resolved by the renderer's icon set). */
  readonly icon?: string;
  /** Sidebar grouping hint. */
  readonly group?: 'main' | 'library' | 'system';
}

/* --------------------- garment / category type contributions -------------- */

/** A new garment type plugins can register (declarative). */
export interface GarmentTypeContribution {
  readonly point: ExtensionPointId.GarmentType;
  readonly typeId: string;
  readonly label: string;
  /** Slug of the category this type belongs under, when applicable. */
  readonly categorySlug?: string;
  readonly defaultAttributes?: Readonly<Record<string, string>>;
}

/** A new category type/seed plugins can register (leverages dynamic categories). */
export interface CategoryTypeContribution {
  readonly point: ExtensionPointId.CategoryType;
  readonly slug: string;
  readonly name: string;
  readonly group: string;
  readonly metadata?: {
    readonly layerSlot?: string;
    readonly formality?: number;
    readonly comfort?: number;
    readonly heavyOuterwear?: boolean;
  };
}

/** The discriminated union of every contribution kind. */
export type ExtensionContribution =
  | AiProviderContribution
  | EmbedderContribution
  | RenderEngineContribution
  | AnalyzerContribution
  | ImporterContribution
  | ExporterContribution
  | ImageFormatContribution
  | RecommendationRuleContribution
  | UiPanelContribution
  | GarmentTypeContribution
  | CategoryTypeContribution;

/** Map an extension point to its contribution type (for typed getters). */
export interface ContributionByPoint {
  [ExtensionPointId.AiProvider]: AiProviderContribution;
  [ExtensionPointId.Embedder]: EmbedderContribution;
  [ExtensionPointId.RenderEngine]: RenderEngineContribution;
  [ExtensionPointId.Analyzer]: AnalyzerContribution;
  [ExtensionPointId.Importer]: ImporterContribution;
  [ExtensionPointId.Exporter]: ExporterContribution;
  [ExtensionPointId.ImageFormat]: ImageFormatContribution;
  [ExtensionPointId.RecommendationRule]: RecommendationRuleContribution;
  [ExtensionPointId.UiPanel]: UiPanelContribution;
  [ExtensionPointId.GarmentType]: GarmentTypeContribution;
  [ExtensionPointId.CategoryType]: CategoryTypeContribution;
}

/**
 * Build the additive affinity-bias function the core ranking consumes from a
 * set of declarative recommendation rules. Pure: turns plugin-declared weights
 * into a bounded per-outfit bias in [-1, 1]. Lives in the SDK so both the host
 * and tests share one definition; the core remains the evaluator.
 */
export const buildAffinityBiasFromRules = (
  rules: readonly RecommendationRuleContribution[],
): ((garments: readonly Garment[]) => number) => {
  return (garments: readonly Garment[]): number => {
    if (garments.length === 0 || rules.length === 0) {
      return 0;
    }
    let total = 0;
    let counted = 0;
    for (const garment of garments) {
      for (const rule of rules) {
        const tagW = sumWeights(rule.weights.tags, garment.tags);
        const colorW = rule.weights.colors?.[(garment.color.name ?? '').toLowerCase()] ?? 0;
        const subW = rule.weights.subcategories?.[garment.subcategory] ?? 0;
        const contribution = tagW + colorW + subW;
        if (contribution !== 0) {
          total += contribution;
          counted += 1;
        }
      }
    }
    if (counted === 0) {
      return 0;
    }
    return clamp(total / counted, -1, 1);
  };
};

const sumWeights = (
  table: Readonly<Record<string, number>> | undefined,
  keys: readonly string[],
): number => {
  if (table === undefined) {
    return 0;
  }
  let sum = 0;
  for (const key of keys) {
    sum += table[key.toLowerCase()] ?? table[key] ?? 0;
  }
  return sum;
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
