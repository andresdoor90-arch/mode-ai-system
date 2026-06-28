# M-A-S (Mode AI System) - Project Progress

## Project Overview

**M-A-S** is a professional Windows desktop application for AI-powered fashion and outfit recommendations. It combines local AI processing with optional cloud AI services to provide personalized styling advice, wardrobe management, and virtual try-on capabilities.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Desktop Framework | Electron + Vite |
| Frontend | React 18 + Zustand + Shadcn/ui + Tailwind CSS |
| Backend (embedded) | Fastify |
| AI Engine | LangChain.js + Ollama (local) + OpenAI/Anthropic (cloud) |
| Database | SQLite (better-sqlite3) + ChromaDB (vectors) |
| ORM | Drizzle ORM |
| Image Processing | Sharp |
| Avatar Rendering | Three.js + React Three Fiber |
| Architecture | Clean Architecture + CQRS lite |
| Plugin System | Sandboxed with Worker Threads |
| Monorepo | apps/desktop + packages/ (core, infrastructure, rendering, plugin-sdk) |

## Current Status

| Module | Status | Progress | Notes |
|--------|--------|----------|-------|
| Project Setup & Configuration | Complete | 100% | Monorepo, tooling, testing, CI/CD scaffolded (Phase 1) |
| Core Package (Domain Layer) | Complete | 100% | Entities, value objects, repository ports, domain services, CQRS use cases — pure & framework-agnostic (Phase 2) |
| Infrastructure Package | Complete | 100% | SQLite/Drizzle repositories, migrations, ChromaDB + in-memory vector store, file/image storage, AI provider ports, config, logging, events, backup/restore, import/export, error hierarchy (Phase 3) |
| Desktop App - Electron Shell | Complete | 100% | Secure main process (context isolation, sandbox, strict CSP, navigation guards), window manager, single-instance, typed IPC wired to the `@mas/core` application layer (Phase 4) |
| Desktop App - Frontend UI | Complete | 100% | React 18 + Router + Zustand + Tailwind/Shadcn-style design system; definitive layout (sidebar/header/breadcrumbs), 9 screens, dark/light theming (Phase 4) |
| Embedded Backend (Fastify) | Superseded | n/a | Phase 4 connects the renderer to use cases via a typed IPC bridge (renderer → IPC → main → CQRS buses) instead of an in-process HTTP server; a Fastify layer remains optional/deferred (see ADR-009) |
| AI Engine Integration | Complete | 100% | Provider-agnostic cognitive AI Orchestrator in `@mas/core` (Context Analyzer, Preference/Memory/History/Inventory analyzers, Candidate Generator, Ranking Engine, Explanation Generator, Provider Router, Embedding Manager); infra adapters (Static/LangChain providers, persistent preference-memory stores); graceful offline degradation, no business rule in any provider (Phase 5) |
| Wardrobe Management | Not Started | 0% | CRUD, categorization, image storage |
| Outfit Recommendation Engine | Complete | 100% | Full 10-step recommendation pipeline producing Principal / Más elegante / Más cómoda with explanations, built on the domain `OutfitScoringService` (0–100, 10 factors + smart rules); AI enrichment strictly additive (Phase 5) |
| Rendering Layer (`@mas/rendering`) | Complete | 100% | Engine-agnostic virtual try-on core (Phase 6): Avatar/Clothing/Outfit/Camera/Lighting/Asset/Texture/Scene/Screenshot managers + Render Cache as pure TypeScript (no Three.js/React/DOM); a `SceneDescription` is the swappable-engine seam (`IRenderEngine`) |
| Virtual Try-On / Avatar | Complete | 100% | Visualises the recommended outfit on a fictional parametric avatar via a Three.js/React-Three-Fiber adapter over `@mas/rendering`; 360° rotation, zoom, front/back/side presets, screenshots, automatic garment swap, consistent representation; decoupled from the AI engine (consumes only structured garment data) — Phase 6. WebGL render is runtime/CI-deferred |
| Plugin SDK | Not Started | 0% | API surface, sandboxing, lifecycle |
| Image Processing Pipeline | In Progress | 20% | Storage I/O + metadata wiring done (Phase 3); Sharp processing (resize, bg removal, colour extraction) deferred |
| User Profile & Preferences | In Progress | 40% | Style profile + persistent preference-memory learning (accept/reject) wired via the AI engine (Phase 5); body measurements / full profile UI deferred |
| Calendar & Events Integration | Not Started | 0% | Event-based outfit suggestions |
| Weather Integration | Not Started | 0% | Weather-aware recommendations |
| Analytics & Insights | Not Started | 0% | Usage patterns, style trends |
| Testing & QA | Not Started | 0% | Unit, integration, E2E tests |
| Build & Distribution | Not Started | 0% | Packaging, auto-update, installer |

## Architecture Decisions

### ADR-001: Monorepo Structure
- **Decision**: Use a monorepo with `apps/desktop` and `packages/` (core, infrastructure, plugin-sdk)
- **Rationale**: Shared types, easier refactoring, unified CI/CD
- **Status**: Approved

### ADR-002: Clean Architecture + CQRS Lite
- **Decision**: Separate domain, application, infrastructure layers with command/query separation
- **Rationale**: Testability, maintainability, clear boundaries
- **Status**: Approved

### ADR-003: Local-First AI with Cloud Fallback
- **Decision**: Use Ollama for local AI inference, with OpenAI/Anthropic as optional cloud providers
- **Rationale**: Privacy, offline capability, user control
- **Status**: Approved

### ADR-004: SQLite + ChromaDB for Storage
- **Decision**: SQLite for structured data, ChromaDB for vector embeddings
- **Rationale**: No server dependency, embedded operation, fast vector search
- **Status**: Approved

### ADR-005: Plugin Sandboxing via Worker Threads
- **Decision**: Run plugins in isolated Worker Threads with a defined API surface
- **Rationale**: Security, stability, prevent plugins from crashing main app
- **Status**: Approved

### ADR-006: electron-vite as the Build Orchestrator
- **Decision**: Use `electron-vite` to drive the three Electron build targets (main, preload, renderer) from a single config, with Vite + `@vitejs/plugin-react` for the renderer
- **Rationale**: Unified config, fast HMR for the renderer, sensible defaults for context isolation and dependency externalization
- **Status**: Approved

### ADR-007: pnpm Workspaces + TypeScript Project References
- **Decision**: Manage the monorepo with pnpm workspaces and wire cross-package builds via TypeScript project references and `@mas/*` path aliases
- **Rationale**: Incremental builds, enforced layer boundaries (core → infrastructure/plugin-sdk → desktop), and `workspace:*` linking without publishing
- **Status**: Approved

### ADR-008: SQL Port + Adapters (driver-agnostic persistence)
- **Decision**: Repositories and the migration runner depend on a small synchronous `SqlDatabase` port, not on a concrete SQLite driver. `better-sqlite3` is the production adapter; a `bun:sqlite` adapter backs offline tests. Drizzle ORM provides the typed schema and generates SQL migrations, which are applied at runtime through the same port.
- **Rationale**: Keeps the storage engine swappable, lets the persistence layer be exercised end-to-end against a real SQLite engine even when the native `better-sqlite3` module cannot be installed (offline sandbox), and isolates the only uninstallable/native imports behind lazy factory functions so the rest of the layer builds anywhere.
- **Status**: Approved

### ADR-009: Typed IPC bridge over an embedded HTTP backend
- **Decision**: The renderer talks to the main process through a single, strongly-typed IPC contract (shared channel map + DTOs + a `Result`-style response envelope), exposed via a minimal `contextBridge` API. Main-process IPC handlers delegate to the `@mas/core` Command/Query buses; the React layer never imports `@mas/infrastructure`, the domain classes, or touches the database/filesystem directly. The originally-envisaged embedded Fastify server is deferred (it adds an HTTP hop, a port and CORS/security surface that a local desktop app does not need today).
- **Rationale**: Smaller attack surface (no open socket), end-to-end type safety across the boundary, structured error propagation, and a strict one-way dependency (renderer → IPC → application layer → infrastructure). A Fastify layer can still be added later for plugins or a companion app without changing the renderer.
- **Status**: Approved

### ADR-010: Token-based design system (Tailwind + Shadcn-style primitives)
- **Decision**: Build the UI on a token-driven Tailwind theme (HSL CSS variables for light/dark, mapped to semantic colour roles) with reusable, accessible primitives composed over Radix UI (Dialog, Dropdown, Tabs, Tooltip, Toast, Context menu, Avatar, Label) plus custom Button/Input/Card/Table/Badge/Skeleton — the Shadcn/ui approach. Components reference only semantic tokens, never raw colours.
- **Rationale**: One place to retint or re-theme the whole app, consistent spacing/typography, dark mode via a single class, and accessible behaviour for free from Radix. This is the definitive visual base for the project.
- **Status**: Approved

### ADR-011: AI Orchestrator lives in the domain/application layer (`@mas/core`)
- **Decision**: The AI Orchestrator and ALL its cognitive components (Context Analyzer, Preference/Memory/History/Inventory analyzers, Outfit Candidate Generator, Outfit Ranking Engine, Explanation Generator, AI Provider Router, Embedding Manager) are M-A-S intelligence and live in `@mas/core`, depending only on the domain services + abstract ports declared in `orchestration/ports.ts`. AI models are reached only through those ports; concrete provider/store adapters live in `@mas/infrastructure`. The ports are intentionally *structurally compatible* with the existing `IAITextProvider`/`IEmbeddingProvider`/`IVectorStore` contracts, so no wrapper is needed and the dependency arrow keeps pointing inward (infrastructure → core, never the reverse).
- **Rationale**: Enforces the core mandate — "all intelligence belongs to M-A-S; AI models are merely interchangeable providers." Swapping, adding or removing a provider never touches the domain or the orchestrator. Declaring the ports in core (rather than importing infrastructure) preserves Clean Architecture layering.
- **Status**: Approved

### ADR-012: Mandatory graceful degradation; AI enrichment is strictly additive
- **Decision**: When NO provider is available/configured, the orchestrator still produces the three recommendations using ONLY the domain rules + `OutfitScoringService`. A provider can only ADD value: a semantic ranking boost (capped, additive points that re-order already-valid outfits) and natural-language explanations (the model rephrases reasons the domain already decided). No hard smart-rule may be relaxed, no disqualified outfit revived, and no business rule may move into a provider. Provider failures fall back to the offline template.
- **Rationale**: Correctness must never depend on a model being present or reachable (privacy, offline use, reliability). Keeping enrichment additive makes the engine deterministic and testable offline, and guarantees a model can never produce an outfit that breaks a domain rule.
- **Status**: Approved

### ADR-013: Persistent preference memory behind a port
- **Decision**: The Memory Engine's learning logic is pure and lives in `@mas/core`; durability is delegated to an `IPreferenceMemoryStore` port. `@mas/infrastructure` provides `InMemoryPreferenceMemoryStore` (volatile/tests) and `FilePreferenceMemoryStore` (durable JSON), wired by the desktop composition root at `userData/ai/preference-memory.json`. Accept/reject feedback nudges per-colour and per-subcategory affinities that later bias ranking.
- **Rationale**: The system genuinely improves over time while keeping the learning algorithm pure, deterministic and unit-testable, and the storage technology swappable without touching the engine.
- **Status**: Approved

### ADR-014: Provider integration via lazy LangChain adapters (offline-safe)
- **Decision**: Real provider integrations (OpenAI/Anthropic/Ollama) are implemented as LangChain.js adapters in `@mas/infrastructure`, with every SDK imported **lazily** through a dynamic `import()` inside a factory, behind the existing ports. Pinned versions: `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/ollama`.
- **Rationale**: Lets the engine ship correct, realistic provider code while remaining fully type-checkable and runnable OFFLINE (the `INTEGRATIONS_ONLY` sandbox cannot install these packages). Nothing is evaluated unless a real provider is requested, so installation, type resolution and any model call are cleanly CI-deferred without affecting the rest of the system.
- **Status**: Approved

### ADR-015: Engine-agnostic rendering seam (`@mas/rendering`) with a Three.js adapter
- **Decision**: All virtual try-on logic lives in a new pure package `@mas/rendering` — the Avatar, Clothing, Outfit, Camera, Lighting, Asset, Texture, Scene and Screenshot managers plus the Render Cache — expressed entirely as plain data + interfaces (a `SceneDescription` snapshot, `CameraState`, `MaterialDescriptor`, `ClothingLayer`, `AvatarDescriptor`, view presets) with **no Three.js, React, DOM, Electron, domain or AI import**. A graphics engine implements the single `IRenderEngine` port; the concrete Three.js / React-Three-Fiber adapter lives in `apps/desktop/src/renderer/src/rendering/three`. The renderer consumes only structured garment data (a `RenderableOutfit`), never the AI orchestrator, providers or domain entity classes.
- **Rationale**: Satisfies the mandate that the visual representation be fully replaceable without touching the domain, and that rendering stay decoupled from the AI engine. Because the abstraction has zero engine dependencies it is fully type-checkable AND unit-testable OFFLINE (garment→layer placement, camera/zoom/view-preset maths, render-cache keying & invalidation, screenshot plumbing via fakes), while the actual WebGL render is isolated in the adapter and deferred to CI/runtime. Swapping R3F for another engine means rewriting only the `three/` folder.
- **Status**: Approved

### ADR-016: Parametric avatar + pure primitive derivation (offline-testable adapter)
- **Decision**: The fictional character is a parametric mannequin assembled from geometric primitives (no external model file). The mapping from `SceneDescription` to primitive descriptors (avatar body parts, per-garment geometry by body region, sRGB→linear material props) is a **pure** module (`rendering/primitives.ts`) with no Three.js import; the R3F components are thin declarative wrappers that instantiate `<mesh>`/`<meshStandardMaterial>` from those descriptors. The base avatar, body type, pose and accessory attachment points are encoded as data-only extension points.
- **Rationale**: Pushes as much of the adapter as possible into pure, offline-tested code (placement maths, body-type silhouette, material mapping), leaving only the `<Canvas>`/WebGL render runtime-deferred. It also makes future enhancements — swapping the base model for a GLTF mesh, adding body types or accessories, improving materials/textures — local, data-driven changes that never reach the domain.
- **Status**: Approved

### Milestone 1: Foundation (Project Setup) ✅ Complete
- [x] Initialize monorepo with workspace configuration
- [x] Set up TypeScript configuration (base + per-package)
- [x] Configure Electron + Vite build pipeline
- [x] Set up ESLint, Prettier, Husky
- [x] Initialize package structure (core, infrastructure, plugin-sdk)
- [x] Configure testing framework (Vitest)
- [x] Set up CI/CD pipeline

### Milestone 2: Core Domain ✅ Complete
- [x] Define domain entities (Garment, Outfit, UserProfile, etc.)
- [x] Implement value objects (Color, Size, Season, Occasion)
- [x] Define repository interfaces
- [x] Implement domain services
- [x] Define application use cases (commands/queries)

### Milestone 3: Infrastructure & Data ✅ Complete
- [x] Implement SQLite database with Drizzle ORM (schema + migrations; repositories use a SQL port)
- [x] Set up ChromaDB for vector storage (adapter + in-memory store behind a provider-agnostic port)
- [x] Implement repository implementations (all six domain repository ports, with row↔domain mappers)
- [~] Build image processing pipeline with Sharp (storage I/O + metadata wiring done; Sharp processing deferred to a later phase)
- [x] Implement file storage service

### Milestone 4: Desktop Application Shell
- [x] Configure Electron main process
- [x] Implement window management
- [x] Set up IPC communication
- [x] Build React app with routing
- [x] Implement Zustand state management
- [x] Create Shadcn/ui component library setup
- [x] Implement Tailwind CSS theming

### Milestone 5: AI Engine ✅ Complete
- [x] Integrate LangChain.js (lazy provider adapters: OpenAI/Anthropic/Ollama behind ports — ADR-014)
- [x] Set up Ollama local inference (LangChain `ChatOllama`/`OllamaEmbeddings` adapter; CI-deferred install)
- [x] Implement OpenAI/Anthropic cloud connectors (LangChain adapters behind the AI Provider Router)
- [x] Build outfit recommendation chain (the AI Orchestrator's 10-step pipeline → 3 explained recommendations)
- [x] Implement style analysis pipeline (Context Analyzer + Inventory/History/Preference analyzers)
- [x] Create color harmony analyzer (reused from the domain `ColorHarmonyService` via `OutfitScoringService`)

### Milestone 6: Core Features
- [ ] Wardrobe management (add, edit, categorize garments)
- [ ] Outfit generation and recommendation
- [x] Virtual try-on with Three.js avatar (Phase 6 — engine-agnostic `@mas/rendering` core + Three.js/R3F adapter; visualises the recommended outfit, 360° rotation, zoom, view presets, screenshots, automatic swap)
- [ ] User profile and style preferences
- [ ] Calendar and event integration
- [ ] Weather-aware recommendations

### Milestone 7: Plugin System
- [ ] Define Plugin SDK API
- [ ] Implement plugin loader and lifecycle
- [ ] Build Worker Thread sandbox
- [ ] Create plugin marketplace UI
- [ ] Write sample plugins

### Milestone 8: Polish & Distribution
- [ ] Performance optimization
- [ ] Accessibility (a11y) audit
- [ ] Internationalization (i18n)
- [ ] Auto-update mechanism
- [ ] Windows installer (NSIS/MSI)
- [ ] Documentation

## Sprint Log

### Sprint 0 - Project Initialization
- **Start Date**: 2025-01-20
- **Goal**: Set up project management and documentation structure
- **Status**: Done
- **Completed**:
  - Created PROJECT_PROGRESS.md
  - Created TODO.md
  - Created CHANGELOG.md

### Sprint 1 - Phase 1: Project Foundation & Setup
- **Start Date**: 2026-06-28
- **Goal**: Scaffold the monorepo foundation — build configuration, code quality tooling, testing infrastructure and CI/CD pipeline
- **Status**: Done (awaiting user approval before Phase 2)
- **Completed**:
  - **Monorepo & build config**: `pnpm-workspace.yaml`, root `package.json` with workspace scripts, `tsconfig.base.json` + root solution `tsconfig.json`, `@mas/*` path aliases, `.npmrc`, `.nvmrc`
  - **Packages scaffolded**: `@mas/core`, `@mas/infrastructure`, `@mas/plugin-sdk` (each with `package.json`, `tsconfig.json` using project references, `vitest.config.ts`, placeholder `src/index.ts` + unit test)
  - **Desktop app scaffolded**: `apps/desktop` with `electron-vite` config (main/preload/renderer), minimal Electron `main`/`preload`, minimal React 18 renderer, split `tsconfig` (node/web)
  - **Code quality**: ESLint (TS + React rules), Prettier, `.editorconfig`, Husky `pre-commit` (lint-staged) + `commit-msg` (commitlint/conventional commits)
  - **Testing**: Vitest workspace + shared coverage config (v8, thresholds), React Testing Library setup, test fixtures/factories scaffold, Playwright config for Electron E2E
  - **CI/CD**: GitHub Actions workflow (`.github/workflows/ci.yml`) — install, lint, format-check, type-check, build, test+coverage, artifact upload, with pnpm caching
  - **Environment handling**: root + desktop `.env.example` committed; `.env`/`.env.local` gitignored
- **Known environment limitation**: The build sandbox runs in `INTEGRATIONS_ONLY` network mode (no public registry access), so `pnpm install` cannot be executed here and no `pnpm-lock.yaml` is generated yet. All manifests use pinned, realistic versions; dependency installation, the full type-check/build, and test execution should be validated in an environment with registry access (e.g., CI). File contents were validated offline: all JSON/TS configs parse cleanly and all 22 TS/TSX source files parse without syntax errors.

### Sprint 2 - Phase 2: Core Domain Package (`@mas/core`)
- **Start Date**: 2026-06-29
- **Goal**: Design and implement the pure, framework-agnostic domain: entities, value objects, aggregates, repository contracts, domain services (business rules) and the CQRS application layer — with no database, infrastructure, AI or GUI
- **Status**: Done (awaiting user approval before Phase 3)
- **Completed**:
  - **Shared kernel**: `Result`/`ok`/`err` railway-style error handling, a `DomainError` hierarchy (`ValidationError`, `InvariantViolationError`, `NotFoundError`, `HandlerNotFoundError`), `Guard` validators, base `Entity`/`AggregateRoot`/`ValueObject`, branded `Id` types and an injectable `IdGenerator` port
  - **Value objects**: `Color` (hex/rgb/hsl + warm/cool/neutral category + seasonal mapping + hue maths), `Size`, `Season` (+ helpers), `Occasion` (+ formality), `GarmentCategory` (+ layer slots), `GarmentSubcategory` (per-category enums + membership validation + heavy-outerwear set), `BodyMeasurements`, `StylePreference`, `WeatherCondition`, `ColorPalette`
  - **Entities & aggregates**: `Garment` (status/wear-tracking invariants), `Outfit` (composition invariants — no duplicates, exclusive slots, dress vs separates), `UserProfile` (aggregate root), `StyleRule` (rule engine), `WardrobeCollection`, `CalendarEvent`, and the `Wardrobe` aggregate root (unique garments, no dangling collection references)
  - **Repository ports (interfaces only)**: `IGarmentRepository`, `IOutfitRepository`, `IUserProfileRepository`, `IStyleRuleRepository`, `ICollectionRepository`, `ICalendarEventRepository`
  - **Domain services (pure business rules)**: `ColorHarmonyService` (complementary/analogous/triadic), `StyleCompatibilityService` (formality + colour pairing), `SeasonalRecommendationService` (thermal adequacy), `OccasionMatchingService`, and `OutfitScoringService` — a 0–100 score across ten documented, weighted factors (colour, formality coherence, thermal adequacy, event adequacy, comfort/mobility, freshness, visual balance, accessories, user preference, seasonality) plus the hard "smart rules" (no damaged/in-laundry/archived items, no heavy coat when hot, no tie at informal events, no clashing colours, no recently-repeated combinations)
  - **Application layer (CQRS-lite)**: a pure in-memory `MessageBus` with `CommandBus`/`QueryBus` specialisations and registry-backed `ValidationMiddleware`; commands `AddGarment`, `UpdateGarment`, `RemoveGarment`, `CreateOutfit`, `RateOutfit`, `UpdateProfile`, `SetPreferences`, `CreateCollection`; queries `GetWardrobe`, `GetOutfitSuggestions`, `GetGarmentsByCategory`, `GetStyleAnalysis`, `GetColorPalette`, `GetSeasonalWardrobe`
  - **Tests**: 76 unit/integration tests across 6 files covering value objects, entities/aggregate invariants, every domain service (incl. all smart rules and the scoring breakdown) and the full command/query flow over in-memory repository fakes
- **Verification (offline)**: type-checked the whole package with `tsc --noEmit` (strict, pure-domain config) → **0 errors**; executed the full suite with the runtime available in the offline sandbox → **76 passed / 0 failed (154 assertions)**. The canonical tests are authored against the Vitest API (the project's configured runner for CI); because `INTEGRATIONS_ONLY` mode blocks installing Vitest from the registry, they were executed offline through a gitignored `vitest`→runner shim. No production code depends on the shim; CI runs the same files under Vitest unchanged.

### Sprint 3 - Phase 3: Infrastructure Package (`@mas/infrastructure`)
- **Start Date**: 2026-06-30
- **Goal**: Implement the infrastructure that supports the domain — concrete repositories, SQLite + Drizzle, migrations, file/image storage, ChromaDB vector plumbing, AI provider abstractions, persistent config, logging, events, backup/restore, import/export and an infrastructure error hierarchy — with NO business rules and full decoupling from the domain via the `@mas/core` ports
- **Status**: Done (awaiting user approval before Phase 4)
- **Completed**:
  - **Infrastructure error hierarchy**: `InfrastructureError` base + `DatabaseError`, `MigrationError`, `MappingError`, `StorageError`, `ConfigurationError`, `VectorStoreError`, `AIProviderError`, `BackupError`, `TransferError`, plus `wrapSync`/`wrapAsync` helpers — deliberately distinct from the domain's `DomainError` family
  - **Database layer**: a small synchronous `SqlDatabase` port with two production-shaped adapters (`BetterSqliteDatabase` over better-sqlite3, `BunSqliteDatabase` over Bun's engine) wrapping injected handles; a connection factory applying pragmas (WAL, foreign_keys, synchronous, busy_timeout); Drizzle ORM schema definitions (typed source of truth) + drizzle-kit config; SQL migrations folder + an idempotent, transaction-per-migration `MigrationRunner`
  - **Repositories**: SQLite-backed `Sql{Garment,Outfit,UserProfile,StyleRule,Collection,CalendarEvent}Repository`, each implementing its `@mas/core` port, with dedicated row↔domain **mappers** (join tables for outfit↔garment and collection↔garment; current-profile tracking; JSON columns for value objects) and demo `seedDemoData`
  - **Vector store**: provider-agnostic `IVectorStore` port (upsert/query/delete/count), a `ChromaVectorStore` adapter (lazy `chromadb` client) and a brute-force `InMemoryVectorStore` (cosine), plus the garment embedding collection schema — storage/search plumbing only, no recommendation logic
  - **File storage**: `IFileStorage` port + disk-backed `LocalFileStorage` (path-traversal-safe, sharded keys) and an `ImageStorageService` (save/retrieve/delete, size/extension validation, orphan GC) — storage I/O only, no image processing
  - **AI provider abstractions**: `IAITextProvider`/`IEmbeddingProvider` ports, `BaseAIProvider` scaffolding, Ollama/OpenAI/Anthropic adapter stubs (no model calls) and a deterministic `HashingEmbeddingProvider` for plumbing tests
  - **Cross-cutting services**: typed persistent `AppConfig` (defaults + validation) with a JSON `ConfigStore`; structured `ILogger` port + `ConsoleLogger`/sinks; `IEventBus` + `InMemoryEventBus` pub/sub; `BackupService` (DB + images + config snapshots with manifest + restore); `ImportExportService` (portable JSON bundle, optional gzip) working purely through repository ports; a UUID-backed `IdGenerator`
  - **Decoupling**: every external technology (SQLite, ChromaDB, an AI provider, the filesystem) sits behind a port and is injected via constructors, so any can be swapped without touching the domain; the package contains no business rules
- **Verification (offline)**: executed the full suite with the offline runner → **75 passed / 0 failed (177 assertions across 13 files)**, including real SQLite round-trips for all six repositories, the migration runner, import/export and backup/restore. As in Phase 2, canonical tests are authored against the Vitest API and run offline through the gitignored `vitest`→runner shim; the persistence layer is exercised against a real SQLite engine via the `SqlDatabase` port (the production better-sqlite3 driver is selected automatically in CI). All non-driver source files load and parse cleanly; the Drizzle schema/config and the dynamic driver/ChromaDB imports were syntax-validated.
- **Deferred to CI (no-network constraint)**: `pnpm install` cannot run in `INTEGRATIONS_ONLY` mode, so `better-sqlite3`, `drizzle-orm`, `chromadb`, `drizzle-kit` and `@types/node` are not installed locally. Consequently the full `tsc` type-check and any integration that requires the native better-sqlite3/Drizzle/ChromaDB packages are validated in CI (which has registry access). Dependency versions are pinned and realistic; the code is structured against interfaces so it is type-consistent in principle, and the offline test run proves the runtime persistence path end-to-end on an equivalent SQLite engine.

### Sprint 4 - Phase 4: Desktop Application (`apps/desktop`)
- **Start Date**: 2026-07-01
- **Goal**: Ship the first functional desktop application — a secure Electron shell, a typed IPC layer wired to the existing `@mas/core` use cases, and a complete, definitive React interface (layout, navigation across all screens, a reusable design system, dark/light theming and global state) — with NO AI engine, recommendations, 3D avatar or plugin system
- **Status**: Done (awaiting user approval before Phase 5)
- **Completed**:
  - **Electron main process**: secure `BrowserWindow` baseline (context isolation on, `nodeIntegration` off, sandbox on, `webviewTag` off); a `window` manager (single main window, single-instance lock, focus/restore, ready-to-show); process-wide security hardening (`security.ts`) — strict CSP header, `will-navigate` allowlist, `setWindowOpenHandler` denial routing external links to the OS browser, webview-attach block, and permission request/check handlers denying all
  - **Composition root** (`AppContainer`): wires the pure `@mas/core` `CommandBus`/`QueryBus` and every use-case handler to repositories, and seeds a realistic demo wardrobe **through the real AddGarment use case**. Persistence uses port-compatible in-memory repositories (the `@mas/core` repository ports); swapping in the `@mas/infrastructure` SQLite repositories is a one-line change once the native driver is available (CI/packaged builds)
  - **Typed IPC layer** (`src/shared/ipc`, shared by main + preload + renderer): a single channel map, plain serialisable DTOs, a `Result`-style response envelope with structured error propagation, and a fully-typed `IpcContract`. Main-process handler registry delegates each channel to the Command/Query buses; the `contextBridge` preload exposes a minimal, grouped, typed `window.mas` API. Renderer reaches the domain only through a typed `ipc` client — never `@mas/infrastructure`, domain classes, DB or filesystem
  - **React interface** (definitive, production-quality): `HashRouter` + persistent `AppLayout` shell. Nine screens — Dashboard, Guardarropa, Categorías, Prendas, Historial, Perfil, Configuración, Importar, Exportar — plus a 404. Wired screens (Dashboard/Wardrobe/Garments/Categories) show **live data over IPC** from the seeded application layer; the rest use realistic sample content with definitive structure
  - **Layout system**: collapsible Sidebar (grouped nav, active states, tooltips when collapsed), sticky Header (sidebar toggle, breadcrumbs, global search, theme switcher, user menu), route-driven Breadcrumbs, scrolling main panel, plus Modals/Dialogs, Toasts (store-driven queue) and right-click Context menus
  - **Design system** (token-based, all reusable): Button, Input/Textarea/Select, Card, Table, Form (Label/Field), Dialog, DropdownMenu, Tabs, Tooltip, Badge, Avatar, Skeleton, Toast/Toaster, ContextMenu — built on a Tailwind HSL-token theme (semantic colour roles) over Radix primitives, following the Shadcn/ui approach
  - **Theme**: light/dark/system preference with dynamic switching and persistence (UI store + `localStorage`); pure resolution logic applied to `<html>` by a `ThemeProvider`
  - **Global state (Zustand)**: `ui` (theme, sidebar, toasts — persisted), `wardrobe` (IPC-backed cache, filters/sort, optimistic remove), `outfit` (rules-based suggestions + history), `user` (profile + preferences — persisted) and an `ai-status` **placeholder** (fixed `not-configured`, no engine wired). Pure slice logic (filters/sort, toast queue) extracted for offline testing
  - **Scope discipline**: no AI engine, no intelligent recommendations (suggestions use the domain's deterministic rules-based scoring only), no 3D avatar/virtual try-on, no plugin system — all explicitly deferred to later phases
- **Verification (offline)**: pure logic is authored against the Vitest API and executed offline via the gitignored `vitest`→`bun:test` shim → **42 passed / 0 failed (90 assertions across 5 files)**, covering the IPC envelope/channels, presentation formatters, theme resolution/persistence, the wardrobe filter/sort/group selectors and the toast-queue reducer. All **79** desktop TS/TSX source files were syntax-validated (0 errors) with Bun's transpiler.
- **Deferred to CI (no-network constraint)**: Electron, React, Radix UI, Tailwind/PostCSS, `react-router-dom`, `zustand` and the type toolchain cannot be installed in `INTEGRATIONS_ONLY` mode, so the full `tsc` type-check, the `electron-vite` production build and the jsdom + React-Testing-Library **component tests** (e.g. `App.test.tsx`) are validated in CI. Dependency versions are pinned and realistic; the renderer is structured so the IPC/domain boundary is type-consistent by construction.

### Sprint 5 - Phase 5: AI Engine Integration (the cognitive engine of M-A-S)
- **Start Date**: 2026-07-02
- **Goal**: Build the provider-agnostic **AI Orchestrator** — the cognitive core of M-A-S — coordinating the full recommendation process from a free-text message to three explained outfits, with AI models as interchangeable, optional providers. Honour the core mandate: ALL intelligence belongs to M-A-S; no business rule may move into a provider; the system must degrade gracefully to domain-rules-only when offline; preference memory must persist and improve future recommendations.
- **Status**: Done (awaiting user approval before Phase 6)
- **Architecture (where each component lives & why)**:
  - **`@mas/core` (application/orchestration layer)** — ALL cognitive logic, depending only on domain services + abstract ports (`orchestration/ports.ts`): the **AI Orchestrator** plus **Context Analyzer**, **Preference Engine**, **Memory Engine**, **History Analyzer**, **Inventory Analyzer**, **Outfit Candidate Generator**, **Outfit Ranking Engine**, **Explanation Generator**, **AI Provider Router** and **Embedding Manager**. The ranking reuses the domain `OutfitScoringService` (0–100, ten weighted factors + hard smart rules) untouched. Exposed through the CQRS bus via `RecommendOutfitsQuery`/`RecommendOutfitsHandler` (`outfit.recommend`). The ports are *structurally compatible* with the Phase 3 `IAITextProvider`/`IEmbeddingProvider`/`IVectorStore`, so infrastructure adapters satisfy them with no wrapper and the dependency arrow stays inward (ADR-011).
  - **`@mas/infrastructure`** — swappable adapters behind the ports: `StaticTextProvider` (deterministic offline rephraser / local default), `LangChainTextProvider`/`LangChainEmbeddingProvider` + `createTextProvider` factory (lazy `@langchain/*` dynamic imports, ADR-014), and the persistent preference-memory stores `InMemoryPreferenceMemoryStore` / `FilePreferenceMemoryStore` (ADR-013). The existing `HashingEmbeddingProvider` + `InMemoryVectorStore` provide the deterministic offline embedding path.
  - **`apps/desktop`** — composition root (`AppContainer`) wires the orchestrator with the in-memory repositories, a `FilePreferenceMemoryStore` under `userData/ai/`, and an **empty** provider router (so the app ships in graceful-degradation mode by default); a typed IPC channel (`ai:recommend`) flows renderer → IPC → application/orchestrator → domain, plus `ai:status` driving the `ai-status` store (rules-only "degraded" vs provider-backed "ready").
- **The required 10-step flow (implemented exactly)**: 1) interpret the user's message → 2) extract structured context (occasion, season, weather, formality, comfort, mobility, time of day, activity) → 3) analyze history (recent-worn signatures, repetition) → 4) analyze learned preferences (Memory + Preference engines) → 5) query inventory (eligible, seasonal, wearable garments) → 6) generate candidates (composition-invariant outfits) → 7) evaluate with DOMAIN rules + scoring → 8) optionally enrich via a provider (additive semantic boost + NL explanations) → 9) produce three recommendations — **Principal**, **Más elegante**, **Más cómoda** → 10) explain each clearly.
- **Guarantees**: graceful degradation (full recommendations with NO provider, fully offline); AI enrichment strictly additive (a semantic boost only re-orders already-valid outfits; a provider only rephrases reasons the domain decided; provider failures fall back to the offline template); persistent memory (accept/reject nudges per-colour & per-subcategory affinities that measurably raise an accepted style's score next run); zero business rules in any provider.
- **Offline test method + results**: canonical tests authored against the Vitest API and executed offline through the gitignored, never-committed `vitest`→`bun:test` shim (no shim/`node_modules` committed). **`@mas/core`: 91 passed / 0 failed** (7 files, 226 assertions) including a new orchestration suite of **15 tests** — Context Analyzer extraction (es/en, temperature, comfort/mobility), Provider Router fallback, Memory/Preference engines, the **offline no-provider end-to-end** (3 explained recommendations from domain rules only, `degraded=true`, `providerId=null`), the **provider-available** path proving identical hard-rule outcomes while adding enrichment, provider-failure fallback, the memory-improves-ranking proof, the ranking-engine additive bias, and the bus handler. **`@mas/infrastructure`: 82 passed / 0 failed** (15 files, 196 assertions) including a new AI-engine **integration** suite that wires the real infra adapters (`HashingEmbeddingProvider` + `InMemoryVectorStore` + `StaticTextProvider` + `InMemoryPreferenceMemoryStore`) into the core orchestrator end-to-end offline, and the `FilePreferenceMemoryStore` disk round-trip. **`apps/desktop`: 42 passed / 0 failed** (unchanged Phase 4 pure suites still green). **Total: 215 offline tests, 0 failures.**
- **Type-check (offline vs CI-deferred)**: the pure `@mas/core` orchestration layer type-checks cleanly offline (`tsc --noEmit`, strict, no node types needed) — **0 errors**; the shared IPC contract/DTOs also type-check cleanly. CI-deferred (uninstallable in `INTEGRATIONS_ONLY`): anything needing `@types/node` or the `@langchain/*` SDKs (the infrastructure adapters + memory file store) and the Electron/React desktop build — all touched files were transpile-validated with Bun (0 errors). The LangChain SDKs are referenced only through lazy dynamic imports, so nothing breaks offline.
- **Explicitly NOT started (per scope)**: 3D Avatar, Virtual Try-On, and the Plugin system — untouched.

### Sprint 6 - Phase 6: Virtual Try-On & Avatar System
- **Start Date**: 2026-07-03
- **Goal**: Build M-A-S's outfit *visualisation* engine — NOT AI image generation, but a visual representation driven by the REAL garments of the recommended outfit, placed on a fictional avatar using their domain attributes (category → body slot, colour → material…). It must stay decoupled from the AI engine, consume only structured domain data, keep all business rules out of the renderer, and be fully replaceable in the future without touching the domain.
- **Status**: Done (awaiting user approval before Phase 7)
- **Architecture (where each component lives & why)**:
  - **`@mas/rendering` (NEW pure package)** — the engine-agnostic core and the replaceability seam (ADR-015). Plain data + ports only (no Three.js/React/DOM/domain/AI imports): the abstraction (`math`, `color` incl. sRGB→linear, `slots` body-region/draw-order vocabulary, the `SceneDescription`/`CameraState`/`MaterialDescriptor`/`ClothingLayer`/`AvatarDescriptor` types, and the `IRenderEngine`/`IScreenshotSink` ports) plus the ten required managers — **Avatar Manager**, **Clothing Renderer**, **Outfit Renderer**, **Camera Controller**, **Lighting Manager**, **Asset Manager**, **Texture Manager**, **Scene Manager**, **Screenshot Manager** and **Render Cache**. Chosen as a package (not an app folder) so it is reusable, builds via project references and is fully type-checkable + unit-testable offline. It has ZERO dependencies — not even `@mas/core` — so it can never reach an AI code path.
  - **`apps/desktop/src/renderer/src/rendering`** — the swappable Three.js / React-Three-Fiber adapter (ADR-016) + UI: a pure `primitives.ts` (offline-tested geometry/material derivation), the R3F components (`Primitive`, `AvatarView`, `ClothingLayers`, `SceneLights`, `CameraSync`, `TryOnCanvas`), a canvas-backed screenshot sink, the `useVirtualTryOn` hook, the `recommendationStore` (Zustand, fetches over the existing `ai:recommend` IPC), the DTO→renderable mapper, and the **Probador** screen (`VirtualTryOnPage`) wired into the nav/router at `/try-on`. React imports only the typed IPC client + `@mas/rendering`; it never imports infrastructure or domain classes.
- **Functional requirements (all met)**: visualise the recommended outfit on a fictional character; automatically swap garments when the recommendation/selection changes (no hidden state — re-running `OutfitRenderer`); rotate 360° (`wrapDegrees` orbit); zoom in/out (clamped); front/back/left/right/three-quarter view presets; take screenshots (request plumbing pure, WebGL read-back in the adapter); consistent representation across recommendations (one persistent avatar + order-independent cache key).
- **Decoupling & replaceability guarantees**: the render layer consumes only a `RenderableOutfit` (structured garment data — id/name/category/subcategory/colour); it never calls the orchestrator/providers and has no AI dependency. The Avatar Manager (and the whole layer) holds NO business rules — it only visualises already-decided outfits. All visual representation is behind the `SceneDescription`/`IRenderEngine` seam, so the graphics engine is replaceable without modifying the domain. Future-proofing is encoded as data-only extension points: swap the base avatar model, switch body types, add accessories (attachment points), improve materials/textures.
- **Offline test method + results**: canonical tests authored against the Vitest API and executed offline through the gitignored, never-committed `vitest`→`bun:test` shim (no shim/`node_modules` committed). **`@mas/rendering`: 88 passed / 0 failed** (14 files, 191 assertions) covering colour/linear conversion, slot/region/draw-order mapping, the Texture Manager finish mapping + memoisation, Asset Manager resolution + custom-manifest model swap, Avatar Manager model/body-type/pose swaps, Camera Controller 360° rotation/clamped zoom/view presets, Lighting presets, Clothing/Outfit renderers (full-body suppression, exclusive-slot, deterministic order), Render Cache keying (order-independent) + LRU eviction + outfit invalidation, Screenshot Manager request plumbing via a fake sink, and the Scene Manager composition (dress/swap/consistent-avatar/cache-hit). **`apps/desktop` (new): 11 passed / 0 failed** for the pure DTO→renderable mapper and the primitive geometry/material derivation. Offline totals after Phase 6: `@mas/core` 91, `@mas/infrastructure` 82, `@mas/rendering` 88, `apps/desktop` 53 — **314 passed / 0 failed**.
- **Type-check (offline vs CI/runtime-deferred)**: `@mas/rendering` type-checks AND emits cleanly offline (`tsc`, strict, no node types) — **0 errors**; the pure desktop adapter logic (`primitives.ts`, `dtoToRenderable.ts`) transpiles cleanly. CI/runtime-deferred (uninstallable in `INTEGRATIONS_ONLY`): `three`, `@react-three/fiber`, `@react-three/drei` (+`@types/three`), so the R3F components, the `electron-vite` build, the full `tsc --web` type-check, the jsdom + RTL component test (`VirtualTryOnPage.test.tsx`) and the actual WebGL render run in CI / at runtime — all 10 R3F/page/hook/store files were transpile-validated (0 syntax errors).
- **Explicitly NOT started (per scope)**: the Plugin system, Marketplace and Cloud sync — untouched.

---

*Last updated: 2026-07-03*
