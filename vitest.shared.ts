import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest defaults consumed by each package's local config via
 * `mergeConfig`. Centralises coverage thresholds and reporters so quality
 * gates stay consistent across the monorepo.
 */
export const sharedTestConfig = defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/*.config.*',
        '**/*.d.ts',
        '**/tests/**',
        '**/test/**',
        '**/__fixtures__/**',
        '**/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});

export default sharedTestConfig;
