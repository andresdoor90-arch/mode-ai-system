/**
 * Application composition root (main process).
 *
 * Wires the pure `@mas/core` application layer — the Command/Query buses and
 * their use-case handlers — to concrete repositories. This is the ONLY place
 * the desktop app assembles the domain; IPC handlers receive the ready-made
 * buses and never construct use cases themselves.
 *
 * Persistence currently uses the in-memory repositories (see
 * {@link InMemoryGarmentRepository}); they are port-compatible with the
 * SQLite-backed repositories in `@mas/infrastructure`, so production/CI builds
 * can swap the implementations here without touching the use cases, the IPC
 * layer or the renderer.
 *
 * Phase 5 wires the provider-agnostic {@link AIOrchestrator} here: the cognitive
 * engine lives in `@mas/core` and depends only on domain services + abstract
 * ports. By default NO AI provider is configured, so the engine runs in its
 * mandatory graceful-degradation mode — full recommendations from domain rules
 * + scoring alone. Preference memory is persisted through a
 * `@mas/infrastructure` store so learning survives restarts. Swapping in a real
 * provider (Ollama/OpenAI/Anthropic via the LangChain adapters) is a matter of
 * populating the {@link AIProviderRouter} here — the domain never changes.
 */
import {
  AddGarmentCommand,
  AddGarmentHandler,
  ADD_GARMENT,
  AddPhotosHandler,
  ADD_PHOTOS,
  AIOrchestrator,
  AIProviderRouter,
  ArchiveGarmentHandler,
  ARCHIVE_GARMENT,
  Color,
  CommandBus,
  ConfirmGarmentTagsHandler,
  CONFIRM_GARMENT_TAGS,
  CreateCategoryHandler,
  CREATE_CATEGORY,
  CreateCollectionHandler,
  CREATE_COLLECTION,
  CreateOutfitHandler,
  CREATE_OUTFIT,
  DeferredVisionTagSuggester,
  DeleteCategoryHandler,
  DELETE_CATEGORY,
  DuplicateGarmentHandler,
  DUPLICATE_GARMENT,
  GarmentCategory,
  GetCategoriesHandler,
  GET_CATEGORIES,
  GetCategoryTreeHandler,
  GET_CATEGORY_TREE,
  GetColorPaletteHandler,
  GET_COLOR_PALETTE,
  GetGarmentsByCategoryHandler,
  GET_GARMENTS_BY_CATEGORY,
  GetOutfitSuggestionsHandler,
  GET_OUTFIT_SUGGESTIONS,
  GetSeasonalWardrobeHandler,
  GET_SEASONAL_WARDROBE,
  GetStyleAnalysisHandler,
  GET_STYLE_ANALYSIS,
  GetWardrobeHandler,
  GET_WARDROBE,
  MemoryEngine,
  QueryBus,
  RateOutfitHandler,
  RATE_OUTFIT,
  RecommendOutfitsHandler,
  RECOMMEND_OUTFITS,
  RemovePhotoHandler,
  REMOVE_PHOTO,
  RemoveGarmentHandler,
  REMOVE_GARMENT,
  ReorderCategoriesHandler,
  REORDER_CATEGORIES,
  ReorderPhotosHandler,
  REORDER_PHOTOS,
  RestoreGarmentHandler,
  RESTORE_GARMENT,
  Season,
  SearchGarmentsHandler,
  SEARCH_GARMENTS,
  SeedDefaultTaxonomyCommand,
  SeedDefaultTaxonomyHandler,
  SEED_DEFAULT_TAXONOMY,
  SemanticIndexProjection,
  SequentialIdGenerator,
  SetPreferencesHandler,
  SET_PREFERENCES,
  SuggestGarmentTagsHandler,
  SUGGEST_GARMENT_TAGS,
  TopSubcategory,
  BottomSubcategory,
  OuterwearSubcategory,
  ShoeSubcategory,
  AccessorySubcategory,
  DressSubcategory,
  TransformPhotoHandler,
  TRANSFORM_PHOTO,
  UpdateCategoryHandler,
  UPDATE_CATEGORY,
  UpdateGarmentHandler,
  UPDATE_GARMENT,
  UpdateProfileHandler,
  UPDATE_PROFILE,
  unwrap,
  WardrobeSyncCoordinator,
  type CreateGarmentInput,
  type EmbeddingVectorResult,
  type GarmentId,
  type GarmentSnapshot,
  type IEmbedder,
  type IdGenerator,
  type IPreferenceMemoryStore,
  type WardrobeSyncSubsystems,
} from '@mas/core';

import {
  FilePreferenceMemoryStore,
  InMemoryEventBus,
  InMemoryPreferenceMemoryStore,
  InMemoryVectorStore,
} from '@mas/infrastructure';

import {
  InMemoryCategoryRepository,
  InMemoryCollectionRepository,
  InMemoryGarmentRepository,
  InMemoryOutfitRepository,
  InMemoryUserProfileRepository,
} from './inMemoryRepositories';

export interface Repositories {
  readonly garments: InMemoryGarmentRepository;
  readonly outfits: InMemoryOutfitRepository;
  readonly collections: InMemoryCollectionRepository;
  readonly profiles: InMemoryUserProfileRepository;
  readonly categories: InMemoryCategoryRepository;
}

/** Options for assembling the container. */
export interface AppContainerOptions {
  /** Directory for durable app data (preference memory, etc.). */
  readonly dataDir?: string;
}

/**
 * Holds the wired application layer. Created once at startup and shared by all
 * IPC handlers for the lifetime of the process.
 */
export class AppContainer {
  public readonly commands: CommandBus;
  public readonly queries: QueryBus;
  public readonly repositories: Repositories;
  /** The provider-agnostic AI engine (offline-capable by default). */
  public readonly orchestrator: AIOrchestrator;
  /** In-memory pub/sub bus driving the automatic, event-driven sync (Module 6). */
  public readonly events: InMemoryEventBus;
  private readonly ids: IdGenerator;
  private readonly router: AIProviderRouter;
  private readonly memory: MemoryEngine;
  private readonly sync: WardrobeSyncCoordinator;

  private constructor(options: AppContainerOptions = {}) {
    this.ids = new SequentialIdGenerator('mas');
    this.repositories = {
      garments: new InMemoryGarmentRepository(),
      outfits: new InMemoryOutfitRepository(),
      collections: new InMemoryCollectionRepository(),
      profiles: new InMemoryUserProfileRepository(),
      categories: new InMemoryCategoryRepository(),
    };

    this.events = new InMemoryEventBus();

    // Preference memory persists through an infrastructure store so the engine
    // genuinely learns across sessions; falls back to volatile memory when no
    // data directory is available (e.g. tests).
    const memoryStore: IPreferenceMemoryStore =
      options.dataDir !== undefined
        ? new FilePreferenceMemoryStore(`${options.dataDir}/ai/preference-memory.json`)
        : new InMemoryPreferenceMemoryStore();
    this.memory = new MemoryEngine(memoryStore);

    // No provider configured by default ⇒ graceful degradation (rules only).
    // Real providers are registered here once the user configures them.
    this.router = new AIProviderRouter([]);

    this.orchestrator = new AIOrchestrator({
      garments: this.repositories.garments,
      outfits: this.repositories.outfits,
      profiles: this.repositories.profiles,
      router: this.router,
      memory: this.memory,
    });

    // Module 6: automatically keep the cognitive subsystems in sync with every
    // wardrobe change. Decoupled — handlers publish events, subsystems react.
    this.sync = new WardrobeSyncCoordinator(this.events, this.buildSyncSubsystems()).start();

    this.commands = new CommandBus();
    this.queries = new QueryBus();
    this.registerHandlers();
  }

  /** Tear down event subscriptions (used on shutdown / teardown). */
  public dispose(): void {
    this.sync.stop();
  }

  /**
   * Wire the cognitive-engine subsystems behind their abstract ports. The
   * semantic index reuses the same embedder + vector-store seams as the AI
   * orchestrator; the others are lightweight in-process projections. All are
   * offline-capable.
   */
  private buildSyncSubsystems(): WardrobeSyncSubsystems {
    const embedder: IEmbedder = new HashingEmbedder(32);
    const semanticIndex = new SemanticIndexProjection(embedder, new InMemoryVectorStore());
    const inventoryCounts = new Map<string, GarmentSnapshot>();
    return {
      inventory: {
        applyUpserted: (snapshot) => {
          inventoryCounts.set(snapshot.id, snapshot);
        },
        applyRemoved: (id) => {
          inventoryCounts.delete(id);
        },
      },
      semanticIndex,
      cache: {
        // The recommendation result + visualisation scene caches are derived;
        // invalidation is a no-op here (caches are rebuilt lazily on next query).
        invalidateRecommendations: () => {},
        invalidateVisualization: () => {},
      },
      history: {
        record: () => {
          /* History persistence is wired in a later phase; events are observed. */
        },
      },
    };
  }

  /** Build the container and seed it with demonstration data. */
  public static async create(options: AppContainerOptions = {}): Promise<AppContainer> {
    const container = new AppContainer(options);
    await container.seed();
    return container;
  }

  /** Report the AI engine's current capability for the UI status indicator. */
  public async aiStatus(): Promise<{
    providerAvailable: boolean;
    providerId: string | null;
    recommendationsEnabled: boolean;
    degraded: boolean;
  }> {
    const selection = await this.router.select();
    return {
      providerAvailable: selection.provider !== null,
      providerId: selection.provider?.id ?? null,
      // Recommendations always work — the domain rules need no provider.
      recommendationsEnabled: true,
      degraded: selection.provider === null,
    };
  }

  private registerHandlers(): void {
    const { garments, outfits, collections, profiles, categories } = this.repositories;
    const events = this.events;
    const suggester = new DeferredVisionTagSuggester();

    this.commands
      .register(ADD_GARMENT, new AddGarmentHandler(garments, this.ids, events))
      .register(UPDATE_GARMENT, new UpdateGarmentHandler(garments, events))
      .register(REMOVE_GARMENT, new RemoveGarmentHandler(garments, events))
      .register(DUPLICATE_GARMENT, new DuplicateGarmentHandler(garments, this.ids, events))
      .register(ARCHIVE_GARMENT, new ArchiveGarmentHandler(garments, events))
      .register(RESTORE_GARMENT, new RestoreGarmentHandler(garments, events))
      .register(ADD_PHOTOS, new AddPhotosHandler(garments, this.ids, events))
      .register(REMOVE_PHOTO, new RemovePhotoHandler(garments, events))
      .register(REORDER_PHOTOS, new ReorderPhotosHandler(garments, events))
      .register(TRANSFORM_PHOTO, new TransformPhotoHandler(garments, events))
      .register(CONFIRM_GARMENT_TAGS, new ConfirmGarmentTagsHandler(garments, events))
      .register(CREATE_CATEGORY, new CreateCategoryHandler(categories, this.ids, events))
      .register(UPDATE_CATEGORY, new UpdateCategoryHandler(categories, events))
      .register(REORDER_CATEGORIES, new ReorderCategoriesHandler(categories, events))
      .register(DELETE_CATEGORY, new DeleteCategoryHandler(categories, events))
      .register(SEED_DEFAULT_TAXONOMY, new SeedDefaultTaxonomyHandler(categories, this.ids))
      .register(CREATE_OUTFIT, new CreateOutfitHandler(garments, outfits, this.ids))
      .register(RATE_OUTFIT, new RateOutfitHandler(outfits))
      .register(CREATE_COLLECTION, new CreateCollectionHandler(garments, collections, this.ids))
      .register(UPDATE_PROFILE, new UpdateProfileHandler(profiles))
      .register(SET_PREFERENCES, new SetPreferencesHandler(profiles));

    this.queries
      .register(GET_WARDROBE, new GetWardrobeHandler(garments, collections))
      .register(GET_GARMENTS_BY_CATEGORY, new GetGarmentsByCategoryHandler(garments))
      .register(GET_SEASONAL_WARDROBE, new GetSeasonalWardrobeHandler(garments))
      .register(SEARCH_GARMENTS, new SearchGarmentsHandler(garments))
      .register(GET_CATEGORIES, new GetCategoriesHandler(categories))
      .register(GET_CATEGORY_TREE, new GetCategoryTreeHandler(categories))
      .register(SUGGEST_GARMENT_TAGS, new SuggestGarmentTagsHandler(garments, suggester))
      .register(GET_STYLE_ANALYSIS, new GetStyleAnalysisHandler(garments))
      .register(GET_COLOR_PALETTE, new GetColorPaletteHandler(garments, profiles))
      .register(GET_OUTFIT_SUGGESTIONS, new GetOutfitSuggestionsHandler(garments, profiles))
      .register(RECOMMEND_OUTFITS, new RecommendOutfitsHandler(this.orchestrator));
  }

  /**
   * Seed demonstration garments through the real `AddGarment` use case, so the
   * wired query path (wardrobe, analysis, suggestions) returns realistic data
   * out of the box. This is sample content for the Phase 4 UI, not fixtures.
   */
  private async seed(): Promise<void> {
    // Module 1: seed the default taxonomy as user-editable category DATA. This
    // is the enum→data migration in action — nothing is hardcoded; the user can
    // edit, regroup, reorder or delete any of it.
    await this.commands.send(new SeedDefaultTaxonomyCommand());

    const c = (hex: string, name: string): Color => unwrap(Color.fromHex(hex, name));

    const samples: CreateGarmentInput[] = [
      {
        name: 'Oxford Cotton Shirt',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.Shirt,
        color: c('#1d3f72', 'Navy'),
        seasons: [Season.AllSeason],
        brand: 'Atelier',
        tags: ['work', 'classic'],
      },
      {
        name: 'Merino Crew Sweater',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.Sweater,
        color: c('#6b705c', 'Sage'),
        seasons: [Season.Autumn, Season.Winter],
        brand: 'NordKnit',
        tags: ['cozy'],
      },
      {
        name: 'Linen Tee',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.TShirt,
        color: c('#f2f0e6', 'Ivory'),
        seasons: [Season.Spring, Season.Summer],
        tags: ['casual'],
      },
      {
        name: 'Tailored Wool Trousers',
        category: GarmentCategory.Bottoms,
        subcategory: BottomSubcategory.Trousers,
        color: c('#3a3a3a', 'Charcoal'),
        seasons: [Season.AllSeason],
        brand: 'Atelier',
        tags: ['work'],
      },
      {
        name: 'Slim Indigo Jeans',
        category: GarmentCategory.Bottoms,
        subcategory: BottomSubcategory.Jeans,
        color: c('#2a3b55', 'Indigo'),
        seasons: [Season.AllSeason],
        tags: ['casual', 'everyday'],
      },
      {
        name: 'Pleated Midi Skirt',
        category: GarmentCategory.Bottoms,
        subcategory: BottomSubcategory.Skirt,
        color: c('#7a2e3b', 'Burgundy'),
        seasons: [Season.Autumn],
        tags: ['date'],
      },
      {
        name: 'Wrap Day Dress',
        category: GarmentCategory.Dresses,
        subcategory: DressSubcategory.Casual,
        color: c('#2f6b5e', 'Emerald'),
        seasons: [Season.Spring, Season.Summer],
        brand: 'Lumière',
        tags: ['date', 'party'],
      },
      {
        name: 'Wool Overcoat',
        category: GarmentCategory.Outerwear,
        subcategory: OuterwearSubcategory.Coat,
        color: c('#4a3b2f', 'Camel'),
        seasons: [Season.Winter],
        brand: 'NordKnit',
        tags: ['warm'],
      },
      {
        name: 'Structured Blazer',
        category: GarmentCategory.Outerwear,
        subcategory: OuterwearSubcategory.Blazer,
        color: c('#23262b', 'Onyx'),
        seasons: [Season.AllSeason],
        brand: 'Atelier',
        tags: ['work', 'formal'],
      },
      {
        name: 'Leather Derby Shoes',
        category: GarmentCategory.Shoes,
        subcategory: ShoeSubcategory.DressShoes,
        color: c('#3b2417', 'Cognac'),
        seasons: [Season.AllSeason],
        tags: ['work', 'formal'],
      },
      {
        name: 'Canvas Sneakers',
        category: GarmentCategory.Shoes,
        subcategory: ShoeSubcategory.Sneakers,
        color: c('#e9e9e9', 'Off-white'),
        seasons: [Season.Spring, Season.Summer],
        tags: ['casual'],
      },
      {
        name: 'Silk Pocket Square',
        category: GarmentCategory.Accessories,
        subcategory: AccessorySubcategory.Scarf,
        color: c('#b08968', 'Bronze'),
        seasons: [Season.AllSeason],
        tags: ['formal'],
      },
    ];

    for (const input of samples) {
      await this.commands.send(new AddGarmentCommand(input));
    }
  }
}

/**
 * Deterministic, dependency-free embedder used to keep the semantic index in
 * sync offline (mirrors the hashing embedder the AI tests use). Real embedding
 * providers from `@mas/infrastructure` are assignable to the same port.
 */
class HashingEmbedder implements IEmbedder {
  public readonly id = 'hashing-embedder';
  public constructor(public readonly dimension = 32) {}

  public async embed(inputs: readonly string[]): Promise<EmbeddingVectorResult> {
    return {
      vectors: inputs.map((text) => this.hash(text)),
      model: this.id,
      dimension: this.dimension,
    };
  }

  private hash(text: string): number[] {
    const v = new Array<number>(this.dimension).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const slot = (code * 31 + i) % this.dimension;
      v[slot] = (v[slot] ?? 0) + ((code % 13) - 6) / 6;
    }
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return mag === 0 ? v : v.map((x) => x / mag);
  }
}
