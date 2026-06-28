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
  type CategoryDTO,
  type CategoryNodeDTO,
  type ColorPaletteDTO,
  type CreateCategoryPayload,
  type ConfirmTagsPayload,
  type GarmentDTO,
  type GarmentSearchPayload,
  type IpcResponse,
  type OutfitSuggestionDTO,
  type PhotoTransformPayload,
  type RecommendationRequestPayload,
  type RecommendationSetDTO,
  type ReorderPayload,
  type StyleAnalysisDTO,
  type SuggestionsPayload,
  type TagSuggestionDTO,
  type UpdateCategoryPayload,
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
    search: (
      payload: GarmentSearchPayload,
    ): Promise<
      IpcResponse<{ items: readonly GarmentDTO[]; total: number; page: number; totalPages: number }>
    > => invoke(IpcChannels.wardrobeSearch, payload),
  },
  categories: {
    list: (): Promise<IpcResponse<readonly CategoryDTO[]>> => invoke(IpcChannels.categoryList),
    tree: (): Promise<IpcResponse<readonly CategoryNodeDTO[]>> => invoke(IpcChannels.categoryTree),
    create: (payload: CreateCategoryPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.categoryCreate, payload),
    update: (payload: UpdateCategoryPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.categoryUpdate, payload),
    reorder: (payload: ReorderPayload): Promise<IpcResponse<{ ok: true }>> =>
      invoke(IpcChannels.categoryReorder, payload),
    remove: (id: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.categoryDelete, { id }),
  },
  garments: {
    add: (payload: AddGarmentPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentAdd, payload),
    update: (payload: UpdateGarmentPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentUpdate, payload),
    remove: (id: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentRemove, { id }),
    duplicate: (id: string, name?: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentDuplicate, { id, name }),
    archive: (id: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentArchive, { id }),
    restore: (id: string): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.garmentRestore, { id }),
  },
  photos: {
    add: (
      garmentId: string,
      photos: readonly { storageKey: string }[],
    ): Promise<IpcResponse<{ photoIds: readonly string[] }>> =>
      invoke(IpcChannels.photosAdd, { garmentId, photos }),
    remove: (garmentId: string, photoId: string): Promise<IpcResponse<{ ok: true }>> =>
      invoke(IpcChannels.photoRemove, { garmentId, photoId }),
    reorder: (
      garmentId: string,
      orderedPhotoIds: readonly string[],
    ): Promise<IpcResponse<{ ok: true }>> =>
      invoke(IpcChannels.photosReorder, { garmentId, orderedPhotoIds }),
    transform: (payload: PhotoTransformPayload): Promise<IpcResponse<{ ok: true }>> =>
      invoke(IpcChannels.photoTransform, payload),
  },
  tags: {
    suggest: (
      garmentId: string,
      colorSamples?: readonly { r: number; g: number; b: number; weight?: number }[],
    ): Promise<IpcResponse<TagSuggestionDTO>> =>
      invoke(IpcChannels.tagsSuggest, { garmentId, colorSamples }),
    confirm: (payload: ConfirmTagsPayload): Promise<IpcResponse<{ id: string }>> =>
      invoke(IpcChannels.tagsConfirm, payload),
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
