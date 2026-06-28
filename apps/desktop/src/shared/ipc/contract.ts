/**
 * The strongly-typed IPC contract.
 *
 * `IpcContract` maps every channel to its request payload and response value.
 * Both the main-process handler registry and the renderer-side client are typed
 * against this single map, so a mismatch between what the renderer sends and
 * what the main process expects becomes a compile-time error.
 */
import { IpcChannels } from './channels';
import type {
  AddGarmentPayload,
  AiStatusDTO,
  AppInfoDTO,
  CategoryPayload,
  ColorPaletteDTO,
  GarmentDTO,
  OutfitSuggestionDTO,
  RecommendationRequestPayload,
  RecommendationSetDTO,
  SeasonPayload,
  StyleAnalysisDTO,
  SuggestionsPayload,
  UpdateGarmentPayload,
  WardrobeViewDTO,
} from './dto';

/** `void` request payload marker (channels that take no arguments). */
export type NoPayload = undefined;

/**
 * For each channel: the `request` payload type and the `response` value type
 * (the `T` inside `IpcResponse<T>`).
 */
export interface IpcContract {
  [IpcChannels.appGetInfo]: { request: NoPayload; response: AppInfoDTO };

  [IpcChannels.wardrobeGet]: { request: NoPayload; response: WardrobeViewDTO };
  [IpcChannels.wardrobeGarmentsByCategory]: {
    request: CategoryPayload;
    response: readonly GarmentDTO[];
  };
  [IpcChannels.wardrobeSeasonal]: { request: SeasonPayload; response: readonly GarmentDTO[] };

  [IpcChannels.garmentAdd]: { request: AddGarmentPayload; response: { id: string } };
  [IpcChannels.garmentUpdate]: { request: UpdateGarmentPayload; response: { id: string } };
  [IpcChannels.garmentRemove]: { request: { id: string }; response: { id: string } };

  [IpcChannels.outfitSuggestions]: {
    request: SuggestionsPayload;
    response: readonly OutfitSuggestionDTO[];
  };

  [IpcChannels.aiRecommend]: {
    request: RecommendationRequestPayload;
    response: RecommendationSetDTO;
  };
  [IpcChannels.aiStatus]: { request: NoPayload; response: AiStatusDTO };

  [IpcChannels.styleAnalysis]: { request: NoPayload; response: StyleAnalysisDTO };
  [IpcChannels.styleColorPalette]: { request: NoPayload; response: ColorPaletteDTO };

  [IpcChannels.transferImport]: { request: { json: string }; response: { imported: number } };
  [IpcChannels.transferExport]: { request: NoPayload; response: { json: string } };
}

/** Request payload type for a given channel. */
export type IpcRequest<C extends keyof IpcContract> = IpcContract[C]['request'];

/** Response value type for a given channel. */
export type IpcResult<C extends keyof IpcContract> = IpcContract[C]['response'];
