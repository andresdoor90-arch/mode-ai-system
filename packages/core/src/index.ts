/**
 * @mas/core — Domain layer public API.
 *
 * Framework-agnostic domain model for M-A-S, following Clean Architecture +
 * CQRS-lite. Nothing here imports Electron, React, SQLite, HTTP or any AI
 * library: the package is pure TypeScript and can run anywhere.
 *
 * Layers:
 *  - `shared`      — Result/error primitives, Entity/ValueObject bases, ids.
 *  - `domain`      — entities, value objects, repository contracts, services.
 *  - `application` — CQRS commands, queries, handlers and the in-memory bus.
 */

/** Package name, useful for diagnostics and logging. */
export const CORE_PACKAGE_NAME = '@mas/core' as const;

/** Semantic version of the core package. */
export const CORE_VERSION = '0.6.0' as const;

/* ----------------------------- shared kernel ----------------------------- */
export * from './shared/errors';
export * from './shared/Result';
export * from './shared/Guard';
export * from './shared/Identifier';
export * from './shared/IdGenerator';
export * from './shared/Entity';
export * from './shared/ValueObject';

/* ------------------------------ value objects ----------------------------- */
export * from './domain/value-objects/Season';
export * from './domain/value-objects/Occasion';
export * from './domain/value-objects/GarmentCategory';
export * from './domain/value-objects/GarmentSubcategory';
export * from './domain/value-objects/CategoryMetadata';
export * from './domain/value-objects/Photograph';
export * from './domain/value-objects/Color';
export * from './domain/value-objects/Size';
export * from './domain/value-objects/BodyMeasurements';
export * from './domain/value-objects/StylePreference';
export * from './domain/value-objects/WeatherCondition';
export * from './domain/value-objects/ColorPalette';

/* -------------------------------- entities -------------------------------- */
export * from './domain/entities/Garment';
export * from './domain/entities/Category';
export * from './domain/entities/Outfit';
export * from './domain/entities/UserProfile';
export * from './domain/entities/StyleRule';
export * from './domain/entities/WardrobeCollection';
export * from './domain/entities/CalendarEvent';
export * from './domain/entities/Wardrobe';

/* ----------------------------- repository ports --------------------------- */
export * from './domain/repositories/IGarmentRepository';
export * from './domain/repositories/IOutfitRepository';
export * from './domain/repositories/IUserProfileRepository';
export * from './domain/repositories/IStyleRuleRepository';
export * from './domain/repositories/ICollectionRepository';
export * from './domain/repositories/ICalendarEventRepository';
export * from './domain/repositories/ICategoryRepository';

/* ------------------------------- taxonomy -------------------------------- */
export * from './domain/taxonomy/defaultTaxonomy';

/* ----------------------------- domain services ---------------------------- */
export * from './domain/services/formality';
export * from './domain/services/ColorHarmonyService';
export * from './domain/services/StyleCompatibilityService';
export * from './domain/services/SeasonalRecommendationService';
export * from './domain/services/OccasionMatchingService';
export * from './domain/services/OutfitScoringService';

/* ------------------------------ application bus --------------------------- */
export * from './application/bus/types';
export * from './application/bus/MessageBus';
export * from './application/bus/CommandBus';
export * from './application/bus/QueryBus';
export * from './application/bus/ValidationMiddleware';

/* -------------------------------- commands -------------------------------- */
export * from './application/commands/garmentCommands';
export * from './application/commands/garmentLifecycleCommands';
export * from './application/commands/photoCommands';
export * from './application/commands/taggingCommands';
export * from './application/commands/categoryCommands';
export * from './application/commands/outfitCommands';
export * from './application/commands/profileCommands';
export * from './application/commands/collectionCommands';

/* --------------------------------- queries -------------------------------- */
export * from './application/queries/wardrobeQueries';
export * from './application/queries/garmentSearch';
export * from './application/queries/categoryQueries';
export * from './application/queries/styleQueries';
export * from './application/queries/suggestionQueries';
export * from './application/queries/recommendationQueries';

/* ----------------------- AI orchestration (cognitive engine) -------------- */
export * from './application/orchestration';

/* ------------------------- tagging (AI-assisted) -------------------------- */
export * from './application/tagging/ports';
export * from './application/tagging/BaselineColorExtractor';
export * from './application/tagging/DeferredVisionTagSuggester';

/* ------------------------------ photo pipeline ---------------------------- */
export * from './application/photos/pipeline';

/* ------------------------------- performance ------------------------------ */
export * from './application/performance/pagination';
export * from './application/performance/cacheKeys';
export * from './application/performance/BackgroundJobQueue';

/* ------------------------ event-driven cognitive sync --------------------- */
export * from './domain/events/wardrobeEvents';
export * from './application/sync/ports';
export * from './application/sync/SemanticIndexProjection';
export * from './application/sync/snapshot';
export * from './application/sync/WardrobeSyncCoordinator';
