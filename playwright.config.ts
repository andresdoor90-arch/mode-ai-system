import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for Electron end-to-end tests.
 *
 * E2E specs live in `apps/desktop/e2e`. They launch the built Electron app via
 * Playwright's `_electron` API. The desktop app must be built (`pnpm build`)
 * before running these tests.
 */
export default defineConfig({
  testDir: './apps/desktop/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
