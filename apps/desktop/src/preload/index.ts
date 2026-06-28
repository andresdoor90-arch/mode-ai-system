/**
 * Preload bridge.
 *
 * Exposes a minimal, explicitly-allowlisted, strongly-typed API to the renderer
 * over the context bridge. The renderer has no access to `ipcRenderer`, Node or
 * Electron internals — it can only call the functions published here, each of
 * which forwards to a single known IPC channel and returns the structured
 * {@link IpcResponse} envelope.
 *
 * Adding a capability to the UI therefore requires adding it here and in the
 * main-process handler registry, keeping the surface deliberately small and
 * auditable.
 */
import { contextBridge, ipcRenderer } from 'electron';

import {
  IpcChannels,
  type AddGarmentPayload,
  type AiStatusDTO,
  type AppInfoDTO,
  type ColorPaletteDTO,
  type GarmentDTO,
  type IpcResponse,
  type OutfitSuggestionDTO,
  type RecommendationRequestPayload,
  type RecommendationSetDTO,
  type StyleAnalysisDTO,
  type SuggestionsPayload,
  type UpdateGarmentPayload,
  type WardrobeViewDTO,
} from '../shared/ipc';

function invoke<T>(channel: string, payload?: unknown): Promise<IpcResponse<T>> {
  return ipcRenderer.invoke(channel, payload) as Promise<IpcResponse<T>>;
}

/**
 * The full API surface exposed on `window.mas`. Grouped by domain for
 * discoverability. Every method returns an `IpcResponse` so the renderer
 * handles success and failure explicitly.
 */
const api = {
  app: {
    getInfo: (): Promise<IpcResponse<AppInfoDTO>> => invoke(IpcChannels.appGetInfo),
  },
  wardrobe: {
    get: (): Promise<IpcResponse<WardrobeViewDTO>> => invoke(IpcChannels.wardrobeGet),
    garmentsByCategory: (category: string): Promise<IpcResponse<readonly GarmentDTO[]>> =>
      invoke(IpcChannels.wardrobeGarmentsByCategory, { category }),
    seasonal: (season: string): Promise<IpcResponse<readonly GarmentDTO[]>> =>
      invoke(IpcChannels.wardrobeSeasonal, { season }),
  },
  garments: {
    add: (payload: AddGarmentPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentAdd, payload),
    update: (payload: UpdateGarmentPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentUpdate, payload),
    remove: (id: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentRemove, { id }),
  },
  outfits: {
    suggestions: (
      payload: SuggestionsPayload,
    ): Promise<IpcResponse<readonly OutfitSuggestionDTO[]>> =>
      invoke(IpcChannels.outfitSuggestions, payload),
  },
  ai: {
    recommend: (
      payload: RecommendationRequestPayload,
    ): Promise<IpcResponse<RecommendationSetDTO>> => invoke(IpcChannels.aiRecommend, payload),
    status: (): Promise<IpcResponse<AiStatusDTO>> => invoke(IpcChannels.aiStatus),
  },
  style: {
    analysis: (): Promise<IpcResponse<StyleAnalysisDTO>> => invoke(IpcChannels.styleAnalysis),
    colorPalette: (): Promise<IpcResponse<ColorPaletteDTO>> =>
      invoke(IpcChannels.styleColorPalette),
  },
  transfer: {
    export: (): Promise<IpcResponse<{ json: string }>> => invoke(IpcChannels.transferExport),
    import: (json: string): Promise<IpcResponse<{ imported: number }>> =>
      invoke(IpcChannels.transferImport, { json }),
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
