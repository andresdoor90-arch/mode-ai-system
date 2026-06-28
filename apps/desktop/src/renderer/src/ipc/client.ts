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
  AppInfoDTO,
  ColorPaletteDTO,
  GarmentDTO,
  IpcResponse,
  OutfitSuggestionDTO,
  StyleAnalysisDTO,
  SuggestionsPayload,
  UpdateGarmentPayload,
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

  getOutfitSuggestions: (
    payload: SuggestionsPayload,
  ): Promise<readonly OutfitSuggestionDTO[]> => unwrap(bridge().outfits.suggestions(payload)),

  getStyleAnalysis: (): Promise<StyleAnalysisDTO> => unwrap(bridge().style.analysis()),
  getColorPalette: (): Promise<ColorPaletteDTO> => unwrap(bridge().style.colorPalette()),

  exportWardrobe: (): Promise<{ json: string }> => unwrap(bridge().transfer.export()),
  importWardrobe: (json: string): Promise<{ imported: number }> =>
    unwrap(bridge().transfer.import(json)),
} as const;
