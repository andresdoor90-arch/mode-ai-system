/**
 * Renderer-side IPC client.
 *
 * The single point through which React talks to the main process. It wraps the
 * preload-exposed `window.mas` bridge, unwrapping the {@link IpcResponse}
 * envelope: success values are returned directly, failures are thrown as
 * `IpcClientError` so calling code can use ordinary try/catch (or React Query
 * style hooks). React components import only this module — never Electron,
 * `ipcRenderer`, `@mas/infrastructure` or any domain class.
 */
import type {
  AddGarmentPayload,
  AiStatusDTO,
  AnalyzeGarmentPayload,
  AppInfoDTO,
  CategoryDTO,
  CategoryNodeDTO,
  ColorPaletteDTO,
  CreateCategoryPayload,
  ConfirmTagsPayload,
  GarmentAnalysisResultDTO,
  GarmentDTO,
  GarmentSearchPayload,
  ImageDataDTO,
  IpcResponse,
  OutfitSuggestionDTO,
  PhotoTransformPayload,
  RecommendationRequestPayload,
  RecommendationSetDTO,
  ReorderPayload,
  SaveImagePayload,
  SaveImageResultDTO,
  StyleAnalysisDTO,
  SuggestionsPayload,
  TagSuggestionDTO,
  UpdateCategoryPayload,
  UpdateGarmentPayload,
  UserProfileDTO,
  WardrobeViewDTO,
} from '@shared/ipc';

/** Error thrown when an IPC call returns a failure envelope. */
export class IpcClientError extends Error {
  public readonly code: string | undefined;
  public constructor(name: string, message: string, code?: string) {
    super(message);
    this.name = name;
    this.code = code;
  }
}

/** Whether the preload bridge is present (false in plain unit-test DOMs). */
export function isBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.mas !== 'undefined';
}

async function unwrap<T>(promise: Promise<IpcResponse<T>>): Promise<T> {
  const response = await promise;
  if (response.ok) {
    return response.value;
  }
  throw new IpcClientError(response.error.name, response.error.message, response.error.code);
}

function bridge(): Window['mas'] {
  if (!isBridgeAvailable()) {
    throw new IpcClientError(
      'BridgeUnavailableError',
      'The desktop bridge is not available in this context.',
    );
  }
  return window.mas;
}

/** Typed, promise-returning facade over the IPC bridge. */
export const ipc = {
  getAppInfo: (): Promise<AppInfoDTO> => unwrap(bridge().app.getInfo()),

  /* ------------------------------- profile ------------------------------- */
  getProfile: (): Promise<UserProfileDTO | null> => unwrap(bridge().profile.get()),
  createProfile: (name: string): Promise<UserProfileDTO> => unwrap(bridge().profile.create(name)),
  renameProfile: (name: string): Promise<{ ok: true }> => unwrap(bridge().profile.rename(name)),

  getWardrobe: (): Promise<WardrobeViewDTO> => unwrap(bridge().wardrobe.get()),
  getGarmentsByCategory: (category: string): Promise<readonly GarmentDTO[]> =>
    unwrap(bridge().wardrobe.garmentsByCategory(category)),
  getSeasonalGarments: (season: string): Promise<readonly GarmentDTO[]> =>
    unwrap(bridge().wardrobe.seasonal(season)),

  addGarment: (payload: AddGarmentPayload): Promise<{ id: string }> =>
    unwrap(bridge().garments.add(payload)),
  updateGarment: (payload: UpdateGarmentPayload): Promise<{ id: string }> =>
    unwrap(bridge().garments.update(payload)),
  removeGarment: (id: string): Promise<{ id: string }> => unwrap(bridge().garments.remove(id)),
  duplicateGarment: (id: string, name?: string): Promise<{ id: string }> =>
    unwrap(bridge().garments.duplicate(id, name)),
  archiveGarment: (id: string): Promise<{ id: string }> => unwrap(bridge().garments.archive(id)),
  restoreGarment: (id: string): Promise<{ id: string }> => unwrap(bridge().garments.restore(id)),

  searchGarments: (
    payload: GarmentSearchPayload,
  ): Promise<{ items: readonly GarmentDTO[]; total: number; page: number; totalPages: number }> =>
    unwrap(bridge().wardrobe.search(payload)),

  /* ------------------------------ categories ----------------------------- */
  listCategories: (): Promise<readonly CategoryDTO[]> => unwrap(bridge().categories.list()),
  getCategoryTree: (): Promise<readonly CategoryNodeDTO[]> => unwrap(bridge().categories.tree()),
  createCategory: (payload: CreateCategoryPayload): Promise<{ id: string }> =>
    unwrap(bridge().categories.create(payload)),
  updateCategory: (payload: UpdateCategoryPayload): Promise<{ id: string }> =>
    unwrap(bridge().categories.update(payload)),
  reorderCategories: (payload: ReorderPayload): Promise<{ ok: true }> =>
    unwrap(bridge().categories.reorder(payload)),
  removeCategory: (id: string): Promise<{ id: string }> => unwrap(bridge().categories.remove(id)),

  /* -------------------------------- photos ------------------------------- */
  addPhotos: (
    garmentId: string,
    photos: readonly { storageKey: string; attributes?: Readonly<Record<string, string>> }[],
  ): Promise<{ photoIds: readonly string[] }> => unwrap(bridge().photos.add(garmentId, photos)),
  removePhoto: (garmentId: string, photoId: string): Promise<{ ok: true }> =>
    unwrap(bridge().photos.remove(garmentId, photoId)),
  reorderPhotos: (garmentId: string, orderedPhotoIds: readonly string[]): Promise<{ ok: true }> =>
    unwrap(bridge().photos.reorder(garmentId, orderedPhotoIds)),
  transformPhoto: (payload: PhotoTransformPayload): Promise<{ ok: true }> =>
    unwrap(bridge().photos.transform(payload)),

  /* --------------------------- images / vision --------------------------- */
  saveImage: (payload: SaveImagePayload): Promise<SaveImageResultDTO> =>
    unwrap(bridge().images.save(payload)),
  getImage: (key: string): Promise<ImageDataDTO> => unwrap(bridge().images.get(key)),
  analyzeGarment: (payload: AnalyzeGarmentPayload): Promise<GarmentAnalysisResultDTO> =>
    unwrap(bridge().analysis.analyze(payload)),

  /* ------------------------------- tagging ------------------------------- */
  suggestTags: (
    garmentId: string,
    colorSamples?: readonly { r: number; g: number; b: number; weight?: number }[],
  ): Promise<TagSuggestionDTO> => unwrap(bridge().tags.suggest(garmentId, colorSamples)),
  confirmTags: (payload: ConfirmTagsPayload): Promise<{ id: string }> =>
    unwrap(bridge().tags.confirm(payload)),

  getOutfitSuggestions: (payload: SuggestionsPayload): Promise<readonly OutfitSuggestionDTO[]> =>
    unwrap(bridge().outfits.suggestions(payload)),

  getRecommendations: (payload: RecommendationRequestPayload): Promise<RecommendationSetDTO> =>
    unwrap(bridge().ai.recommend(payload)),
  getAiStatus: (): Promise<AiStatusDTO> => unwrap(bridge().ai.status()),

  getStyleAnalysis: (): Promise<StyleAnalysisDTO> => unwrap(bridge().style.analysis()),
  getColorPalette: (): Promise<ColorPaletteDTO> => unwrap(bridge().style.colorPalette()),

  exportWardrobe: (): Promise<{ json: string }> => unwrap(bridge().transfer.export()),
  importWardrobe: (json: string): Promise<{ imported: number }> =>
    unwrap(bridge().transfer.import(json)),

  /**
   * Record that the user liked (accepted) or disliked (rejected) a recommended
   * outfit. This feeds the preference MemoryEngine the advisor uses, so future
   * recommendations learn from the choice.
   */
  recordOutfitFeedback: (
    garmentIds: readonly string[],
    accepted: boolean,
  ): Promise<{ historyEntryId: string | null; accepted: boolean }> =>
    unwrap(bridge().history.recordFeedback({ garmentIds, accepted })),
} as const;
