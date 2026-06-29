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
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AddGarmentHandler,
  ADD_GARMENT,
  AddPhotosHandler,
  ADD_PHOTOS,
  AIOrchestrator,
  AIProviderRouter,
  AnnotateOutfitHistoryHandler,
  ANNOTATE_OUTFIT_HISTORY,
  ArchiveGarmentHandler,
  ARCHIVE_GARMENT,
  BaselineVisionProvider,
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
  GarmentAnalysisService,
  GetCategoriesHandler,
  GET_CATEGORIES,
  GetCategoryTreeHandler,
  GET_CATEGORY_TREE,
  GetColorPaletteHandler,
  GET_COLOR_PALETTE,
  GetGarmentsByCategoryHandler,
  GET_GARMENTS_BY_CATEGORY,
  GetGarmentUsageHistoryHandler,
  GET_GARMENT_USAGE_HISTORY,
  GetOutfitHistoryStatisticsHandler,
  GET_OUTFIT_HISTORY_STATISTICS,
  GetOutfitSuggestionsHandler,
  GET_OUTFIT_SUGGESTIONS,
  GetRecentRepetitionsHandler,
  GET_RECENT_REPETITIONS,
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
  RecordOutfitFeedbackHandler,
  RECORD_OUTFIT_FEEDBACK,
  RecordOutfitUsageHandler,
  RECORD_OUTFIT_USAGE,
  RepeatOutfitHandler,
  REPEAT_OUTFIT,
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
  SearchGarmentsHandler,
  SEARCH_GARMENTS,
  SearchOutfitHistoryHandler,
  SEARCH_OUTFIT_HISTORY,
  SeedDefaultTaxonomyHandler,
  SEED_DEFAULT_TAXONOMY,
  SemanticIndexProjection,
  SequentialIdGenerator,
  SetPreferencesHandler,
  SET_PREFERENCES,
  SuggestGarmentTagsHandler,
  SUGGEST_GARMENT_TAGS,
  TransformPhotoHandler,
  TRANSFORM_PHOTO,
  UpdateCategoryHandler,
  UPDATE_CATEGORY,
  UpdateGarmentHandler,
  UPDATE_GARMENT,
  CreateProfileHandler,
  CREATE_PROFILE,
  GetCurrentProfileHandler,
  GET_CURRENT_PROFILE,
  UpdateProfileHandler,
  UPDATE_PROFILE,
  WardrobeSyncCoordinator,
  type EmbeddingVectorResult,
  type GarmentId,
  type GarmentSnapshot,
  type IEmbedder,
  type IdGenerator,
  type IPreferenceMemoryStore,
  type WardrobeSyncSubsystems,
} from '@mas/core';

import {
  EMBEDDED_MIGRATIONS,
  FilePreferenceMemoryStore,
  ImageStorageService,
  InMemoryEventBus,
  InMemoryPreferenceMemoryStore,
  InMemoryVectorStore,
  LocalFileStorage,
  MigrationRunner,
  type SqlDatabase,
  createSqliteDatabase,
} from '@mas/infrastructure';

import { createInMemoryPersistence, createSqlPersistence, type Persistence } from './persistence';

/** The wired repository ports (SQL-backed in production, swappable for tests). */
export type Repositories = Persistence;

/** Options for assembling the container. */
export interface AppContainerOptions {
  /** Directory for durable app data (the SQLite DB, preference memory, etc.). */
  readonly dataDir?: string;
  /**
   * Inject an already-open {@link SqlDatabase} (offline tests pass a
   * bun:sqlite-backed store). When provided it becomes the real backing and
   * migrations are applied to it automatically.
   */
  readonly database?: SqlDatabase;
  /**
   * Force the in-memory persistence (no database). Defaults to false; used by
   * lightweight smoke tests that do not need durability.
   */
  readonly inMemory?: boolean;
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
  /** Image byte storage (originals + thumbnails) for garment photos. */
  public readonly images: ImageStorageService;
  /** Provider-agnostic garment photo analysis (baseline + hints + vision). */
  public readonly analysis: GarmentAnalysisService;
  /** In-memory pub/sub bus driving the automatic, event-driven sync (Module 6). */
  public readonly events: InMemoryEventBus;
  private readonly ids: IdGenerator;
  private readonly router: AIProviderRouter;
  private readonly memory: MemoryEngine;
  private readonly sync: WardrobeSyncCoordinator;
  private readonly database: SqlDatabase | undefined;

  private constructor(
    persistence: Persistence,
    options: AppContainerOptions,
    database: SqlDatabase | undefined,
  ) {
    this.ids = new SequentialIdGenerator('mas');
    this.repositories = persistence;
    this.database = database;

    this.events = new InMemoryEventBus();

    // Image byte storage: originals + thumbnails live under the data directory
    // (a temp dir when none is provided, e.g. in lightweight tests).
    const imagesRoot = options.dataDir ?? join(tmpdir(), 'mas-images');
    this.images = new ImageStorageService(new LocalFileStorage(imagesRoot, 'images'));

    // Garment photo analysis: the always-on colour baseline today; a real
    // vision provider (OpenAI/Ollama) layers on top here without other changes.
    this.analysis = new GarmentAnalysisService([new BaselineVisionProvider()]);

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
      // Persisted usage history feeds freshness / recent-repetition so
      // recommendations improve over time (Phase 7 Part B).
      history: this.repositories.history,
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

  /** Tear down event subscriptions + close the database (used on shutdown). */
  public dispose(): void {
    this.sync.stop();
    this.database?.close();
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

  /** Build the container, opening + migrating the database and seeding it. */
  public static async create(options: AppContainerOptions = {}): Promise<AppContainer> {
    let database: SqlDatabase | undefined;
    let persistence: Persistence;

    if (options.inMemory === true) {
      persistence = createInMemoryPersistence();
    } else if (options.database !== undefined) {
      database = options.database;
      persistence = createSqlPersistence(database);
    } else if (options.dataDir !== undefined) {
      // Production path: a durable, file-backed SQLite database under userData.
      database = await createSqliteDatabase(`${options.dataDir}/wardrobe.db`);
      persistence = createSqlPersistence(database);
    } else {
      // No durable location and no injected DB ⇒ volatile fallback.
      persistence = createInMemoryPersistence();
    }

    // Apply migrations to whatever real database backs us (idempotent + tracked).
    // Use the embedded migration SQL (not filesystem reads) so this works inside
    // a packaged Electron asar where the raw .sql assets are not available.
    if (database !== undefined) {
      const runner = new MigrationRunner(database);
      runner.migrate(EMBEDDED_MIGRATIONS);
    }

    const container = new AppContainer(persistence, options, database);
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
    const { garments, outfits, collections, profiles, categories, history } = this.repositories;
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
      .register(CREATE_PROFILE, new CreateProfileHandler(profiles, this.ids))
      .register(UPDATE_PROFILE, new UpdateProfileHandler(profiles))
      .register(SET_PREFERENCES, new SetPreferencesHandler(profiles))
      // Phase 7 Part B — outfit history (the accept/feedback path records usage
      // automatically AND feeds the preference memory).
      .register(
        RECORD_OUTFIT_FEEDBACK,
        new RecordOutfitFeedbackHandler(garments, history, this.ids, this.memory),
      )
      .register(RECORD_OUTFIT_USAGE, new RecordOutfitUsageHandler(garments, history, this.ids))
      .register(REPEAT_OUTFIT, new RepeatOutfitHandler(garments, history, this.ids))
      .register(ANNOTATE_OUTFIT_HISTORY, new AnnotateOutfitHistoryHandler(history));

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
      .register(RECOMMEND_OUTFITS, new RecommendOutfitsHandler(this.orchestrator))
      .register(SEARCH_OUTFIT_HISTORY, new SearchOutfitHistoryHandler(history))
      .register(GET_OUTFIT_HISTORY_STATISTICS, new GetOutfitHistoryStatisticsHandler(history))
      .register(GET_RECENT_REPETITIONS, new GetRecentRepetitionsHandler(history))
      .register(GET_GARMENT_USAGE_HISTORY, new GetGarmentUsageHistoryHandler(history))
      .register(GET_CURRENT_PROFILE, new GetCurrentProfileHandler(profiles));
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
