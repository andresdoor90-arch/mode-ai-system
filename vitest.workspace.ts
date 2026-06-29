import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace configuration.
 *
 * Aggregates the per-package Vitest configs so that `pnpm test` at the repo
 * root runs the entire suite. Each project supplies its own environment
 * (node for packages, jsdom for the renderer).
 */
export default defineWorkspace([
  'packages/core/vitest.config.ts',
  'packages/infrastructure/vitest.config.ts',
  'packages/rendering/vitest.config.ts',
  'packages/plugin-sdk/vitest.config.ts',
  'apps/desktop/vitest.config.ts',
]);
