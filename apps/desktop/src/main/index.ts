/**
 * Electron main-process entry point.
 *
 * Orchestrates application startup in the correct, secure order:
 *   1. enforce a single instance,
 *   2. install process-wide security policies (CSP, navigation guards),
 *   3. build the application container (wires `@mas/core` use cases to repos),
 *   4. register the typed IPC handlers against that container,
 *   5. create the main window.
 *
 * The renderer never talks to the domain or infrastructure directly: every
 * request flows through the IPC handlers registered here.
 */
import { app, BrowserWindow } from 'electron';

import { AppContainer } from './container/AppContainer';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/registerIpcHandlers';
import { installSecurityPolicies } from './security';
import { initAutoUpdates } from './updater';
import { createMainWindow, focusMainWindow } from './window';

// Enforce a single running instance; focus the existing window otherwise.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusMainWindow();
  });

  void app.whenReady().then(async () => {
    installSecurityPolicies();

    const container = await AppContainer.create({
      dataDir: app.getPath('userData'),
      // A real product starts empty: never seed a demonstration wardrobe. The
      // user builds their own wardrobe from scratch (the default category
      // taxonomy is still available as editable starting categories).
      skipDemoSeed: true,
    });
    registerIpcHandlers(container);

    createMainWindow();

    // Kick off background auto-updates (no-op in dev; never blocks startup).
    void initAutoUpdates();

    app.on('activate', () => {
      // macOS: re-create a window when the dock icon is clicked and none exist.
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // On macOS apps typically stay active until the user quits explicitly.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    unregisterIpcHandlers();
  });
}
