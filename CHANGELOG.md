# Changelog

All notable changes to the M-A-S (Mode AI System) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Phase 5 — AI Engine Integration (`@mas/core` orchestration + `@mas/infrastructure` adapters + desktop wiring)** — the provider-agnostic cognitive engine of M-A-S. ALL intelligence is M-A-S logic; AI models are interchangeable, optional providers; correctness never depends on a model.
  - AI Orchestrator in `@mas/core` coordinating the full recommendation process through ten clearly-separated cognitive components: **Context Analyzer**, **Preference Engine**, **Memory Engine**, **History Analyzer**, **Inventory Analyzer**, **Outfit Candidate Generator**, **Outfit Ranking Engine**, **Explanation Generator**, **AI Provider Router** and **Embedding Manager** — depending only on domain services + abstract ports (`orchestration/ports.ts`)
  - The exact 10-step flow: interpret the message → extract context → analyze history → analyze learned preferences → query inventory → get candidates → evaluate with DOMAIN rules → optionally enrich via a provider → generate three recommendations (**Principal**, **Más elegante**, **Más cómoda**) → explain each
  - Ranking reuses the domain `OutfitScoringService` (0–100 across ten weighted factors + hard smart rules) untouched; AI enrichment is strictly additive — a capped semantic boost only re-orders already-valid outfits and a provider only rephrases domain-decided reasoning (with offline-template fallback on failure)
  - Mandatory graceful degradation: with NO provider configured the engine still produces the three explained recommendations from domain rules alone, fully offline
  - Persistent preference memory: accept/reject feedback nudges per-colour and per-subcategory affinities (pure `MemoryEngine` logic in core) that measurably improve future rankings; durability behind an `IPreferenceMemoryStore` port
  - Exposed through the CQRS application bus via `RecommendOutfitsQuery`/`RecommendOutfitsHandler` (`outfit.recommend`)
  - Infrastructure adapters behind the ports: `StaticTextProvider` (deterministic offline rephraser / local default), `LangChainTextProvider`/`LangChainEmbeddingProvider` + `createTextProvider` factory (lazy `@langchain/*` dynamic imports — OpenAI/Anthropic/Ollama), and `InMemoryPreferenceMemoryStore` / `FilePreferenceMemoryStore`
  - Desktop wiring: `AppContainer` assembles the orchestrator (offline-by-default empty provider router, `FilePreferenceMemoryStore` under `userData/ai/`); new typed IPC channels `ai:recommend` (renderer → IPC → application/orchestrator → domain) and `ai:status`; the `ai-status` store now mirrors real engine capability (rules-only "degraded" vs provider-backed "ready")
  - Tests: 22 new offline tests — core orchestration suite (15: context extraction, router fallback, memory/preference engines, offline no-provider end-to-end, provider-available hard-rule invariance, provider-failure fallback, memory-improves-ranking, ranking additive bias, bus handler) and infrastructure suite (7: `StaticTextProvider`, the AI-engine integration wiring real infra adapters into the core orchestrator end-to-end offline, and the `FilePreferenceMemoryStore` disk round-trip). Offline totals after Phase 5: `@mas/core` 91, `@mas/infrastructure` 82, `apps/desktop` 42 — **215 passed / 0 failed**
  - Pinned realistic AI dependencies for the infrastructure package: `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/ollama`
  - Scope discipline: 3D Avatar, Virtual Try-On and the Plugin system were NOT started

### Added (Phase 4)
- **Phase 4 — Desktop Application (`apps/desktop`)** (first functional, navigable desktop app; NO AI engine, recommendations, 3D avatar or plugins)
  - Electron main process: secure window baseline (context isolation on, `nodeIntegration` off, sandbox on, `webviewTag` off), a window manager (single main window, single-instance lock, focus/restore, ready-to-show) and process-wide security hardening — strict Content-Security-Policy header, `will-navigate` allowlist, `setWindowOpenHandler` routing external links to the OS browser, webview-attach blocking, and permission request/check handlers that deny everything
  - Composition root (`AppContainer`): wires the pure `@mas/core` `CommandBus`/`QueryBus` and all use-case handlers to repositories and seeds a realistic demo wardrobe through the real AddGarment use case; persistence uses port-compatible in-memory repositories, swappable for the `@mas/infrastructure` SQLite repositories without touching the use cases, IPC or UI
  - Typed IPC layer shared by main/preload/renderer: a single channel map, plain serialisable DTOs, a `Result`-style response envelope with structured error propagation, and a fully-typed `IpcContract`; a minimal `contextBridge` preload exposes a grouped, typed `window.mas` API; main-process handler registry delegates each channel to the Command/Query buses
  - React interface (definitive design): `HashRouter` + a persistent `AppLayout` shell with nine screens — Dashboard, Guardarropa, Categorías, Prendas, Historial, Perfil, Configuración, Importar, Exportar — plus a 404; Dashboard/Wardrobe/Garments/Categories render live data over IPC from the seeded application layer
  - Layout system: collapsible Sidebar (grouped nav, active states, collapsed tooltips), sticky Header (sidebar toggle, breadcrumbs, global search, theme switcher, user menu), route-driven Breadcrumbs, scrolling main panel, Modals/Dialogs, a store-driven Toast queue and right-click Context menus
  - Design system (token-based, reusable): Button, Input/Textarea/Select, Card, Table, Form (Label/Field), Dialog, DropdownMenu, Tabs, Tooltip, Badge, Avatar, Skeleton, Toast/Toaster and ContextMenu — built on a Tailwind HSL-token theme over Radix primitives (Shadcn/ui approach)
  - Theme: light/dark/system preference with dynamic switching and persistence (UI store + `localStorage`), applied to `<html>` by a `ThemeProvider` via pure resolution logic
  - Global state (Zustand): `ui`, `wardrobe` (IPC-backed cache with filters/sort and optimistic removal), `outfit` (rules-based suggestions + history), `user` (profile/preferences, persisted) and an `ai-status` placeholder fixed to `not-configured` (no engine wired); pure slice logic extracted for offline testing
  - Strict layering: the React renderer talks only to a typed IPC client; it never imports `@mas/infrastructure`, the domain classes, or touches the database/filesystem — all communication flows renderer → IPC → main → application layer (→ infrastructure)
  - Tests: 42 offline unit tests (90 assertions) covering the IPC envelope/channels, presentation formatters, theme resolution/persistence, the wardrobe filter/sort/group selectors and the toast-queue reducer; jsdom + React-Testing-Library component tests authored against the Vitest+RTL API for CI
  - Pinned realistic desktop dependencies: `react-router-dom`, `@radix-ui/*` (dialog, dropdown-menu, tabs, tooltip, toast, context-menu, avatar, label, slot), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (+ `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate` dev)

### Added (Phase 3)
- **Phase 3 — Infrastructure Package (`@mas/infrastructure`)** (concrete adapters behind the `@mas/core` ports; no business rules)
  - Infrastructure error hierarchy distinct from the domain's: `InfrastructureError` + `DatabaseError`, `MigrationError`, `MappingError`, `StorageError`, `ConfigurationError`, `VectorStoreError`, `AIProviderError`, `BackupError`, `TransferError`, with `wrapSync`/`wrapAsync` helpers
  - Database layer: a synchronous `SqlDatabase` port with `BetterSqliteDatabase` (production, better-sqlite3) and `BunSqliteDatabase` adapters wrapping injected handles; a connection factory applying SQLite pragmas (WAL, foreign_keys, synchronous, busy_timeout); Drizzle ORM schema definitions + drizzle-kit config; a SQL migrations folder and an idempotent, transaction-per-migration `MigrationRunner`
  - Repository implementations: SQLite-backed `Sql{Garment,Outfit,UserProfile,StyleRule,Collection,CalendarEvent}Repository`, each implementing its domain port, with row↔domain mappers, join tables for outfit/collection membership, current-profile tracking and demo `seedDemoData`
  - Vector store (storage/search plumbing only, no recommendation logic): provider-agnostic `IVectorStore`, a `ChromaVectorStore` adapter, a brute-force `InMemoryVectorStore` (cosine) and the garment embedding collection schema
  - File storage: `IFileStorage` + path-traversal-safe `LocalFileStorage` (sharded keys) and `ImageStorageService` (save/retrieve/delete, validation, orphan GC) — storage I/O only, no image processing
  - AI provider abstractions: `IAITextProvider`/`IEmbeddingProvider` ports, `BaseAIProvider` scaffolding, Ollama/OpenAI/Anthropic adapter stubs (no model calls), and a deterministic `HashingEmbeddingProvider`
  - Cross-cutting services: typed persistent `AppConfig` (defaults + validation) with a JSON `ConfigStore`; structured logging (`ILogger` + `ConsoleLogger` + sinks); an event bus (`IEventBus` + `InMemoryEventBus`); a `BackupService` (database + images + config snapshots with manifest and restore); an `ImportExportService` (portable JSON bundle, optional gzip) working purely through repository ports; and a UUID-backed `IdGenerator`
  - Decoupling: every external technology sits behind a port and is constructor-injected, so SQLite, ChromaDB or an AI provider can be replaced without modifying the domain
  - Tests: 75 unit/integration tests (177 assertions) covering the error helpers, logging, events, config persistence, file/image storage, the SQL adapter + migration runner, all six repositories' round-trips against a real SQLite engine, the in-memory vector store, AI provider scaffolding, import/export and backup/restore
  - Pinned realistic dependencies for the infrastructure package: `better-sqlite3`, `drizzle-orm`, `chromadb` (+ `drizzle-kit`, `@types/better-sqlite3` dev)

### Added (Phase 2)
- **Phase 2 — Core Domain Package (`@mas/core`)** (pure, framework-agnostic domain)
  - Shared kernel: railway-style `Result`/`ok`/`err`, a `DomainError` hierarchy (`ValidationError`, `InvariantViolationError`, `NotFoundError`, `HandlerNotFoundError`), `Guard` validators, base `Entity`/`AggregateRoot`/`ValueObject`, branded `Id` types and an injectable `IdGenerator` port
  - Value objects: `Color` (hex/rgb/hsl conversions, warm/cool/neutral classification, seasonal mapping, hue distance), `Size`, `Season`, `Occasion`, `GarmentCategory` (+ layer slots), `GarmentSubcategory` (per-category enums + membership validation), `BodyMeasurements`, `StylePreference`, `WeatherCondition`, `ColorPalette`
  - Entities & aggregates: `Garment`, `Outfit` (composition invariants), `UserProfile` (root), `StyleRule`, `WardrobeCollection`, `CalendarEvent`, and the `Wardrobe` aggregate root
  - Repository contracts (interfaces only): `IGarmentRepository`, `IOutfitRepository`, `IUserProfileRepository`, `IStyleRuleRepository`, `ICollectionRepository`, `ICalendarEventRepository`
  - Domain services (pure business rules): `ColorHarmonyService` (complementary/analogous/triadic), `StyleCompatibilityService`, `SeasonalRecommendationService`, `OccasionMatchingService`, and `OutfitScoringService` — a 0–100 score over ten documented weighted factors plus hard "smart rules" (no damaged/in-laundry/archived garments, no heavy coat when hot, no tie at informal events, no clashing colours, no recently-repeated combinations)
  - Application layer (CQRS-lite): pure in-memory `MessageBus`/`CommandBus`/`QueryBus` and `ValidationMiddleware`; commands (AddGarment, UpdateGarment, RemoveGarment, CreateOutfit, RateOutfit, UpdateProfile, SetPreferences, CreateCollection) and queries (GetWardrobe, GetOutfitSuggestions, GetGarmentsByCategory, GetStyleAnalysis, GetColorPalette, GetSeasonalWardrobe)
  - Tests: 76 unit/integration tests covering value objects, entity/aggregate invariants, all domain services (incl. smart rules) and the full command/query flow over in-memory repository fakes
  - No external technology in the domain: no Electron, React, SQLite, HTTP/APIs or AI libraries; anything that touches the outside world is expressed as an interface only

### Added (Phase 1)
- **Phase 1 — Project Foundation & Setup** (monorepo scaffolding)
  - Monorepo & build config: `pnpm-workspace.yaml`, root `package.json` workspace scripts, `tsconfig.base.json` + root solution `tsconfig.json`, `@mas/*` path aliases, `.npmrc`, `.nvmrc`
  - Packages scaffolded with placeholder entry points and unit tests: `@mas/core`, `@mas/infrastructure`, `@mas/plugin-sdk` (TypeScript project references wiring core → infrastructure/plugin-sdk)
  - Desktop app scaffolded: `apps/desktop` with `electron-vite` config (main/preload/renderer targets), minimal Electron main process + context-isolated preload bridge, minimal React 18 renderer, split node/web `tsconfig`
  - Code quality tooling: ESLint (TypeScript + React rules), Prettier, `.editorconfig`, Husky hooks (`pre-commit` → lint-staged, `commit-msg` → commitlint), conventional-commit enforcement
  - Testing infrastructure: Vitest workspace + shared coverage config (v8 provider, thresholds), React Testing Library setup, test fixtures/factories scaffold, Playwright config for Electron E2E
  - CI/CD: GitHub Actions workflow (`.github/workflows/ci.yml`) running install, lint, format-check, type-check, build, and tests with coverage; artifact upload and pnpm dependency caching
  - Environment variable handling: root and desktop `.env.example` committed; `.env`/`.env.local` gitignored
- Initial project management documentation
  - `PROJECT_PROGRESS.md` - Project status tracking with milestones and architecture decisions
  - `TODO.md` - Comprehensive task list organized by phase and priority
  - `CHANGELOG.md` - Change log following Keep a Changelog format

### Notes
- The foundation and subsequent phases were authored in an offline (`INTEGRATIONS_ONLY`) sandbox, so `pnpm install` was not run and no `pnpm-lock.yaml` is committed yet. Dependency versions are pinned and realistic; install, full type-check/build, and test runs are validated via CI (environment with registry access).
- Phase 3 specifically: `better-sqlite3`, `drizzle-orm`, `chromadb`, `drizzle-kit` and `@types/node` are not installable offline, so the full `tsc` type-check and native better-sqlite3/Drizzle/ChromaDB integration are CI-deferred. The runtime persistence path is proven offline against an equivalent SQLite engine through the driver-agnostic `SqlDatabase` port.
- Phase 4 specifically: Electron, React, Radix UI, Tailwind/PostCSS, `react-router-dom` and `zustand` cannot be installed offline, so the `electron-vite` build, the full `tsc` type-check and the jsdom + React-Testing-Library component tests are CI-deferred. Pure logic (IPC envelope, formatters, theme, store selectors/reducers) is tested offline via the gitignored `vitest`→`bun:test` shim (42 passed); all 79 desktop source files pass a syntax check.
- Phase 5 specifically: the cognitive engine in `@mas/core` is pure and type-checks + tests fully offline (rules-only path needs no model). The `@langchain/*` SDKs are referenced only through lazy dynamic `import()` and are uninstallable in `INTEGRATIONS_ONLY` mode, so installing them, type-resolving the LangChain adapters/file memory store (needs `@types/node`), and any real model call are CI-deferred; the offline tests prove the engine end-to-end with deterministic providers (`StaticTextProvider`, `HashingEmbeddingProvider`).

---

## Version History

> Versions will be tracked here as the project progresses through development milestones.

### Planned Versions

- **v0.1.0** - Project foundation (monorepo setup, build pipeline, testing infrastructure)
- **v0.2.0** - Core domain (entities, value objects, repository interfaces)
- **v0.3.0** - Infrastructure layer (SQLite, ChromaDB, image processing)
- **v0.4.0** - Desktop shell (Electron, React UI, embedded Fastify backend)
- **v0.5.0** - AI engine integration (LangChain.js, Ollama, cloud providers)
- **v0.6.0** - Core features (wardrobe management, outfit recommendations)
- **v0.7.0** - Virtual try-on (Three.js avatar system)
- **v0.8.0** - Plugin system (SDK, sandbox, marketplace)
- **v0.9.0** - Polish (testing, performance, accessibility)
- **v1.0.0** - First stable release (distribution-ready)

---

*Last updated: 2026-07-01*
