import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { mergeConfig, defineConfig } from 'vitest/config';

import { sharedTestConfig } from '../../vitest.shared';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(rootDir, 'src/renderer/src'),
      },
    },
    test: {
      name: 'desktop',
      root: rootDir,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
      // Playwright E2E specs run via `playwright test`, not Vitest.
      exclude: ['e2e/**', '**/node_modules/**', '**/out/**'],
    },
  }),
);
