import type { MasBridgeApi } from './index';

declare global {
  interface Window {
    /** API exposed by the preload bridge via `contextBridge.exposeInMainWorld`. */
    mas: MasBridgeApi;
  }
}

export {};
