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
  GetColorPaletteQuery,
  GetGarmentsByCategoryQuery,
  GetOutfitSuggestionsQuery,
  GetStyleAnalysisQuery,
  GetWardrobeQuery,
  RecommendOutfitsQuery,
  RemoveGarmentCommand,
  UpdateGarmentCommand,
  toId,
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
import { toCreateGarmentInput, toGarmentCategory, toOccasion, toSeason } from '../mappers/fromPayload';
import {
  colorsToPaletteDto,
  collectionToDto,
  garmentToDto,
  recommendationSetToDto,
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
    const result = await queries.ask(
      new GetGarmentsByCategoryQuery(toGarmentCategory(category)),
    );
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
