/**
 * Auto-update wiring (electron-updater).
 *
 * Distribution concern (Phase 8). The updater is intentionally:
 *   - lazy-loaded (a dynamic import) so neither development nor the unit/test
 *     environment needs `electron-updater` resolved up front, and so a build
 *     without the dependency still starts;
 *   - fully guarded — it never runs while packaged is false (dev) and never
 *     throws into the startup path; any failure is logged and swallowed so a
 *     transient network/feed problem can never prevent the app from launching;
 *   - silent for the user beyond standard download-in-background behaviour.
 *
 * Updates are published to GitHub Releases (see `electron-builder.yml`'s
 * `publish` block). On a packaged build the updater checks the feed shortly
 * after startup and, if a newer version exists, downloads it in the background
 * and installs it on quit.
 */
import { app } from 'electron';

type Logger = Pick<Console, 'info' | 'warn' | 'error'>;

let initialised = false;

/**
 * Initialise background auto-updates. No-op (other than a debug log) when the
 * app is not packaged, when updates are explicitly disabled, or when the
 * dependency/feed is unavailable.
 */
export async function initAutoUpdates(logger: Logger = console): Promise<void> {
  if (initialised) {
    return;
  }
  initialised = true;

  // Never attempt updates in development or when explicitly disabled.
  if (!app.isPackaged || process.env.MAS_DISABLE_AUTO_UPDATE === '1') {
    logger.info('[updater] auto-update disabled (dev or MAS_DISABLE_AUTO_UPDATE).');
    return;
  }

  try {
    // Lazy import: the module is only present in packaged/CI builds.
    const mod = (await import('electron-updater')) as unknown as {
      autoUpdater: {
        logger: Logger | null;
        autoDownload: boolean;
        autoInstallOnAppQuit: boolean;
        on(event: string, listener: (...args: unknown[]) => void): void;
        checkForUpdatesAndNotify(): Promise<unknown>;
      };
    };
    const { autoUpdater } = mod;

    autoUpdater.logger = logger;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (err) => {
      logger.warn('[updater] update check failed:', err);
    });
    autoUpdater.on('update-available', (info) => {
      logger.info('[updater] update available:', info);
    });
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('[updater] update downloaded; will install on quit:', info);
    });

    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    // Swallow: updates must never block or crash startup.
    logger.warn('[updater] auto-update unavailable:', err);
  }
}
