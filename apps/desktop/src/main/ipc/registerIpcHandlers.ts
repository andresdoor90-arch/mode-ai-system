/**
 * IPC handler registry (main process).
 *
 * Binds each channel from the shared contract to a handler that delegates to
 * the application layer (Command/Query buses) and returns a serialisable
 * {@link IpcResponse}. This is the trust boundary: the renderer can only reach
 * the domain through these explicitly-registered, typed channels.
 *
 * Flow per call:  renderer → preload → ipcMain.handle → Command/QueryBus →
 * use case → repository.  Errors (domain or coercion) are converted to a
 * structured failure envelope; handlers never throw across the boundary.
 */
import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';

import {
  AddGarmentCommand,
  AddPhotosCommand,
  AnnotateOutfitHistoryCommand,
  ArchiveGarmentCommand,
  ConfirmGarmentTagsCommand,
  CreateCategoryCommand,
  CreateProfileCommand,
  Color,
  DeleteCategoryCommand,
  DuplicateGarmentCommand,
  GetCategoriesQuery,
  GetCategoryTreeQuery,
  GetColorPaletteQuery,
  GetGarmentsByCategoryQuery,
  GetGarmentUsageHistoryQuery,
  GetOutfitHistoryStatisticsQuery,
  GetOutfitSuggestionsQuery,
  GetRecentRepetitionsQuery,
  GetStyleAnalysisQuery,
  GetWardrobeQuery,
  GetCurrentProfileQuery,
  RecommendOutfitsQuery,
  RecordOutfitFeedbackCommand,
  RecordOutfitUsageCommand,
  RemovePhotoCommand,
  RemoveGarmentCommand,
  RepeatOutfitCommand,
  ReorderCategoriesCommand,
  ReorderPhotosCommand,
  RestoreGarmentCommand,
  SearchGarmentsQuery,
  SearchOutfitHistoryQuery,
  SuggestGarmentTagsQuery,
  TransformPhotoCommand,
  UpdateCategoryCommand,
  UpdateGarmentCommand,
  UpdateProfileCommand,
  toId,
  type CategoryId,
  type OutfitUsageContext,
} from '@mas/core';

import {
  IpcChannels,
  fromResult,
  ipcFailure,
  ipcSuccess,
  toIpcError,
  type GarmentStatusDTO,
  type IpcResponse,
  type IpcChannel,
} from '../../shared/ipc';
import type { AppContainer } from '../container/AppContainer';
import { toCreateGarmentInput, toOccasion, toSeason } from '../mappers/fromPayload';
import {
  categoryToDto,
  colorsToPaletteDto,
  collectionToDto,
  garmentToDto,
  outfitHistoryPageToDto,
  outfitHistoryStatisticsToDto,
  recommendationSetToDto,
  repetitionGroupToDto,
} from '../mappers/toDto';

/** Wrap an async handler so any thrown error becomes a failure envelope. */
function handle<TResponse>(
  channel: IpcChannel,
  handler: (event: IpcMainInvokeEvent, payload: unknown) => Promise<IpcResponse<TResponse>>,
): void {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    try {
      return await handler(event, payload);
    } catch (error) {
      return ipcFailure(toIpcError(error));
    }
  });
}

/**
 * Register every IPC handler against the supplied container. Call once, after
 * the container is built and before the first window loads.
 */
export function registerIpcHandlers(container: AppContainer): void {
  const { commands, queries } = container;

  /* ------------------------------ application ----------------------------- */
  handle(IpcChannels.appGetInfo, async () =>
    ipcSuccess({
      name: 'Mode AI System',
      version: app.getVersion(),
      platform: process.platform,
      versions: {
        node: process.versions.node,
        chrome: process.versions.chrome ?? '',
        electron: process.versions.electron ?? '',
      },
    }),
  );

  /* -------------------------------- profile ------------------------------- */
  handle(IpcChannels.profileGet, async () => {
    const result = await queries.ask(new GetCurrentProfileQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    const profile = result.value;
    return ipcSuccess(profile === null ? null : { id: String(profile.id), name: profile.name });
  });

  handle(IpcChannels.profileCreate, async (_event, payload) => {
    const { name } = payload as { name: string };
    const result = await commands.send(new CreateProfileCommand({ name }));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: String(result.value), name: name.trim() });
  });

  handle(IpcChannels.profileRename, async (_event, payload) => {
    const { name } = payload as { name: string };
    const result = await commands.send(new UpdateProfileCommand({ name }));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ ok: true as const });
  });

  /* -------------------------------- wardrobe ------------------------------ */
  handle(IpcChannels.wardrobeGet, async () => {
    const result = await queries.ask(new GetWardrobeQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({
      garments: result.value.garments.map(garmentToDto),
      collections: result.value.collections.map(collectionToDto),
    });
  });

  handle(IpcChannels.wardrobeGarmentsByCategory, async (_event, payload) => {
    const { category } = payload as { category: string };
    const result = await queries.ask(new GetGarmentsByCategoryQuery(category));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(result.value.map(garmentToDto));
  });

  handle(IpcChannels.wardrobeSeasonal, async (_event, payload) => {
    const { season } = payload as { season: string };
    const { GetSeasonalWardrobeQuery } = await import('@mas/core');
    const result = await queries.ask(new GetSeasonalWardrobeQuery(toSeason(season)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(result.value.map(garmentToDto));
  });

  /* -------------------------------- garments ------------------------------ */
  handle(IpcChannels.garmentAdd, async (_event, payload) => {
    const input = toCreateGarmentInput(payload as never);
    const result = await commands.send(new AddGarmentCommand(input));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: String(result.value) });
  });

  handle(IpcChannels.garmentUpdate, async (_event, payload) => {
    const p = payload as {
      id: string;
      name?: string;
      colorHex?: string;
      colorName?: string;
      tags?: readonly string[];
      status?: GarmentStatusDTO;
    };
    const result = await commands.send(
      new UpdateGarmentCommand({
        id: toId<'Garment'>(p.id),
        ...(p.name !== undefined ? { name: p.name } : {}),
        ...(p.tags !== undefined ? { tags: [...p.tags] } : {}),
        ...(p.status !== undefined ? { status: p.status as never } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: p.id });
  });

  handle(IpcChannels.garmentRemove, async (_event, payload) => {
    const { id } = payload as { id: string };
    const result = await commands.send(new RemoveGarmentCommand(toId<'Garment'>(id)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id });
  });

  handle(IpcChannels.garmentDuplicate, async (_event, payload) => {
    const { id, name } = payload as { id: string; name?: string };
    const result = await commands.send(new DuplicateGarmentCommand(toId<'Garment'>(id), name));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: String(result.value) });
  });

  handle(IpcChannels.garmentArchive, async (_event, payload) => {
    const { id } = payload as { id: string };
    const result = await commands.send(new ArchiveGarmentCommand(toId<'Garment'>(id)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id });
  });

  handle(IpcChannels.garmentRestore, async (_event, payload) => {
    const { id } = payload as { id: string };
    const result = await commands.send(new RestoreGarmentCommand(toId<'Garment'>(id)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id });
  });

  handle(IpcChannels.wardrobeSearch, async (_event, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    const result = await queries.ask(
      new SearchGarmentsQuery({
        ...(typeof p.text === 'string' ? { text: p.text } : {}),
        ...(typeof p.category === 'string' ? { category: p.category } : {}),
        ...(typeof p.subcategory === 'string' ? { subcategory: p.subcategory } : {}),
        ...(typeof p.status === 'string' ? { status: p.status as never } : {}),
        ...(typeof p.season === 'string' ? { season: toSeason(p.season) } : {}),
        ...(Array.isArray(p.tags) ? { tags: p.tags as string[] } : {}),
        ...(typeof p.includeArchived === 'boolean' ? { includeArchived: p.includeArchived } : {}),
        ...(typeof p.sortBy === 'string' ? { sortBy: p.sortBy as never } : {}),
        ...(typeof p.sortDirection === 'string' ? { sortDirection: p.sortDirection as never } : {}),
        ...(typeof p.page === 'number' ? { page: p.page } : {}),
        ...(typeof p.pageSize === 'number' ? { pageSize: p.pageSize } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({
      items: result.value.items.map(garmentToDto),
      total: result.value.total,
      page: result.value.page,
      totalPages: result.value.totalPages,
    });
  });

  /* ------------------------------ categories ------------------------------ */
  handle(IpcChannels.categoryList, async () => {
    const result = await queries.ask(new GetCategoriesQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(result.value.map(categoryToDto));
  });

  handle(IpcChannels.categoryTree, async () => {
    const result = await queries.ask(new GetCategoryTreeQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(
      result.value.map((node) => ({
        category: categoryToDto(node.category),
        children: node.children.map(categoryToDto),
      })),
    );
  });

  handle(IpcChannels.categoryCreate, async (_event, payload) => {
    const p = payload as {
      name: string;
      parentId?: string | null;
      group?: string | null;
      metadata?: Record<string, unknown>;
    };
    const result = await commands.send(
      new CreateCategoryCommand({
        name: p.name,
        ...(p.parentId != null ? { parentId: toId<'Category'>(p.parentId) } : {}),
        ...(p.group !== undefined ? { group: p.group } : {}),
        ...(p.metadata !== undefined ? { metadata: p.metadata as never } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: String(result.value) });
  });

  handle(IpcChannels.categoryUpdate, async (_event, payload) => {
    const p = payload as {
      id: string;
      name?: string;
      group?: string | null;
      parentId?: string | null;
      metadata?: Record<string, unknown>;
    };
    const result = await commands.send(
      new UpdateCategoryCommand({
        id: toId<'Category'>(p.id),
        ...(p.name !== undefined ? { name: p.name } : {}),
        ...(p.group !== undefined ? { group: p.group } : {}),
        ...(p.parentId !== undefined
          ? { parentId: p.parentId === null ? null : toId<'Category'>(p.parentId) }
          : {}),
        ...(p.metadata !== undefined ? { metadata: p.metadata as never } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: p.id });
  });

  handle(IpcChannels.categoryReorder, async (_event, payload) => {
    const { orderedIds } = payload as { orderedIds: readonly string[] };
    const result = await commands.send(
      new ReorderCategoriesCommand(orderedIds.map((id) => toId<'Category'>(id))),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ ok: true as const });
  });

  handle(IpcChannels.categoryDelete, async (_event, payload) => {
    const { id } = payload as { id: string };
    const result = await commands.send(new DeleteCategoryCommand(toId<'Category'>(id)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id });
  });

  /* -------------------------------- photos -------------------------------- */
  handle(IpcChannels.photosAdd, async (_event, payload) => {
    const p = payload as { garmentId: string; photos: readonly { storageKey: string }[] };
    const result = await commands.send(
      new AddPhotosCommand(
        toId<'Garment'>(p.garmentId),
        p.photos.map((ph) => ({ storageKey: ph.storageKey })),
      ),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ photoIds: result.value.map(String) });
  });

  handle(IpcChannels.photoRemove, async (_event, payload) => {
    const p = payload as { garmentId: string; photoId: string };
    const result = await commands.send(
      new RemovePhotoCommand(toId<'Garment'>(p.garmentId), toId<'Photo'>(p.photoId)),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ ok: true as const });
  });

  handle(IpcChannels.photosReorder, async (_event, payload) => {
    const p = payload as { garmentId: string; orderedPhotoIds: readonly string[] };
    const result = await commands.send(
      new ReorderPhotosCommand(
        toId<'Garment'>(p.garmentId),
        p.orderedPhotoIds.map((id) => toId<'Photo'>(id)),
      ),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ ok: true as const });
  });

  handle(IpcChannels.photoTransform, async (_event, payload) => {
    const p = payload as {
      garmentId: string;
      photoId: string;
      rotation?: number;
      crop?: { x: number; y: number; width: number; height: number };
      setPrimary?: boolean;
    };
    const result = await commands.send(
      new TransformPhotoCommand({
        garmentId: toId<'Garment'>(p.garmentId),
        photoId: toId<'Photo'>(p.photoId),
        ...(p.rotation !== undefined ? { rotation: p.rotation as never } : {}),
        ...(p.crop !== undefined ? { crop: p.crop } : {}),
        ...(p.setPrimary !== undefined ? { setPrimary: p.setPrimary } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ ok: true as const });
  });

  /* ------------------------------- tagging -------------------------------- */
  handle(IpcChannels.tagsSuggest, async (_event, payload) => {
    const p = payload as {
      garmentId: string;
      colorSamples?: readonly { r: number; g: number; b: number; weight?: number }[];
    };
    const result = await queries.ask(
      new SuggestGarmentTagsQuery(toId<'Garment'>(p.garmentId), p.colorSamples),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    const s = result.value;
    return ipcSuccess({
      source: s.source,
      unavailable: s.unavailable,
      category: s.category?.value ?? null,
      subcategory: s.subcategory?.value ?? null,
      colors: s.colors?.value ?? [],
      season: s.season?.value ?? null,
      material: s.material?.value ?? null,
      formality: s.formality?.value ?? null,
    });
  });

  handle(IpcChannels.tagsConfirm, async (_event, payload) => {
    const p = payload as {
      garmentId: string;
      category?: string;
      subcategory?: string;
      categoryId?: string;
      primaryColorHex?: string;
      secondaryColorHexes?: readonly string[];
      material?: string;
      seasons?: readonly string[];
      tags?: readonly string[];
    };
    const primary = p.primaryColorHex !== undefined ? Color.fromHex(p.primaryColorHex) : undefined;
    if (primary !== undefined && !primary.ok) {
      return ipcFailure(toIpcError(primary.error));
    }
    const secondaries = (p.secondaryColorHexes ?? [])
      .map((hex) => Color.fromHex(hex))
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => r.value);
    const result = await commands.send(
      new ConfirmGarmentTagsCommand({
        garmentId: toId<'Garment'>(p.garmentId),
        ...(p.category !== undefined ? { category: p.category } : {}),
        ...(p.subcategory !== undefined ? { subcategory: p.subcategory } : {}),
        ...(p.categoryId !== undefined ? { categoryId: p.categoryId as CategoryId } : {}),
        ...(primary !== undefined && primary.ok ? { primaryColor: primary.value } : {}),
        ...(secondaries.length > 0 ? { secondaryColors: secondaries } : {}),
        ...(p.material !== undefined ? { material: p.material } : {}),
        ...(p.seasons !== undefined ? { seasons: p.seasons.map(toSeason) } : {}),
        ...(p.tags !== undefined ? { tags: p.tags } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: p.garmentId });
  });

  /* -------------------------------- outfits ------------------------------- */
  handle(IpcChannels.outfitSuggestions, async (_event, payload) => {
    const p = payload as { occasion: string; season: string; limit?: number };
    const result = await queries.ask(
      new GetOutfitSuggestionsQuery({
        occasion: toOccasion(p.occasion),
        season: toSeason(p.season),
        ...(p.limit !== undefined ? { limit: p.limit } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(
      result.value.map((s) => ({ garments: s.garments.map(garmentToDto), score: s.score })),
    );
  });

  /* ------------------------------ ai / engine ----------------------------- */
  handle(IpcChannels.aiRecommend, async (_event, payload) => {
    const p = payload as {
      message?: string;
      occasion?: string;
      season?: string;
      referenceDate?: string;
    };
    const result = await queries.ask(
      new RecommendOutfitsQuery({
        message: p.message ?? '',
        ...(p.occasion !== undefined ? { occasion: toOccasion(p.occasion) } : {}),
        ...(p.season !== undefined ? { season: toSeason(p.season) } : {}),
        ...(p.referenceDate !== undefined ? { referenceDate: p.referenceDate } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(recommendationSetToDto(result.value));
  });

  handle(IpcChannels.aiStatus, async () => ipcSuccess(await container.aiStatus()));

  /* ------------------------------ outfit history -------------------------- */

  /** Build a domain usage context from the optional IPC context payload. */
  const toUsageContext = (raw?: {
    wornOn?: string;
    time?: string;
    place?: string;
    event?: string;
    occasion?: string;
    weather?: string;
    temperatureC?: number;
    role?: string;
    comments?: string;
    satisfaction?: number;
    label?: string;
  }): OutfitUsageContext => {
    const c = raw ?? {};
    return {
      ...(c.wornOn !== undefined ? { wornOn: c.wornOn } : {}),
      ...(c.time !== undefined ? { time: c.time } : {}),
      ...(c.place !== undefined ? { place: c.place } : {}),
      ...(c.event !== undefined ? { event: c.event } : {}),
      ...(c.occasion !== undefined ? { occasion: toOccasion(c.occasion) } : {}),
      ...(c.weather !== undefined ? { weather: c.weather } : {}),
      ...(c.temperatureC !== undefined ? { temperatureC: c.temperatureC } : {}),
      ...(c.role !== undefined ? { role: c.role } : {}),
      ...(c.comments !== undefined ? { comments: c.comments } : {}),
      ...(c.satisfaction !== undefined ? { satisfaction: c.satisfaction } : {}),
      ...(c.label !== undefined ? { label: c.label } : {}),
    };
  };

  handle(IpcChannels.historySearch, async (_event, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    const result = await queries.ask(
      new SearchOutfitHistoryQuery({
        filter: {
          ...(typeof p.text === 'string' ? { text: p.text } : {}),
          ...(typeof p.role === 'string' ? { role: p.role } : {}),
          ...(typeof p.event === 'string' ? { event: p.event } : {}),
          ...(typeof p.place === 'string' ? { place: p.place } : {}),
          ...(typeof p.occasion === 'string' ? { occasion: toOccasion(p.occasion) } : {}),
          ...(typeof p.source === 'string' ? { source: p.source as never } : {}),
          ...(typeof p.minSatisfaction === 'number' ? { minSatisfaction: p.minSatisfaction } : {}),
          ...(typeof p.from === 'string' ? { from: p.from } : {}),
          ...(typeof p.to === 'string' ? { to: p.to } : {}),
        },
        ...(typeof p.sortBy === 'string'
          ? {
              sort: {
                by: p.sortBy as never,
                direction: (p.sortDirection as 'asc' | 'desc') ?? 'desc',
              },
            }
          : {}),
        ...(typeof p.page === 'number' ? { page: p.page } : {}),
        ...(typeof p.pageSize === 'number' ? { pageSize: p.pageSize } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(outfitHistoryPageToDto(result.value));
  });

  handle(IpcChannels.historyStatistics, async () => {
    const result = await queries.ask(new GetOutfitHistoryStatisticsQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(outfitHistoryStatisticsToDto(result.value));
  });

  handle(IpcChannels.historyRecentRepetitions, async (_event, payload) => {
    const { window } = (payload ?? {}) as { window?: number };
    const result = await queries.ask(new GetRecentRepetitionsQuery(window));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(result.value.map(repetitionGroupToDto));
  });

  handle(IpcChannels.historyGarment, async (_event, payload) => {
    const { garmentId } = payload as { garmentId: string };
    const result = await queries.ask(new GetGarmentUsageHistoryQuery(toId<'Garment'>(garmentId)));
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(outfitHistoryPageToDto(result.value));
  });

  handle(IpcChannels.historyRecordUsage, async (_event, payload) => {
    const p = payload as { garmentIds: readonly string[]; context?: Record<string, unknown> };
    const result = await commands.send(
      new RecordOutfitUsageCommand(
        p.garmentIds.map((id) => toId<'Garment'>(id)),
        toUsageContext(p.context as never),
      ),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: String(result.value) });
  });

  handle(IpcChannels.historyRecordFeedback, async (_event, payload) => {
    const p = payload as {
      garmentIds: readonly string[];
      accepted: boolean;
      context?: Record<string, unknown>;
    };
    const result = await commands.send(
      new RecordOutfitFeedbackCommand({
        garmentIds: p.garmentIds.map((id) => toId<'Garment'>(id)),
        accepted: p.accepted,
        context: toUsageContext(p.context as never),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({
      historyEntryId: result.value.historyEntryId ? String(result.value.historyEntryId) : null,
      accepted: result.value.accepted,
    });
  });

  handle(IpcChannels.historyRepeat, async (_event, payload) => {
    const p = payload as { entryId: string; context?: Record<string, unknown> };
    const result = await commands.send(
      new RepeatOutfitCommand({
        entryId: toId<'OutfitHistoryEntry'>(p.entryId),
        context: toUsageContext(p.context as never),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({
      historyEntryId: String(result.value.historyEntryId),
      garmentIds: result.value.garmentIds.map(String),
    });
  });

  handle(IpcChannels.historyAnnotate, async (_event, payload) => {
    const p = payload as {
      entryId: string;
      place?: string | null;
      event?: string | null;
      role?: string | null;
      comments?: string | null;
      label?: string | null;
      satisfaction?: number | null;
    };
    const result = await commands.send(
      new AnnotateOutfitHistoryCommand({
        entryId: toId<'OutfitHistoryEntry'>(p.entryId),
        ...(p.place !== undefined ? { place: p.place } : {}),
        ...(p.event !== undefined ? { event: p.event } : {}),
        ...(p.role !== undefined ? { role: p.role } : {}),
        ...(p.comments !== undefined ? { comments: p.comments } : {}),
        ...(p.label !== undefined ? { label: p.label } : {}),
        ...(p.satisfaction !== undefined ? { satisfaction: p.satisfaction } : {}),
      }),
    );
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess({ id: p.entryId });
  });

  /* --------------------------------- style -------------------------------- */
  handle(IpcChannels.styleAnalysis, async () => {
    const result = await queries.ask(new GetStyleAnalysisQuery());
    return fromResult(result);
  });

  handle(IpcChannels.styleColorPalette, async () => {
    const result = await queries.ask(new GetColorPaletteQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    return ipcSuccess(colorsToPaletteDto(result.value.colors));
  });

  /* ------------------------------- transfer ------------------------------- */
  handle(IpcChannels.transferExport, async () => {
    const result = await queries.ask(new GetWardrobeQuery());
    if (!result.ok) {
      return ipcFailure(toIpcError(result.error));
    }
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      garments: result.value.garments.map(garmentToDto),
    };
    return ipcSuccess({ json: JSON.stringify(bundle, null, 2) });
  });

  handle(IpcChannels.transferImport, async (_event, payload) => {
    const { json } = payload as { json: string };
    let parsed: { garments?: unknown };
    try {
      parsed = JSON.parse(json) as { garments?: unknown };
    } catch {
      return ipcFailure({ name: 'TransferError', message: 'The provided file is not valid JSON.' });
    }
    const garments = Array.isArray(parsed.garments) ? parsed.garments : [];
    let imported = 0;
    for (const raw of garments as Array<Record<string, unknown>>) {
      try {
        const input = toCreateGarmentInput({
          name: String(raw.name ?? ''),
          category: String(raw.category ?? ''),
          subcategory: String(raw.subcategory ?? ''),
          colorHex: String((raw.color as { hex?: string } | undefined)?.hex ?? '#000000'),
          colorName: (raw.color as { name?: string } | undefined)?.name,
          seasons: Array.isArray(raw.seasons) ? (raw.seasons as string[]) : ['all-season'],
          ...(typeof raw.brand === 'string' ? { brand: raw.brand } : {}),
          ...(Array.isArray(raw.tags) ? { tags: raw.tags as string[] } : {}),
        });
        const result = await commands.send(new AddGarmentCommand(input));
        if (result.ok) {
          imported += 1;
        }
      } catch {
        // Skip malformed entries; continue importing the rest.
      }
    }
    return ipcSuccess({ imported });
  });
}

/** Remove all registered handlers (used on full app shutdown / teardown). */
export function unregisterIpcHandlers(): void {
  for (const channel of Object.values(IpcChannels)) {
    ipcMain.removeHandler(channel);
  }
}
