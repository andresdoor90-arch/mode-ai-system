import { fileURLToPath } from 'node:url';

import { mergeConfig, defineConfig } from 'vitest/config';

import { sharedTestConfig } from '../../vitest.shared';

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      name: 'core',
      root: fileURLToPath(new URL('.', import.meta.url)),
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  }),
);
