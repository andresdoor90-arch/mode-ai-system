/**
 * Outfit-history use cases (Phase 7 Part B).
 *
 * Records the definitive usage history and exposes the unified accept/feedback
 * path. Accepting an AI recommendation is recorded AUTOMATICALLY here — the same
 * flow that feeds the preference {@link MemoryEngine} also persists an
 * {@link OutfitHistoryEntry}, so the UI never records history directly and the
 * cognitive engine improves from real usage over time.
 */
import {
  type GarmentId,
  type OutfitHistoryEntryId,
  type OutfitId,
} from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { Garment } from '../../domain/entities/Garment';
import {
  OutfitHistoryEntry,
  type OutfitUsageSource,
} from '../../domain/entities/OutfitHistoryEntry';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type IOutfitHistoryRepository } from '../../domain/repositories/IOutfitHistoryRepository';
import { type Occasion } from '../../domain/value-objects/Occasion';
import { type Command, type RequestHandler } from '../bus/types';
import { type MemoryEngine } from '../orchestration/MemoryEngine';

/** Shared, extensible usage context captured for a history entry. */
export interface OutfitUsageContext {
  readonly wornOn?: string;
  readonly time?: string;
  readonly place?: string;
  readonly event?: string;
  readonly occasion?: Occasion;
  readonly weather?: string;
  readonly temperatureC?: number;
  readonly role?: string;
  readonly comments?: string;
  readonly satisfaction?: number;
  readonly label?: string;
  readonly outfitId?: OutfitId;
  readonly attributes?: Record<string, string>;
}

/** Resolve garments by id (NotFound on any miss). */
const resolveGarments = async (
  repo: IGarmentRepository,
  ids: readonly GarmentId[],
): Promise<Result<Garment[], NotFoundError>> => {
  const resolved: Garment[] = [];
  for (const id of ids) {
    const garment = await repo.findById(id);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${id} not found.`) };
    }
    resolved.push(garment);
  }
  return ok(resolved);
};

/** Build + persist a history entry and mark its garments as worn. */
const persistUsage = async (
  history: IOutfitHistoryRepository,
  garments: readonly Garment[],
  garmentIds: readonly GarmentId[],
  source: OutfitUsageSource,
  context: OutfitUsageContext,
  ids: IdGenerator,
  clock: () => string,
  garmentsRepo: IGarmentRepository,
): Promise<Result<OutfitHistoryEntryId, ValidationError>> => {
  const now = clock();
  const wornOn = context.wornOn ?? now.slice(0, 10);
  const id = ids.next<'OutfitHistoryEntry'>();
  const entry = OutfitHistoryEntry.create(id, {
    garmentIds,
    wornOn,
    source,
    createdAt: now,
    ...(context.outfitId !== undefined ? { outfitId: context.outfitId } : {}),
    ...(context.label !== undefined ? { label: context.label } : {}),
    ...(context.time !== undefined ? { time: context.time } : {}),
    ...(context.place !== undefined ? { place: context.place } : {}),
    ...(context.event !== undefined ? { event: context.event } : {}),
    ...(context.occasion !== undefined ? { occasion: context.occasion } : {}),
    ...(context.weather !== undefined ? { weather: context.weather } : {}),
    ...(context.temperatureC !== undefined ? { temperatureC: context.temperatureC } : {}),
    ...(context.role !== undefined ? { role: context.role } : {}),
    ...(context.comments !== undefined ? { comments: context.comments } : {}),
    ...(context.satisfaction !== undefined ? { satisfaction: context.satisfaction } : {}),
    ...(context.attributes !== undefined ? { attributes: context.attributes } : {}),
  });
  if (!entry.ok) {
    return entry;
  }
  await history.save(entry.value);
  // Record the wear on each garment so freshness scoring reflects real usage.
  for (const garment of garments) {
    const worn = garment.markWorn(wornOn);
    if (worn.ok) {
      await garmentsRepo.save(garment);
    }
  }
  return ok(id);
};

/* ------------------------------ RecordOutfitUsage ------------------------- */

export const RECORD_OUTFIT_USAGE = 'history.record-usage';

export class RecordOutfitUsageCommand implements Command<OutfitHistoryEntryId> {
  public readonly type = RECORD_OUTFIT_USAGE;
  public constructor(
    public readonly garmentIds: readonly GarmentId[],
    public readonly context: OutfitUsageContext = {},
    public readonly source: OutfitUsageSource = 'manual',
  ) {}
}

export class RecordOutfitUsageHandler
  implements RequestHandler<RecordOutfitUsageCommand, OutfitHistoryEntryId>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly history: IOutfitHistoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public async handle(
    command: RecordOutfitUsageCommand,
  ): Promise<Result<OutfitHistoryEntryId>> {
    const resolved = await resolveGarments(this.garments, command.garmentIds);
    if (!resolved.ok) {
      return resolved;
    }
    return persistUsage(
      this.history,
      resolved.value,
      command.garmentIds,
      command.source,
      command.context,
      this.ids,
      this.clock,
      this.garments,
    );
  }
}

/* ---------------------------- RecordOutfitFeedback ------------------------ */

export const RECORD_OUTFIT_FEEDBACK = 'history.record-feedback';

export interface OutfitFeedbackInput {
  readonly garmentIds: readonly GarmentId[];
  /** True when the user accepted/wore the recommendation. */
  readonly accepted: boolean;
  /** Usage context recorded when accepted. */
  readonly context?: OutfitUsageContext;
}

export interface OutfitFeedbackResult {
  /** The created history entry id, or null when the recommendation was rejected. */
  readonly historyEntryId: OutfitHistoryEntryId | null;
  readonly accepted: boolean;
}

/**
 * The single accept/feedback path. Feeds the preference {@link MemoryEngine}
 * (so future rankings improve) and, on acceptance, AUTOMATICALLY records the
 * usage in history. Rejection only nudges preferences (no history entry).
 */
export class RecordOutfitFeedbackCommand implements Command<OutfitFeedbackResult> {
  public readonly type = RECORD_OUTFIT_FEEDBACK;
  public constructor(public readonly input: OutfitFeedbackInput) {}
}

export class RecordOutfitFeedbackHandler
  implements RequestHandler<RecordOutfitFeedbackCommand, OutfitFeedbackResult>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly history: IOutfitHistoryRepository,
    private readonly ids: IdGenerator,
    private readonly memory?: MemoryEngine,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public async handle(
    command: RecordOutfitFeedbackCommand,
  ): Promise<Result<OutfitFeedbackResult>> {
    const { garmentIds, accepted, context = {} } = command.input;
    const resolved = await resolveGarments(this.garments, garmentIds);
    if (!resolved.ok) {
      return resolved;
    }

    // Feed the preference memory (the Phase 5 learning path).
    if (this.memory !== undefined) {
      if (accepted) {
        await this.memory.recordAcceptance(resolved.value);
      } else {
        await this.memory.recordRejection(resolved.value);
      }
    }

    if (!accepted) {
      return ok({ historyEntryId: null, accepted: false });
    }

    const recorded = await persistUsage(
      this.history,
      resolved.value,
      garmentIds,
      'accepted-recommendation',
      context,
      this.ids,
      this.clock,
      this.garments,
    );
    if (!recorded.ok) {
      return recorded;
    }
    return ok({ historyEntryId: recorded.value, accepted: true });
  }
}

/* ------------------------------- RepeatOutfit ----------------------------- */

export const REPEAT_OUTFIT = 'history.repeat';

export interface RepeatOutfitInput {
  /** The past history entry to re-issue. */
  readonly entryId: OutfitHistoryEntryId;
  /** Optional fresh context (e.g. a new date/place); defaults to "today". */
  readonly context?: OutfitUsageContext;
}

export interface RepeatOutfitResult {
  readonly historyEntryId: OutfitHistoryEntryId;
  /** Ids of the garments re-issued (the "current selection"). */
  readonly garmentIds: readonly GarmentId[];
}

/**
 * Re-issue a past outfit as a current selection: resolve the past entry's
 * garments (verifying they still exist) and record a fresh usage with
 * `source = 'repeat'`.
 */
export class RepeatOutfitCommand implements Command<RepeatOutfitResult> {
  public readonly type = REPEAT_OUTFIT;
  public constructor(public readonly input: RepeatOutfitInput) {}
}

export class RepeatOutfitHandler
  implements RequestHandler<RepeatOutfitCommand, RepeatOutfitResult>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly history: IOutfitHistoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public async handle(command: RepeatOutfitCommand): Promise<Result<RepeatOutfitResult>> {
    const source = await this.history.findById(command.input.entryId);
    if (source === null) {
      return {
        ok: false,
        error: new NotFoundError(`History entry ${command.input.entryId} not found.`),
      };
    }
    const resolved = await resolveGarments(this.garments, source.garmentIds);
    if (!resolved.ok) {
      return resolved;
    }
    const context: OutfitUsageContext = {
      ...(source.label !== undefined ? { label: source.label } : {}),
      ...(source.occasion !== undefined ? { occasion: source.occasion } : {}),
      ...(source.place !== undefined ? { place: source.place } : {}),
      ...(source.event !== undefined ? { event: source.event } : {}),
      ...(source.role !== undefined ? { role: source.role } : {}),
      ...(command.input.context ?? {}),
    };
    const recorded = await persistUsage(
      this.history,
      resolved.value,
      source.garmentIds,
      'repeat',
      context,
      this.ids,
      this.clock,
      this.garments,
    );
    if (!recorded.ok) {
      return recorded;
    }
    return ok({ historyEntryId: recorded.value, garmentIds: source.garmentIds });
  }
}

/* --------------------------- AnnotateOutfitHistory ------------------------ */

export const ANNOTATE_OUTFIT_HISTORY = 'history.annotate';

export interface AnnotateOutfitHistoryInput {
  readonly entryId: OutfitHistoryEntryId;
  readonly place?: string | null;
  readonly event?: string | null;
  readonly role?: string | null;
  readonly comments?: string | null;
  readonly label?: string | null;
  readonly satisfaction?: number | null;
}

/** Edit the user-editable annotations of an existing history entry. */
export class AnnotateOutfitHistoryCommand implements Command<void> {
  public readonly type = ANNOTATE_OUTFIT_HISTORY;
  public constructor(public readonly input: AnnotateOutfitHistoryInput) {}
}

export class AnnotateOutfitHistoryHandler
  implements RequestHandler<AnnotateOutfitHistoryCommand, void>
{
  public constructor(private readonly history: IOutfitHistoryRepository) {}

  public async handle(command: AnnotateOutfitHistoryCommand): Promise<Result<void>> {
    const entry = await this.history.findById(command.input.entryId);
    if (entry === null) {
      return {
        ok: false,
        error: new NotFoundError(`History entry ${command.input.entryId} not found.`),
      };
    }
    const annotated = entry.annotate({
      ...(command.input.place !== undefined ? { place: command.input.place } : {}),
      ...(command.input.event !== undefined ? { event: command.input.event } : {}),
      ...(command.input.role !== undefined ? { role: command.input.role } : {}),
      ...(command.input.comments !== undefined ? { comments: command.input.comments } : {}),
      ...(command.input.label !== undefined ? { label: command.input.label } : {}),
      ...(command.input.satisfaction !== undefined
        ? { satisfaction: command.input.satisfaction }
        : {}),
    });
    if (!annotated.ok) {
      return annotated;
    }
    await this.history.save(entry);
    return ok(undefined);
  }
}
