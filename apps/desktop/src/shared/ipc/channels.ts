/**
 * Canonical IPC channel names.
 *
 * A single source of truth shared by the main process (which registers
 * handlers), the preload bridge (which forwards calls) and the renderer (which
 * invokes them through the typed client). Using `const` channel identifiers
 * instead of free-form strings keeps the three sides in lock-step and lets
 * TypeScript catch typos at compile time.
 *
 * Naming convention: `<domain>:<action>`.
 */
export const IpcChannels = {
  /* ----------------------------- application ----------------------------- */
  appGetInfo: 'app:getInfo',

  /* ------------------------------- profile ------------------------------- */
  profileGet: 'profile:get',
  profileCreate: 'profile:create',
  profileRename: 'profile:rename',

  /* ------------------------------- wardrobe ------------------------------ */
  wardrobeGet: 'wardrobe:get',
  wardrobeGarmentsByCategory: 'wardrobe:garmentsByCategory',
  wardrobeSeasonal: 'wardrobe:seasonal',
  wardrobeSearch: 'wardrobe:search',

  /* ------------------------------ categories ----------------------------- */
  categoryList: 'category:list',
  categoryTree: 'category:tree',
  categoryCreate: 'category:create',
  categoryUpdate: 'category:update',
  categoryReorder: 'category:reorder',
  categoryDelete: 'category:delete',

  /* ------------------------------- garments ------------------------------ */
  garmentAdd: 'garment:add',
  garmentUpdate: 'garment:update',
  garmentRemove: 'garment:remove',
  garmentDuplicate: 'garment:duplicate',
  garmentArchive: 'garment:archive',
  garmentRestore: 'garment:restore',

  /* -------------------------------- photos ------------------------------- */
  photosAdd: 'garment:photos:add',
  photoRemove: 'garment:photos:remove',
  photosReorder: 'garment:photos:reorder',
  photoTransform: 'garment:photos:transform',

  /* ------------------------------- tagging ------------------------------- */
  tagsSuggest: 'garment:tags:suggest',
  tagsConfirm: 'garment:tags:confirm',

  /* ---------------------------- images / vision -------------------------- */
  imageSave: 'image:save',
  garmentAnalyze: 'garment:analyze',

  /* ------------------------------- outfits ------------------------------- */
  outfitSuggestions: 'outfit:suggestions',

  /* ----------------------------- ai / engine ----------------------------- */
  aiRecommend: 'ai:recommend',
  aiStatus: 'ai:status',

  /* --------------------------- outfit history ---------------------------- */
  historySearch: 'history:search',
  historyStatistics: 'history:statistics',
  historyRecentRepetitions: 'history:recentRepetitions',
  historyGarment: 'history:garment',
  historyRecordUsage: 'history:recordUsage',
  historyRecordFeedback: 'history:recordFeedback',
  historyRepeat: 'history:repeat',
  historyAnnotate: 'history:annotate',

  /* -------------------------------- style -------------------------------- */
  styleAnalysis: 'style:analysis',
  styleColorPalette: 'style:colorPalette',

  /* ------------------------------- transfer ------------------------------ */
  transferImport: 'transfer:import',
  transferExport: 'transfer:export',
} as const;

/** Union of every valid IPC channel string. */
export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** All channel names as a readonly array (useful for validation/allowlists). */
export const ALL_IPC_CHANNELS: readonly IpcChannel[] = Object.freeze(Object.values(IpcChannels));

/** Type guard: is `value` a known IPC channel? */
export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === 'string' && (ALL_IPC_CHANNELS as readonly string[]).includes(value);
}
