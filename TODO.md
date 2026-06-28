# M-A-S (Mode AI System) - TODO

> Priority levels: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
> Status: [ ] Not Started, [~] In Progress, [x] Done, [!] Blocked

---

## Phase 1: Project Foundation & Setup

> ✅ Completed 2026-06-28 (Sprint 1). Awaiting approval before Phase 2.

### P0 - Monorepo & Build Configuration
- [x] Initialize pnpm workspace with `pnpm-workspace.yaml`
- [x] Create root `package.json` with workspace scripts
- [x] Set up TypeScript base config (`tsconfig.base.json`)
- [x] Configure path aliases for cross-package imports
- [x] Create `apps/desktop/` Electron + Vite project scaffold
- [x] Create `packages/core/` package scaffold
- [x] Create `packages/infrastructure/` package scaffold
- [x] Create `packages/plugin-sdk/` package scaffold
- [x] Configure Vite for Electron (main, preload, renderer)
- [x] Set up environment variables handling (`.env`, `.env.local`)

### P0 - Code Quality & Standards
- [x] Configure ESLint with TypeScript rules
- [x] Configure Prettier for consistent formatting
- [x] Set up Husky pre-commit hooks
- [x] Configure lint-staged for staged file linting
- [x] Add commitlint for conventional commit messages
- [x] Create `.editorconfig` for editor consistency

### P1 - Testing Infrastructure
- [x] Set up Vitest as test runner
- [x] Configure test coverage reporting
- [x] Set up testing utilities (React Testing Library)
- [x] Create test fixtures and factories
- [x] Configure Playwright for E2E tests (Electron)

### P2 - CI/CD Pipeline
- [x] Create GitHub Actions workflow for PR checks
- [x] Add build verification step
- [x] Add test execution step
- [x] Add lint and type-check steps
- [x] Configure artifact caching for faster builds

---

## Phase 2: Core Domain Package (`packages/core`)

> ✅ Completed 2026-06-29 (Sprint 2). Pure, framework-agnostic domain. Awaiting approval before Phase 3.

### P0 - Domain Entities
- [x] `Garment` entity (id, name, category, subcategory, color, brand, size, season, images, tags, metadata)
- [x] `Outfit` entity (id, name, garments, occasion, season, rating, notes, createdAt)
- [x] `UserProfile` entity (id, name, bodyMeasurements, stylePreferences, colorPalette)
- [x] `StyleRule` entity (id, name, conditions, recommendations, priority)
- [x] `WardrobeCollection` entity (id, name, garments, description)
- [x] `CalendarEvent` entity (id, title, date, occasion, dressCode, suggestedOutfits)
- [x] `Wardrobe` aggregate root (unique garments, no dangling collection references)

### P0 - Value Objects
- [x] `Color` value object (hex, rgb, hsl, name, category, season)
- [x] `Size` value object (system, value, measurements)
- [x] `Season` enum (Spring, Summer, Autumn, Winter, AllSeason)
- [x] `Occasion` enum (Casual, Business, Formal, Sport, Party, Date, etc.)
- [x] `GarmentCategory` enum (Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories)
- [x] `GarmentSubcategory` enums per category
- [x] `BodyMeasurements` value object
- [x] `StylePreference` value object
- [x] `WeatherCondition` value object
- [x] `ColorPalette` value object (primary, secondary, accent, neutral)

### P0 - Repository Interfaces
- [x] `IGarmentRepository` (CRUD + query methods)
- [x] `IOutfitRepository` (CRUD + query methods)
- [x] `IUserProfileRepository`
- [x] `IStyleRuleRepository`
- [x] `ICollectionRepository`
- [x] `ICalendarEventRepository`

### P1 - Domain Services
- [x] `ColorHarmonyService` (complementary, analogous, triadic analysis)
- [x] `StyleCompatibilityService` (garment pairing rules)
- [x] `SeasonalRecommendationService`
- [x] `OccasionMatchingService`
- [x] `OutfitScoringService` (rate outfit combinations 0–100 across ten weighted factors + smart rules)

### P1 - Application Layer (Use Cases / CQRS)
- [x] **Commands**: AddGarment, UpdateGarment, RemoveGarment, CreateOutfit, RateOutfit
- [x] **Commands**: UpdateProfile, SetPreferences, CreateCollection
- [x] **Queries**: GetWardrobe, GetOutfitSuggestions, GetGarmentsByCategory
- [x] **Queries**: GetStyleAnalysis, GetColorPalette, GetSeasonalWardrobe
- [x] Command/Query bus implementation (pure in-memory `MessageBus`/`CommandBus`/`QueryBus`)
- [x] Use case validation middleware

---

## Phase 3: Infrastructure Package (`packages/infrastructure`)

> ✅ Completed 2026-06-30 (Sprint 3). Concrete adapters behind `@mas/core` ports; no business rules. Awaiting approval before Phase 4.

### P0 - Database Layer
- [x] Set up SQLite with better-sqlite3 (connection factory + pragmas: WAL, foreign_keys, synchronous, busy_timeout)
- [x] Configure Drizzle ORM schema definitions (typed source of truth + drizzle-kit config)
- [x] Create migration system (SQL migrations folder + idempotent `MigrationRunner` over the SQL port)
- [x] Implement `GarmentRepository` (SQLite)
- [x] Implement `OutfitRepository` (SQLite)
- [x] Implement `UserProfileRepository` (SQLite)
- [x] Implement `StyleRuleRepository` (SQLite)
- [x] Implement `CollectionRepository` (SQLite)
- [x] Implement `CalendarEventRepository` (SQLite)
- [x] Persistence mappers (row ↔ domain) for every aggregate
- [x] Create database seeding scripts (demo data)

### P0 - Vector Database (infrastructure plumbing only — no recommendation logic)
- [x] Provider-agnostic `IVectorStore` port (upsert / query / delete / count)
- [x] ChromaDB embedded client configuration + adapter (`ChromaVectorStore`)
- [x] Define embedding collection schema for garments
- [x] In-memory vector store (cosine) for offline/test use
- [ ] Implement style embedding generation (deferred — AI engine phase)
- [ ] Create vector indexing pipeline (deferred — higher-level phase)

### P1 - Image Processing
- [ ] Implement Sharp-based image pipeline (deferred — later phase)
- [ ] Background removal service (deferred)
- [ ] Color extraction from garment images (deferred)
- [ ] Image resizing and thumbnail generation (deferred)
- [ ] Image metadata extraction (EXIF) (deferred)
- [ ] Garment category detection preprocessing (deferred)

### P1 - File Storage
- [x] Implement local file storage service (`IFileStorage` + `LocalFileStorage`)
- [x] Image file management (save, retrieve, delete) — `ImageStorageService` (storage I/O only)
- [x] Storage path configuration
- [x] File naming and organization strategy (sharded, sanitised keys)
- [x] Storage cleanup and garbage collection (`pruneOrphans`)

### P1 - AI Provider Abstractions (interfaces + base adapters only)
- [x] Provider-agnostic `IAITextProvider` and `IEmbeddingProvider` ports
- [x] `BaseAIProvider` scaffolding + Ollama/OpenAI/Anthropic adapter stubs (no model calls)
- [x] Deterministic hashing embedding provider (test/offline plumbing)

### P1 - Cross-Cutting Infrastructure Services
- [x] Persistent configuration system (typed `AppConfig` + defaults + validation + `ConfigStore`)
- [x] Logging system (`ILogger` port + structured `ConsoleLogger` + sinks)
- [x] Event system (`IEventBus` + `InMemoryEventBus` pub/sub)
- [x] Backup & restore system (DB + images + config snapshots with manifest)
- [x] Import/export services (portable JSON bundle, optional gzip, via repository ports)
- [x] Infrastructure error hierarchy (distinct from domain errors; I/O/DB/external wrapping)
- [x] UUID-backed `IdGenerator` implementation

### P2 - External Service Adapters
- [ ] Weather API adapter (OpenWeatherMap or similar) (deferred — P2)
- [ ] Calendar sync adapter (Google Calendar, Outlook) (deferred — P2)
- [ ] Cloud storage adapter (optional backup) (deferred — P2)

---

## Phase 4: Desktop Application (`apps/desktop`)

> ✅ Core scope completed 2026-07-01 (Sprint 4). Secure Electron shell, typed IPC → application layer, and the definitive React UI (layout, navigation, design system, theming, global state). NO AI engine, recommendations, avatar or plugins. Awaiting approval before Phase 5.

### P0 - Electron Main Process
- [x] Configure Electron main entry point
- [x] Implement window creation and management
- [x] Set up IPC (Inter-Process Communication) channels
- [~] Implement app lifecycle (startup, shutdown, tray) — startup/shutdown + single-instance done; system tray deferred
- [ ] Configure auto-updater (electron-updater) — deferred (distribution phase)
- [ ] Set up native file dialogs (image import) — deferred; import currently uses an in-renderer file picker
- [ ] Implement deep linking / protocol handler — deferred
- [x] Configure app security (CSP, node integration)

### P0 - Embedded Backend (Fastify)
> Superseded for now by a typed IPC bridge (renderer → IPC → main → CQRS buses); see ADR-009. A Fastify layer remains optional/deferred.
- [ ] Initialize Fastify server in main process
- [ ] Define API route structure
- [ ] Implement garment CRUD endpoints
- [ ] Implement outfit CRUD endpoints
- [ ] Implement user profile endpoints
- [ ] Implement AI recommendation endpoint
- [ ] Implement image upload/processing endpoint
- [ ] Add request validation (Zod schemas)
- [ ] Add error handling middleware
- [ ] Implement WebSocket for real-time updates

### P0 - Frontend Shell (React)
- [x] Set up React 18 with TypeScript
- [x] Configure React Router for navigation
- [x] Set up Zustand store architecture
- [x] Initialize Shadcn/ui component library
- [x] Configure Tailwind CSS with custom theme
- [x] Create app layout (sidebar, header, main content)
- [x] Implement responsive design system
- [x] Set up dark/light theme switching

### P1 - Frontend Pages & Features
- [x] **Dashboard**: Overview, quick actions, recent outfits, rules-based suggestions (weather widget deferred)
- [x] **Wardrobe**: Grid view, filters, search (bulk actions deferred)
- [x] **Categorías**: Category overview with live counts and quick filtering
- [x] **Prendas**: Detailed garment table view
- [x] **Historial**: Outfit history with ratings (sample data; full query deferred)
- [~] **Add Garment**: Modal manual entry via IPC (image upload / auto-categorization deferred)
- [ ] **Outfit Builder**: Drag-and-drop garment combination — deferred
- [ ] **Outfit Suggestions** (dedicated page): surfaced on Dashboard for now — deferred
- [ ] **Virtual Try-On**: 3D avatar — out of scope (Phase 6)
- [x] **Profile/Settings**: Perfil + Configuración (appearance, data, about)
- [x] **Importar / Exportar**: Portable JSON bundle via the IPC transfer channel
- [ ] **Calendar**: Event management, outfit planning — deferred
- [ ] **Analytics**: Wardrobe stats, style insights — deferred
- [ ] **Plugin Manager**: Browse, install, configure plugins — out of scope (Phase 7)

### P1 - State Management (Zustand)
- [x] Wardrobe store (garments, collections, filters)
- [x] Outfit store (outfits, suggestions, history)
- [x] User store (profile, preferences, settings)
- [x] UI store (theme, layout, notifications)
- [x] AI store (model status, generation state) — placeholder only; no engine wired
- [x] Implement store persistence (localStorage)
- [x] Implement optimistic updates (optimistic garment removal; reconciled over IPC)

### P2 - UI Components (Shadcn/ui + Custom)
- [x] GarmentCard component (thumbnail, info, actions, context menu)
- [ ] OutfitPreview component (layered garment display) — deferred
- [x] ColorSwatch component (ColorDot + color picker in the add-garment form)
- [ ] ImageUploader component (drag-drop, crop, preview) — deferred (needs Sharp pipeline)
- [x] FilterPanel (wardrobe filter/sort toolbar)
- [ ] TagInput component (autocomplete, create new) — deferred
- [ ] WeatherWidget component — deferred
- [x] NotificationToast component (store-driven Toaster)
- [x] LoadingSkeleton components
- [x] EmptyState components

---

## Phase 5: AI Engine Integration

> ✅ Completed 2026-07-02 (Sprint 5). Provider-agnostic cognitive AI Orchestrator in `@mas/core` (intelligence = M-A-S; models = interchangeable providers); graceful offline degradation; persistent preference memory; no business rule in any provider. Awaiting approval before Phase 6.

### P0 - LangChain.js Setup
- [x] Configure LangChain.js with multiple providers (lazy `@langchain/*` adapters behind ports — ADR-014)
- [x] Implement model abstraction layer (core `ITextProvider`/`IEmbedder`/`IVectorIndex` ports + AI Provider Router)
- [x] Create prompt templates for fashion analysis (Explanation Generator — provider only rephrases domain-decided facts)
- [x] Implement output parsers for structured responses (deterministic, rule-based context extraction; provider output is free-text only)
- [~] Set up conversation memory for context (persistent **preference** memory implemented; chat/conversation memory deferred)

### P0 - Ollama Integration (Local AI)
- [~] Detect Ollama installation and available models (LangChain `ChatOllama` adapter + availability check; live detection UI deferred)
- [ ] Implement model download/management UI (deferred — settings/UX phase)
- [x] Create local inference service (`LangChainTextProvider`/`LangChainEmbeddingProvider` for Ollama, lazy-loaded; `StaticTextProvider` offline default)
- [ ] Implement streaming responses (deferred — not needed for the recommendation flow yet)
- [ ] Handle model loading/unloading for memory management (deferred — runtime/ops concern)

### P1 - Cloud AI Integration
- [x] OpenAI API connector (LangChain `ChatOpenAI`/`OpenAIEmbeddings` adapter behind the port)
- [x] Anthropic API connector (LangChain `ChatAnthropic` adapter behind the port)
- [~] API key management and secure storage (config carries provider/model; key handling wired via config, secure OS keystore deferred)
- [ ] Rate limiting and cost tracking (deferred — ops/observability phase)
- [x] Fallback chain (local -> cloud) (AI Provider Router: priority-ordered availability with offline → rules-only fallback)

### P1 - AI Pipelines
- [~] Garment analysis pipeline (image -> attributes) (text/attribute embeddings via Embedding Manager; image analysis deferred — needs Sharp/vision)
- [x] Style recommendation chain (profile + wardrobe -> outfits) — the full 10-step Orchestrator pipeline
- [x] Color harmony analysis chain (domain `ColorHarmonyService` via `OutfitScoringService`)
- [x] Occasion-appropriate outfit chain (Context Analyzer + `OccasionMatchingService` + ranking)
- [~] Natural language wardrobe search (free-text request interpreted by the Context Analyzer; dedicated search UI deferred)
- [ ] Style transfer suggestions ("Dress like [celebrity/style]") (deferred)

### P2 - AI Features
- [x] Outfit explanation (why this combination works) — Explanation Generator (template offline, provider-enhanced online)
- [ ] Shopping recommendations (wardrobe gaps) (deferred)
- [ ] Trend analysis and suggestions (deferred)
- [~] Personal style evolution tracking (persistent preference memory with accept/reject learning; analytics view deferred)
- [ ] Conversational style assistant (chat interface) (deferred)

---

## Phase 6: Virtual Try-On (Three.js)

> ✅ Completed 2026-07-03 (Sprint 6). Engine-agnostic visualisation core in the new `@mas/rendering` package (ten managers + abstraction, no Three.js/React/AI import) with a swappable Three.js/React-Three-Fiber adapter in `apps/desktop`. Driven by the REAL garments of the recommended outfit; decoupled from the AI engine; no business rules in the renderer; fully replaceable graphics engine. Awaiting approval before Phase 7.

### P1 - 3D Avatar System
- [x] Set up React Three Fiber renderer (Three.js/R3F adapter over `@mas/rendering`; WebGL render runtime/CI-deferred)
- [x] Create parametric body model (primitive-based mannequin via the pure `Avatar Manager` + `primitives.ts`; GLTF base model is a data-only extension point)
- [~] Implement body measurement customization (body-type switching — neutral/feminine/masculine/athletic/plus — done; precise measurement-driven morphs deferred)
- [~] Add pose presets (standing, walking, sitting) (pose is a data-only extension point on the `AvatarDescriptor`; animated poses deferred)
- [x] Implement camera controls (orbit, zoom) (`Camera Controller`: 360° orbit, clamped zoom, front/back/side view presets)

### P1 - Garment Rendering
- [x] 2D garment overlay on 3D model (per-garment primitive layers placed by body region over the avatar)
- [x] Garment positioning and scaling (region-based geometry, scales with avatar)
- [x] Layer ordering (underwear -> outer) (`Outfit Renderer` draw-order: full-body → lower → upper → feet → outer → accessory; full-body suppresses separates)
- [x] Color/texture mapping (`Texture Manager`: garment colour → material, subcategory/tags → finish/roughness/metalness; sRGB→linear)
- [ ] Basic physics simulation (draping) (deferred — needs cloth sim)

### P2 - Advanced Features
- [x] Multiple angle views (front/back/left/right/three-quarter presets)
- [x] Screenshot/export functionality (`Screenshot Manager` + canvas read-back; downloads a timestamped PNG/JPEG)
- [~] Animation (turntable rotation) (manual 360° rotation done; auto-turntable animation deferred)
- [x] Light/shadow for realism (`Lighting Manager` studio/soft/dramatic presets with shadow-casting key lights; contact shadow in the adapter)
- [ ] AR preview (future - mobile companion) (deferred)

### Supporting work (Phase 6)
- [x] New `@mas/rendering` workspace package (pure, engine-agnostic; wired into tsconfig paths, project references and the Vitest workspace)
- [x] `IRenderEngine`/`IScreenshotSink` ports + `SceneDescription` as the replaceable-engine seam (ADR-015)
- [x] `Render Cache` (order-independent keying, LRU eviction, per-outfit invalidation on recommendation change)
- [x] `recommendationStore` (Zustand) + DTO→renderable mapper wiring the existing `ai:recommend` IPC flow into the **Probador** screen (`/try-on`)
- [x] Offline tests (99 new) + transpile validation of the CI/runtime-deferred R3F adapter

---

## Phase 6.5: Smart Wardrobe Management

> ✅ Completed 2026-07-04 (Sprint 7). Approved roadmap extension (does NOT replace Phase 7). Fully dynamic, user-defined categories (no hardcoded categories), full garment + photo + metadata management, AI-assisted tagging (confirmation-gated), and automatic event-driven cognitive sync. Monorepo offline total 314 → 368 passed / 0 failed, no regressions. Awaiting approval before Phase 7.

### P0 - Module 1: Dynamic categories (enum → data migration, ADR-017)
- [x] `Category` aggregate (id, name, slug, parentId for unlimited subcategories, group, order, `CategoryMetadata`)
- [x] `CategoryMetadata` value object (layer slot, formality, comfort, heavy-outerwear, extensible attributes)
- [x] `ICategoryRepository` port + in-memory implementations (core test support + desktop)
- [x] `buildDefaultTaxonomy` seed/migration reproducing the prior built-in taxonomy as editable data
- [x] Repoint pure services to garment metadata getters (zero scoring change; 91 prior core tests green)
- [x] CQRS use cases: Create / Update (rename/regroup/move) / Reorder / Delete / SeedDefaultTaxonomy + GetCategories / GetCategoryTree

### P0 - Module 2: Garment lifecycle
- [x] Duplicate / Archive / Restore use cases (create/edit/delete already existed) — stable persistent id
- [x] Pure search / filter / sort + pagination (`searchGarments`, `SearchGarmentsQuery`)

### P0 - Module 3: Photographs
- [x] `Photograph` value object with non-destructive transforms (rotation, crop, order, primary, stage)
- [x] Add / Remove / Reorder / Transform / Set-primary use cases
- [x] `PhotoProcessingPipeline` + `IBackgroundRemover`/`IGarmentSegmenter`/`IImageEnhancer` ports as no-op stages (architecture only, ADR-018)

### P0 - Module 4: Smart metadata
- [x] Secondary colours, material, purchase date, notes + extensible `attributes` bag (formality from category metadata)

### P0 - Module 5: AI-assisted tagging (never auto-applied, ADR-020)
- [x] `IGarmentTagSuggester` port + `Suggestion`/`GarmentTagSuggestion` types
- [x] `SuggestGarmentTagsQuery` (returns only) + `ConfirmGarmentTagsCommand` (applies only approved subset)
- [x] `DeferredVisionTagSuggester` (vision deferred) + offline `BaselineColorExtractor`

### P0 - Module 6: Event-driven cognitive sync (ADR-019)
- [x] Wardrobe domain events + `IDomainEventPublisher`/`IDomainEventSubscriber` ports (IEventBus-compatible)
- [x] `WardrobeSyncCoordinator` fanning out to inventory / semantic index + embeddings / cache / history / preference memory
- [x] Use cases publish events; `AppContainer` wires the coordinator + seeds the taxonomy at startup

### P1 - Module 7: UX (pure logic + dynamic categories page)
- [x] Multi-select (incl. shift-range), select-all, bulk-action availability, management sort, status indicators
- [x] Dynamic categories logic (tree, group, drag-reorder, name validation, delete guard) + `CategoriesPage` manager
- [ ] Full media-grade grid/list with drag-and-drop upload, zoom/crop editor, side properties panel, quick view (React presentation — CI/runtime-deferred)

### P1 - Module 8: Performance
- [x] Pagination + list/grid virtualization windowing
- [x] Thumbnail cache keys + bounded `LruCache`
- [x] Bounded-concurrency `BackgroundJobQueue`

### P0 - Module 9: Architecture
- [x] New IPC channels + contract + DTOs + handlers + preload + client for categories/lifecycle/photos/tagging/search (React → IPC → Application → Domain → Infrastructure preserved)

### P0 - Module 10: Quality
- [x] 54 new offline tests; no regressions (314 → 368 passed / 0 failed)
- [x] PROJECT_PROGRESS.md, TODO.md, CHANGELOG.md updated; ADR-017…020 recorded
- [x] `SqlCategoryRepository` + schema migration for category/photo/metadata columns (delivered in Phase 7 Part A — ADR-021/023)
- [ ] Full `tsc` + `electron-vite` build + RTL component tests (CI/runtime-deferred)

---

## Phase 7 (Part A + B): Wardrobe Persistence & Intelligent Outfit History

> ✅ Completed 2026-07-05 (Sprint 8). Definitive SQL persistence for the dynamic wardrobe + the intelligent outfit history. Monorepo offline total 368 → 394 passed / 0 failed, no regressions. The plugin system (Parts C/D/E) is a separate later delegation and was NOT started. Awaiting approval.

### P0 - Part A: Definitive wardrobe persistence
- [x] Migration `0001_wardrobe_persistence.sql` (tracked + idempotent): dynamic categories, unlimited subcategories (self-referential `parent_id`), garment photographs, extended metadata, garment↔photo relation, modification/audit history, basic versioning
- [x] Extend the Drizzle `schema.ts` to match (categories, photographs, garment_history, outfit_history, extended garments)
- [x] `SqlCategoryRepository` (implements `ICategoryRepository`: CRUD, slug lookup, root/children trees, reorder, cascade delete)
- [x] `SqlGarmentRepository` rewritten: extended metadata + 1:N photographs + per-save versioning + `garment_history` audit trail (mappers: `categoryMapper`, `photographMapper`, extended `garmentMapper`)
- [x] Existing data migrates automatically; default taxonomy seeded as editable rows on first run (idempotent); demo seeded only on an empty store
- [x] `AppContainer` wired to the SQL repositories as the real backing via a swappable `Persistence` port (`persistence.ts`); in-memory retained for tests; opens + migrates `userData/mas.db` in production
- [x] Offline verification: create/edit/delete category, subcategories, add photographs, edit metadata, versioning/audit, **restart-persistence simulation** (reopen DB, data survives)

### P0 - Part B: Intelligent outfit history
- [x] `OutfitHistoryEntry` domain entity (outfit + date/time/place/event/occasion/weather/temperature/free-text role/comments/satisfaction + extension bag) + `IOutfitHistoryRepository` port (SQL + in-memory)
- [x] Every ACCEPTED recommendation auto-recorded via the unified `RecordOutfitFeedbackCommand` (also feeds the Phase 5 preference Memory Engine); `RecordOutfitUsage`, `RepeatOutfit`, `AnnotateOutfitHistory`
- [x] Pure `OutfitHistoryService`: search, filter, sort, pagination, usage statistics, recent-repetition detection
- [x] Persisted history feeds the cognitive engine — `HistoryAnalyzer` consumes it as a freshness/recent-repetition source (reuses the canonical signature; no duplicated rule)
- [x] Exposed via CQRS queries (`SearchOutfitHistory`, `GetOutfitHistoryStatistics`, `GetRecentRepetitions`, `GetGarmentUsageHistory`) + `history:*` IPC channels (contract + DTOs + handlers + preload)
- [x] Offline tests for history CRUD, auto-record on acceptance, search/filter/sort, repeat, recent-repetition, statistics, and that persisted history affects freshness
- [ ] Full `tsc` + `electron-vite` build + a light History-screen UI hook-up + RTL component tests (CI/runtime-deferred)

---

## Phase 7 (Part C/D/E): Plugin System (`packages/plugin-sdk`)

> ✅ Completed 2026-07-06 (Sprint 9). The definitive `@mas/plugin-sdk` (pure host kernel) + Extension API + security, with a desktop `PluginHost` bridge. Monorepo offline total 394 → 445 passed / 0 failed, no regressions. Phase 7 is now FULLY complete (A+B+C+D+E+F+G). Awaiting approval before Phase 8.

### P1 - Plugin SDK
- [x] Define plugin manifest schema (id, name, version, schema version, engine ranges, permissions, contributes) + total validator
- [x] Create plugin API surface (capability-gated `HostApi`: wardrobe read, recommendations, plugin storage, log, `register`)
- [x] Implement plugin lifecycle hooks (`PluginModule.activate`/`deactivate` + `PluginContext`)
- [x] Create TypeScript types for plugin developers (the stable `contracts/` surface)
- [ ] Build plugin development CLI tool (deferred — tooling/ecosystem, out of scope this phase)

### P1 - Plugin Runtime
- [x] Implement Worker Thread sandbox (`IPluginSandbox` port + offline `InProcessPluginSandbox`; `WorkerThreadPluginSandbox` adapter CI/runtime-deferred, ADR-026)
- [x] Create message passing protocol (main ↔ plugin) — host-API RPC bridge + contribution-invoke proxy in the worker adapter (runtime-deferred)
- [x] Implement permission system (capability vocabulary, `PermissionGuard` enforced on every API call + contribution registration, ADR-028)
- [x] Add resource limits (CPU/time via per-call timeout, invocation quota, memory ceiling via `ResourceMeter`/Worker `resourceLimits`)
- [x] Implement plugin state persistence (plugin-scoped key/value storage via the `storage:plugin` capability + `InMemoryPluginStorageProvider`)

### Plugin versioning, compatibility & security (Parts C/E)
- [x] Plugin versioning + host/SDK compatibility validation (semver parser/range + `CompatibilityChecker` against declared `engines.mas`/`engines.sdk`)
- [x] Plugin signing + verification (Ed25519 over canonical package bytes; Verified/Unsigned/Invalid/Untrusted + policy; tamper detection)
- [x] Safe error handling (faulting plugin contained → `Failed`, contributions withdrawn, host stays healthy)
- [x] Activity logging / audit trail (`ActivityLog` → `PluginActivityLogger`, infra `ILogger`-compatible)

### P1 - Extension API (Part D — extend WITHOUT modifying the core)
- [x] AI providers + embedders (→ Phase-5 `ITextProvider`/`IEmbedder` via `AIProviderRouter`)
- [x] Rendering engines (→ Phase-6 `IRenderEngine` seam)
- [x] Analyzers, importers, exporters, image formats
- [x] Recommendation rules (DECLARATIVE weights → additive `affinityBias` the core evaluates; no business rule in the plugin)
- [x] UI panels (renderer extension-point contract — metadata)
- [x] New garment types + new category types (leveraging Phase-6.5 dynamic categories)

### P2 - Plugin Ecosystem
- [x] Create plugin template/boilerplate (the `createInProcessSource` helper + the sample plugin serve as the reference template)
- [ ] Build plugin marketplace UI (local directory) — out of scope (later)
- [~] Write sample plugins:
  - [x] Color palette generator plugin (Color Palette Studio — analyzer + declarative rule + importer + UI panel, exercised end-to-end)
  - [ ] Instagram style import plugin (deferred)
  - [ ] Laundry tracker plugin (deferred)
  - [ ] Packing list generator plugin (deferred)
- [ ] Plugin documentation and developer guide (deferred — docs phase)
- [ ] Renderer Plugin Manager screen + plugin-management IPC channels (CI/runtime-deferred)

---

## Phase 8: Polish, Testing & Distribution

### P1 - Testing
- [ ] Unit tests for domain entities and services (>80% coverage)
- [ ] Unit tests for infrastructure repositories
- [ ] Integration tests for API endpoints
- [ ] Integration tests for AI pipelines (mocked)
- [ ] E2E tests for critical user flows (Playwright)
- [ ] Visual regression tests for UI components
- [ ] Performance benchmarks

### P1 - Performance
- [ ] Implement lazy loading for images
- [ ] Add virtualized lists for large wardrobes
- [ ] Optimize SQLite queries with indices
- [ ] Implement service worker for caching
- [ ] Profile and optimize memory usage
- [ ] Reduce Electron bundle size

### P2 - Accessibility & i18n
- [ ] WCAG 2.1 AA compliance audit
- [ ] Keyboard navigation support
- [ ] Screen reader announcements
- [ ] High contrast theme
- [ ] i18n setup (English, Spanish initially)
- [ ] RTL language support preparation

### P2 - Distribution
- [ ] Configure electron-builder for Windows
- [ ] Create NSIS installer
- [ ] Implement auto-update (electron-updater + GitHub Releases)
- [ ] Code signing certificate setup
- [ ] Create portable version (no install)
- [ ] Write installation documentation

### P3 - Documentation
- [ ] API documentation (internal Fastify routes)
- [ ] Plugin SDK developer guide
- [ ] User manual / help system
- [ ] Architecture documentation (C4 diagrams)
- [ ] Contributing guide

---

## Backlog (Future Considerations)

- [ ] Mobile companion app (React Native)
- [ ] Cloud sync between devices
- [ ] Social features (share outfits, get feedback)
- [ ] Integration with e-commerce (shopping links)
- [ ] Sustainability scoring (ethical fashion)
- [ ] Garment care reminders (washing, dry cleaning)
- [ ] Seasonal wardrobe rotation reminders
- [x] Outfit history and repeat detection (delivered in Phase 7 Part B)
- [ ] Multi-user support (family wardrobes)
- [ ] Voice assistant integration

---

*Last updated: 2026-07-06*
