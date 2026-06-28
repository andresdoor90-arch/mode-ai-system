# Changelog

All notable changes to the M-A-S (Mode AI System) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
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
- The foundation was authored in an offline (`INTEGRATIONS_ONLY`) sandbox, so `pnpm install` was not run and no `pnpm-lock.yaml` is committed yet. Dependency versions are pinned and realistic; install, full type-check/build, and test runs are validated via CI (environment with registry access).

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

*Last updated: 2026-06-29*
