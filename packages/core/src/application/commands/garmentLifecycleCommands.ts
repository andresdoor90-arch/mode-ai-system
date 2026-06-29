/**
 * Garment lifecycle use cases (Module 2): duplicate, archive, restore.
 * Create / edit / delete already live in {@link ./garmentCommands}. Each
 * mutation publishes the matching domain event so the cognitive engine and the
 * other subsystems stay in sync automatically (Module 6).
 */
import { type GarmentId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import { Garment } from '../../domain/entities/Garment';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { WardrobeEvents } from '../../domain/events/wardrobeEvents';
import { type Command, type RequestHandler } from '../bus/types';
import { type IDomainEventPublisher } from '../sync/ports';
import { buildGarmentSnapshot } from '../sync/snapshot';

/* ------------------------------ DuplicateGarment -------------------------- */

export const DUPLICATE_GARMENT = 'garment.duplicate';

export class DuplicateGarmentCommand implements Command<GarmentId> {
  public readonly type = DUPLICATE_GARMENT;
  public constructor(
    public readonly id: GarmentId,
    /** Optional new name; defaults to "<name> (copy)". */
    public readonly name?: string,
  ) {}
}

export class DuplicateGarmentHandler
  implements RequestHandler<DuplicateGarmentCommand, GarmentId>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly ids: IdGenerator,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: DuplicateGarmentCommand): Promise<Result<GarmentId>> {
    const source = await this.garments.findById(command.id);
    if (source === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.id} not found.`) };
    }
    const snapshot = source.toSnapshot();
    const newId = this.ids.next<'Garment'>();
    const created = Garment.create(newId, {
      ...snapshot,
      name: command.name ?? `${snapshot.name} (copy)`,
    });
    if (!created.ok) {
      return created;
    }
    await this.garments.save(created.value);
    await this.events?.publish(WardrobeEvents.GarmentAdded, {
      garment: buildGarmentSnapshot(created.value),
    });
    return ok(newId);
  }
}

/* ------------------------------- ArchiveGarment --------------------------- */

export const ARCHIVE_GARMENT = 'garment.archive';

export class ArchiveGarmentCommand implements Command<void> {
  public readonly type = ARCHIVE_GARMENT;
  public constructor(public readonly id: GarmentId) {}
}

export class ArchiveGarmentHandler implements RequestHandler<ArchiveGarmentCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: ArchiveGarmentCommand): Promise<Result<void>> {
    const garment = await this.garments.findById(command.id);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.id} not found.`) };
    }
    const archived = garment.archive();
    if (!archived.ok) {
      return archived;
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentArchived, { garmentId: command.id });
    return ok(undefined);
  }
}

/* ------------------------------- RestoreGarment --------------------------- */

export const RESTORE_GARMENT = 'garment.restore';

export class RestoreGarmentCommand implements Command<void> {
  public readonly type = RESTORE_GARMENT;
  public constructor(public readonly id: GarmentId) {}
}

export class RestoreGarmentHandler implements RequestHandler<RestoreGarmentCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: RestoreGarmentCommand): Promise<Result<void>> {
    const garment = await this.garments.findById(command.id);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.id} not found.`) };
    }
    const restored = garment.restore();
    if (!restored.ok) {
      return restored;
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentRestored, {
      garment: buildGarmentSnapshot(garment),
    });
    return ok(undefined);
  }
}
