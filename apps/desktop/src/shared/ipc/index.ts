/**
 * Public barrel for the shared IPC contract.
 *
 * Imported by the main process (`src/main`), the preload bridge
 * (`src/preload`) and the renderer (`src/renderer`). Keep this module free of
 * Electron/React/Node runtime imports so it is safe to load from every side.
 */
export * from './channels';
export * from './dto';
export * from './envelope';
export * from './contract';
