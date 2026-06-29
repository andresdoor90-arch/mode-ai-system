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
  AnnotateHistoryPayload,
  AppInfoDTO,
  CategoryDTO,
  CategoryNodeDTO,
  CategoryPayload,
  ColorPaletteDTO,
  CreateCategoryPayload,
  GarmentDTO,
  GarmentSearchPayload,
  HistorySearchPayload,
  OutfitHistoryEntryDTO,
  OutfitHistoryPageDTO,
  OutfitHistoryStatisticsDTO,
  OutfitSuggestionDTO,
  PhotoTransformPayload,
  RecommendationRequestPayload,
  RecommendationSetDTO,
  RecordFeedbackPayload,
  RecordUsagePayload,
  RepeatOutfitPayload,
  RepetitionGroupDTO,
  ReorderPayload,
  SeasonPayload,
  StyleAnalysisDTO,
  SuggestionsPayload,
  TagSuggestionDTO,
  ConfirmTagsPayload,
  UpdateCategoryPayload,
  UpdateGarmentPayload,
  UserProfileDTO,
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

  [IpcChannels.profileGet]: { request: NoPayload; response: UserProfileDTO | null };
  [IpcChannels.profileCreate]: { request: { name: string }; response: UserProfileDTO };
  [IpcChannels.profileRename]: { request: { name: string }; response: { ok: true } };

  [IpcChannels.wardrobeGet]: { request: NoPayload; response: WardrobeViewDTO };
  [IpcChannels.wardrobeGarmentsByCategory]: {
    request: CategoryPayload;
    response: readonly GarmentDTO[];
  };
  [IpcChannels.wardrobeSeasonal]: { request: SeasonPayload; response: readonly GarmentDTO[] };
  [IpcChannels.wardrobeSearch]: {
    request: GarmentSearchPayload;
    response: { items: readonly GarmentDTO[]; total: number; page: number; totalPages: number };
  };

  [IpcChannels.categoryList]: { request: NoPayload; response: readonly CategoryDTO[] };
  [IpcChannels.categoryTree]: { request: NoPayload; response: readonly CategoryNodeDTO[] };
  [IpcChannels.categoryCreate]: { request: CreateCategoryPayload; response: { id: string } };
  [IpcChannels.categoryUpdate]: { request: UpdateCategoryPayload; response: { id: string } };
  [IpcChannels.categoryReorder]: { request: ReorderPayload; response: { ok: true } };
  [IpcChannels.categoryDelete]: { request: { id: string }; response: { id: string } };

  [IpcChannels.garmentAdd]: { request: AddGarmentPayload; response: { id: string } };
  [IpcChannels.garmentUpdate]: { request: UpdateGarmentPayload; response: { id: string } };
  [IpcChannels.garmentRemove]: { request: { id: string }; response: { id: string } };
  [IpcChannels.garmentDuplicate]: {
    request: { id: string; name?: string };
    response: { id: string };
  };
  [IpcChannels.garmentArchive]: { request: { id: string }; response: { id: string } };
  [IpcChannels.garmentRestore]: { request: { id: string }; response: { id: string } };

  [IpcChannels.photosAdd]: {
    request: { garmentId: string; photos: readonly { storageKey: string }[] };
    response: { photoIds: readonly string[] };
  };
  [IpcChannels.photoRemove]: {
    request: { garmentId: string; photoId: string };
    response: { ok: true };
  };
  [IpcChannels.photosReorder]: {
    request: { garmentId: string; orderedPhotoIds: readonly string[] };
    response: { ok: true };
  };
  [IpcChannels.photoTransform]: { request: PhotoTransformPayload; response: { ok: true } };

  [IpcChannels.tagsSuggest]: {
    request: {
      garmentId: string;
      colorSamples?: readonly { r: number; g: number; b: number; weight?: number }[];
    };
    response: TagSuggestionDTO;
  };
  [IpcChannels.tagsConfirm]: { request: ConfirmTagsPayload; response: { id: string } };

  [IpcChannels.outfitSuggestions]: {
    request: SuggestionsPayload;
    response: readonly OutfitSuggestionDTO[];
  };

  [IpcChannels.aiRecommend]: {
    request: RecommendationRequestPayload;
    response: RecommendationSetDTO;
  };
  [IpcChannels.aiStatus]: { request: NoPayload; response: AiStatusDTO };

  [IpcChannels.historySearch]: {
    request: HistorySearchPayload;
    response: OutfitHistoryPageDTO;
  };
  [IpcChannels.historyStatistics]: { request: NoPayload; response: OutfitHistoryStatisticsDTO };
  [IpcChannels.historyRecentRepetitions]: {
    request: { window?: number };
    response: readonly RepetitionGroupDTO[];
  };
  [IpcChannels.historyGarment]: {
    request: { garmentId: string };
    response: OutfitHistoryPageDTO;
  };
  [IpcChannels.historyRecordUsage]: { request: RecordUsagePayload; response: { id: string } };
  [IpcChannels.historyRecordFeedback]: {
    request: RecordFeedbackPayload;
    response: { historyEntryId: string | null; accepted: boolean };
  };
  [IpcChannels.historyRepeat]: {
    request: RepeatOutfitPayload;
    response: { historyEntryId: string; garmentIds: readonly string[] };
  };
  [IpcChannels.historyAnnotate]: { request: AnnotateHistoryPayload; response: { id: string } };

  [IpcChannels.styleAnalysis]: { request: NoPayload; response: StyleAnalysisDTO };
  [IpcChannels.styleColorPalette]: { request: NoPayload; response: ColorPaletteDTO };

  [IpcChannels.transferImport]: { request: { json: string }; response: { imported: number } };
  [IpcChannels.transferExport]: { request: NoPayload; response: { json: string } };
}

/** Request payload type for a given channel. */
export type IpcRequest<C extends keyof IpcContract> = IpcContract[C]['request'];

/** Response value type for a given channel. */
export type IpcResult<C extends keyof IpcContract> = IpcContract[C]['response'];
