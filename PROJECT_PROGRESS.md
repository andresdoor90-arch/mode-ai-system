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
| Monorepo | apps/desktop + packages/ (core, infrastructure, plugin-sdk) |

## Current Status

| Module | Status | Progress | Notes |
|--------|--------|----------|-------|
| Project Setup & Configuration | Complete | 100% | Monorepo, tooling, testing, CI/CD scaffolded (Phase 1) |
| Core Package (Domain Layer) | Complete | 100% | Entities, value objects, repository ports, domain services, CQRS use cases — pure & framework-agnostic (Phase 2) |
| Infrastructure Package | Complete | 100% | SQLite/Drizzle repositories, migrations, ChromaDB + in-memory vector store, file/image storage, AI provider ports, config, logging, events, backup/restore, import/export, error hierarchy (Phase 3) |
| Desktop App - Electron Shell | Not Started | 0% | Main process, window management |
| Desktop App - Frontend UI | Not Started | 0% | React components, routing, state |
| Embedded Backend (Fastify) | Not Started | 0% | API routes, middleware, services |
| AI Engine Integration | Not Started | 0% | LangChain.js, Ollama, cloud APIs |
| Wardrobe Management | Not Started | 0% | CRUD, categorization, image storage |
| Outfit Recommendation Engine | Not Started | 0% | ML pipeline, rules engine, scoring |
| Virtual Try-On / Avatar | Not Started | 0% | Three.js, body model, garment fitting |
| Plugin SDK | Not Started | 0% | API surface, sandboxing, lifecycle |
| Image Processing Pipeline | In Progress | 20% | Storage I/O + metadata wiring done (Phase 3); Sharp processing (resize, bg removal, colour extraction) deferred |
| User Profile & Preferences | Not Started | 0% | Style profile, body measurements |
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

## Milestones

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
- [ ] Configure Electron main process
- [ ] Implement window management
- [ ] Set up IPC communication
- [ ] Build React app with routing
- [ ] Implement Zustand state management
- [ ] Create Shadcn/ui component library setup
- [ ] Implement Tailwind CSS theming

### Milestone 5: AI Engine
- [ ] Integrate LangChain.js
- [ ] Set up Ollama local inference
- [ ] Implement OpenAI/Anthropic cloud connectors
- [ ] Build outfit recommendation chain
- [ ] Implement style analysis pipeline
- [ ] Create color harmony analyzer

### Milestone 6: Core Features
- [ ] Wardrobe management (add, edit, categorize garments)
- [ ] Outfit generation and recommendation
- [ ] Virtual try-on with Three.js avatar
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

---

*Last updated: 2026-06-30*
