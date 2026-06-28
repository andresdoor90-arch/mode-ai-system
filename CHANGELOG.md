# Changelog

All notable changes to the M-A-S (Mode AI System) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
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

*Last updated: 2026-06-28*
