import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Smoke E2E: build the app (`pnpm build`) then launch the packaged main
 * process and assert the first window renders the app title.
 *
 * Requires a display server; in CI this runs under `xvfb-run`.
 */
test('app launches and shows the main window', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../out/main/index.js')],
  });

  const window = await app.firstWindow();
  await expect(window.locator('h1')).toHaveText(/mode ai system/i);

  await app.close();
});
