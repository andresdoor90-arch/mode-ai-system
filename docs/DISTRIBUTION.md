# Building & Distributing M-A-S

This guide covers producing installable, distributable builds of the **Mode AI
System** desktop app (Phase 8 — Polish, Testing & Distribution).

> **Important — network requirement.** The project was authored in an offline
> (`INTEGRATIONS_ONLY`) sandbox with no access to the npm registry, so
> `pnpm install` and the Electron binary download **cannot run there**.
> Producing an executable requires an environment with network access: either a
> developer machine or the GitHub Actions `Release` workflow (recommended).

## Prerequisites

- **Node.js** ≥ 20 (CI uses 22)
- **pnpm** 9.7.1 (`corepack enable` will provide it)
- Platform toolchain for native modules (`better-sqlite3` is compiled):
  - Windows: Build Tools for Visual Studio (C++), Python 3
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `python3`

## One-time install

```bash
pnpm install
```

This installs all workspace dependencies and links the `@mas/*` packages.

## Verify before packaging (quality gates)

```bash
pnpm lint          # ESLint, zero warnings
pnpm format:check  # Prettier
pnpm typecheck     # tsc across every package
pnpm test          # the full Vitest suite (445 tests)
pnpm build         # build packages + the electron-vite app bundle
```

> Never package while any of these fail — see the policy at the end.

## Produce installers

The desktop app is packaged with **electron-builder**, configured in
[`apps/desktop/electron-builder.yml`](../apps/desktop/electron-builder.yml).

From the repo root:

```bash
pnpm dist          # current OS, all configured targets
pnpm dist:win      # Windows: NSIS installer + portable .exe
pnpm dist:mac      # macOS: .dmg (x64 + arm64)
pnpm dist:linux    # Linux: AppImage
```

Each script builds the packages, runs `electron-vite build` (populating
`apps/desktop/out/`), then runs electron-builder. Artifacts are written to
**`apps/desktop/release/`**.

### Output artifacts

| Platform | Artifact                                        |
| -------- | ----------------------------------------------- |
| Windows  | `Mode AI System-<version>-x64-setup.exe` (NSIS) |
| Windows  | `Mode AI System-<version>-portable.exe`         |
| macOS    | `Mode AI System-<version>-<arch>.dmg`           |
| Linux    | `Mode AI System-<version>-x64.AppImage`         |

## Releasing via CI (recommended)

Pushing a version tag triggers the
[`Release` workflow](../.github/workflows/release.yml), which builds on
`windows-latest`, `macos-latest` and `ubuntu-latest` in parallel and uploads the
installers to a GitHub Release (and as workflow artifacts):

```bash
# bump the version in package.json files first, then:
git tag v1.0.0
git push origin v1.0.0
```

GitHub-hosted runners have registry/network access, so this is the canonical
path to a working executable from the offline-authored source.

## App icons (the only manual asset)

Add `icon.ico` / `icon.icns` / `icon.png` to
[`apps/desktop/build/`](../apps/desktop/build/README.md). If absent,
electron-builder still produces working installers with Electron's default icon
(it only logs a warning), so packaging is never blocked.

## Code signing & notarization (production)

For trusted, non-warning installers, configure signing via environment variables
read by electron-builder:

- **Windows**: `CSC_LINK` (base64 .pfx) + `CSC_KEY_PASSWORD`
- **macOS**: `CSC_LINK` + `CSC_KEY_PASSWORD`, plus notarization
  (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)

These are optional; unsigned builds run but show an OS trust prompt.

## Auto-update

The main process initialises **electron-updater** on startup
([`apps/desktop/src/main/updater.ts`](../apps/desktop/src/main/updater.ts)),
checking the GitHub Releases feed configured under `publish:` in
`electron-builder.yml`. It is a no-op in development and when
`MAS_DISABLE_AUTO_UPDATE=1`, and never blocks or crashes startup.

## Native modules in the package

`better-sqlite3` ships a compiled `.node` binary. The electron-builder config
unpacks native binaries from the asar archive (`asarUnpack`) and rebuilds them
against the bundled Electron ABI (`npmRebuild: true`) so the database works in
the packaged app.

## Build policy

Do **not** generate a release while any of the following is true:

- a compilation/type error exists (`pnpm typecheck` / `pnpm build` fails),
- a test is failing (`pnpm test`),
- a feature is incomplete or a known bug is open.

Only cut a release when the whole project is green and stable.
