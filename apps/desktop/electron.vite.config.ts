import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

/**
 * electron-vite configuration.
 *
 * Defines three independent build targets:
 *  - `main`    : the Electron main process (Node environment)
 *  - `preload` : the context-isolated preload bridge
 *  - `renderer`: the React single-page app (browser environment)
 *
 * `externalizeDepsPlugin` keeps node/native dependencies out of the main and
 * preload bundles so Electron resolves them at runtime. The workspace
 * `@mas/*` packages are explicitly EXCLUDED from externalization (i.e. bundled
 * in) so the packaged app does not have to resolve pnpm workspace symlinks at
 * runtime — only genuine third-party/native modules (e.g. better-sqlite3,
 * electron-updater) stay external and are resolved from node_modules.
 */
const WORKSPACE_PACKAGES = [
  '@mas/core',
  '@mas/infrastructure',
  '@mas/rendering',
  '@mas/plugin-sdk',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
