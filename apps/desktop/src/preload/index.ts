import { contextBridge } from 'electron';

/**
 * Preload bridge.
 *
 * Exposes a minimal, explicitly-allowlisted API to the renderer over the
 * context bridge. Phase 1 only publishes static metadata; IPC invoke/handle
 * channels for garments, outfits, AI, etc. are added in Phase 4.
 */
const api = {
  /** Identifies the bridge build for diagnostics. */
  appName: 'Mode AI System',
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
} as const;

export type MasBridgeApi = typeof api;

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('mas', api);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to expose preload bridge:', error);
  }
} else {
  // Fallback for the (non-recommended) non-isolated case.
  // @ts-expect-error -- augmenting the global window in the non-isolated path.
  window.mas = api;
}
