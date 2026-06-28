import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, shell } from 'electron';

const isDev = !app.isPackaged;
const RENDERER_DEV_SERVER = process.env.ELECTRON_RENDERER_URL;

/**
 * Create the application's main window.
 *
 * Security baseline: context isolation on, node integration off, sandbox on.
 * Real IPC channels, the embedded Fastify backend and window management are
 * implemented in Phase 4 — this is the Phase 1 scaffold entry point only.
 */
function createMainWindow(): BrowserWindow {
  const preloadPath = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Mode AI System',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  // Open external links in the user's default browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && RENDERER_DEV_SERVER) {
    void window.loadURL(RENDERER_DEV_SERVER);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
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
