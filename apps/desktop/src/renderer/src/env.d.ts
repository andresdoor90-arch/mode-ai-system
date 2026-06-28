/// <reference types="vite/client" />

import type { MasBridgeApi } from '../../preload/index';

declare global {
  interface Window {
    mas: MasBridgeApi;
  }
}

export {};
