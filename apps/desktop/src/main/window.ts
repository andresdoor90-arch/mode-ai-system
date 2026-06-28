/**
 * Window management.
 *
 * Owns creation and lifecycle of the application's `BrowserWindow`s with the
 * secure `webPreferences` baseline (context isolation on, node integration
 * off, sandbox on). A single main window is used today; the manager is written
 * to support more (e.g. a future detached preview) without changing callers.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

const isDev = !app.isPackaged;

/** Resolve the compiled preload script next to the main bundle. */
function preloadPath(): string {
  return fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
}

/** Tracks the primary window so it can be focused/recreated on demand. */
let mainWindow: BrowserWindow | null = null;

/** Create (or focus, if it already exists) the main application window. */
export function createMainWindow(): BrowserWindow {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    title: 'Mode AI System',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: preloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      // Disallow loading insecure content.
      allowRunningInsecureContent: false,
    },
  });

  // Avoid a white flash: only show once the renderer has painted.
  window.on('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (isDev && devServer !== undefined) {
    void window.loadURL(devServer);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow = window;
  return window;
}

/** Return the current main window, if any. */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow !== null && !mainWindow.isDestroyed() ? mainWindow : null;
}

/** Focus the main window, restoring it if minimised. */
export function focusMainWindow(): void {
  const window = getMainWindow();
  if (window === null) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
}
