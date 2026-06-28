/**
 * Plugin Host — the desktop main-process integration of `@mas/plugin-sdk`.
 *
 * This is the composition seam that connects the engine-agnostic plugin host
 * kernel to the REAL M-A-S application layer and surfaces plugin contributions
 * to the existing core seams WITHOUT modifying the core:
 *
 *  - contributed `ITextProvider`s are merged into a Phase-5 `AIProviderRouter`,
 *  - contributed DECLARATIVE recommendation rules become the additive
 *    `affinityBias` the Phase-5 `OutfitRankingEngine` already consumes,
 *  - importers / exporters / analyzers / image formats / render engines / UI
 *    panels / garment & category types are exposed for their respective seams.
 *
 * The plugin's only bridge to the domain is the {@link HostBackend} built here,
 * which talks to the `@mas/core` CQRS `QueryBus` — never the database. The pure
 * parts of this module (backend mapping, router/enrichment assembly) are
 * offline-testable; only the injected Worker-Threads sandbox is runtime/CI-
 * deferred.
 */
import { type KeyObject } from 'node:crypto';

import {
  AIProviderRouter,
  GetWardrobeQuery,
  isOk,
  type Garment,
  type ITextProvider,
  type QueryBus,
  type RankingEnrichment,
} from '@mas/core';

import {
  CompatibilityChecker,
  InMemoryPluginStorageProvider,
  PLUGIN_SDK_VERSION,
  PluginLoader,
  PluginManager,
  SignatureVerifier,
  STRICT_SIGNATURE_POLICY,
  buildAffinityBiasFromRules,
  type AnalyzerContribution,
  type CategoryTypeContribution,
  type ExporterContribution,
  type GarmentTypeContribution,
  type GarmentView,
  type HostBackend,
  type ImageFormatContribution,
  type ImporterContribution,
  type IPluginSandbox,
  type PermissionApprover,
  type PluginActivityLogger,
  type PluginStorageApi,
  type RecommendationSummary,
  type RenderEngineContribution,
  type ResourceLimits,
  type SignaturePolicy,
  type UiPanelContribution,
} from '@mas/plugin-sdk';

/** The M-A-S host application version advertised to plugins. */
export const MAS_HOST_VERSION = '0.7.0' as const;

/** Optionally request recommendations on a plugin's behalf. */
export type RecommendFn = (message: string) => Promise<readonly RecommendationSummary[]>;

/** Options for constructing the {@link PluginHost}. */
export interface PluginHostOptions {
  readonly queries: QueryBus;
  /** The app's `ILogger` (structurally a `PluginActivityLogger`). */
  readonly logger?: PluginActivityLogger;
  /** Isolation strategy (Worker-Threads in production, in-process in tests). */
  readonly sandbox: IPluginSandbox;
  readonly trustedKeys?: Iterable<readonly [string, KeyObject | string]>;
  readonly signaturePolicy?: SignaturePolicy;
  readonly approver?: PermissionApprover;
  readonly limits?: ResourceLimits;
  /** Bridge plugin recommendation requests to the orchestrator (optional). */
  readonly recommend?: RecommendFn;
  /** Plugin-scoped storage provider (in-memory by default). */
  readonly storage?: { storageFor(pluginId: string): PluginStorageApi };
}

/** Map a domain {@link Garment} to the read-only view plugins receive. */
export const garmentToView = (g: Garment): GarmentView => ({
  id: g.id,
  name: g.name,
  category: g.category,
  subcategory: g.subcategory,
  colorName: g.color.name,
  tags: [...g.tags],
  formality: g.formality,
});

/** Build a {@link HostBackend} backed by the core CQRS query bus. */
export const createCoreHostBackend = (
  queries: QueryBus,
  options: {
    recommend?: RecommendFn;
    storage?: { storageFor(pluginId: string): PluginStorageApi };
  } = {},
): HostBackend => {
  const storage = options.storage ?? new InMemoryPluginStorageProvider();

  const listGarments = async (): Promise<readonly GarmentView[]> => {
    const result = await queries.ask(new GetWardrobeQuery());
    if (!isOk(result)) {
      return [];
    }
    return result.value.garments.map(garmentToView);
  };

  return {
    hostVersion: MAS_HOST_VERSION,
    sdkVersion: PLUGIN_SDK_VERSION,
    listGarments,
    getGarment: async (id: string): Promise<GarmentView | null> => {
      const all = await listGarments();
      return all.find((g) => g.id === id) ?? null;
    },
    countGarments: async (): Promise<number> => (await listGarments()).length,
    requestRecommendations: (message: string): Promise<readonly RecommendationSummary[]> =>
      options.recommend?.(message) ?? Promise.resolve([]),
    storageFor: (pluginId: string): PluginStorageApi => storage.storageFor(pluginId),
  };
};

export class PluginHost {
  public readonly manager: PluginManager;

  public constructor(options: PluginHostOptions) {
    const backend = createCoreHostBackend(options.queries, {
      ...(options.recommend !== undefined ? { recommend: options.recommend } : {}),
      ...(options.storage !== undefined ? { storage: options.storage } : {}),
    });
    const verifier = new SignatureVerifier(
      options.trustedKeys ?? [],
      options.signaturePolicy ?? STRICT_SIGNATURE_POLICY,
    );
    const checker = new CompatibilityChecker({
      hostVersion: MAS_HOST_VERSION,
      sdkVersion: PLUGIN_SDK_VERSION,
    });
    const loader = new PluginLoader(checker, verifier);
    this.manager = new PluginManager({
      sandbox: options.sandbox,
      loader,
      backend,
      ...(options.logger !== undefined ? { activityLogger: options.logger } : {}),
      ...(options.approver !== undefined ? { approver: options.approver } : {}),
      ...(options.limits !== undefined ? { limits: options.limits } : {}),
    });
  }

  /* --------------------- extension API → core seams ---------------------- */

  /**
   * Build a Phase-5 {@link AIProviderRouter} that includes contributed text
   * providers (sorted by their priority hint) AFTER the base providers, so a
   * plugin can add a provider without touching the orchestrator.
   */
  public textProviderRouter(base: readonly ITextProvider[] = []): AIProviderRouter {
    const contributed = [...this.manager.extensionRegistry.aiProviders()]
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
      .map((c) => c.provider);
    return new AIProviderRouter([...base, ...contributed]);
  }

  /**
   * Build the additive ranking enrichment from contributed DECLARATIVE rules.
   * The core evaluates these weights; they can never revive a disqualified
   * outfit (ADR-012), so no business rule moves into a plugin.
   */
  public rankingEnrichment(): RankingEnrichment {
    const rules = this.manager.extensionRegistry.recommendationRules();
    if (rules.length === 0) {
      return {};
    }
    return { affinityBias: buildAffinityBiasFromRules(rules) };
  }

  public importers(): readonly ImporterContribution[] {
    return this.manager.extensionRegistry.importers();
  }
  public exporters(): readonly ExporterContribution[] {
    return this.manager.extensionRegistry.exporters();
  }
  public analyzers(): readonly AnalyzerContribution[] {
    return this.manager.extensionRegistry.analyzers();
  }
  public imageFormats(): readonly ImageFormatContribution[] {
    return this.manager.extensionRegistry.imageFormats();
  }
  public renderEngines(): readonly RenderEngineContribution[] {
    return this.manager.extensionRegistry.renderEngines();
  }
  public uiPanels(): readonly UiPanelContribution[] {
    return this.manager.extensionRegistry.uiPanels();
  }
  public garmentTypes(): readonly GarmentTypeContribution[] {
    return this.manager.extensionRegistry.garmentTypes();
  }
  public categoryTypes(): readonly CategoryTypeContribution[] {
    return this.manager.extensionRegistry.categoryTypes();
  }
}
