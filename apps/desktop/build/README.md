# Build resources

Assets consumed by `electron-builder` when packaging the desktop app
(`directories.buildResources: build` in `electron-builder.yml`).

## App icons (the one manual asset to add)

Place the following icon files here before producing signed/branded installers.
electron-builder maps them automatically by filename:

| File        | Platform | Recommended source        |
| ----------- | -------- | ------------------------- |
| `icon.ico`  | Windows  | 256×256 (multi-size .ico) |
| `icon.icns` | macOS    | 1024×1024 source          |
| `icon.png`  | Linux    | 512×512 (or 1024×1024)    |

You can generate all three from a single 1024×1024 PNG, e.g. with
[`electron-icon-builder`](https://www.npmjs.com/package/electron-icon-builder):

```bash
npx electron-icon-builder --input=./logo-1024.png --output=./build
```

If these files are absent, electron-builder still produces working installers
using Electron's default icon (it only logs a warning) — so packaging is never
blocked by missing branding.

## `entitlements.mac.plist`

macOS hardened-runtime entitlements required for the Electron/V8 JIT and
local file access. Used for notarised/signed macOS builds.
