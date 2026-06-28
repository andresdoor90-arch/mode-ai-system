/**
 * Garment photo use cases (Module 3): add, remove, reorder, transform
 * (rotate/crop), set primary. Drag-and-drop, multi-select, zoom and preview are
 * UI concerns; the application persists the resulting non-destructive transform
 * metadata. Every change publishes `garment.photos-changed` so the visualisation
 * cache and history stay in sync (Module 6).
 */
import { type GarmentId, type PhotoId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import {
  Photograph,
  type CropRect,
  type RotationDegrees,
} from '../../domain/value-objects/Photograph';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { WardrobeEvents } from '../../domain/events/wardrobeEvents';
import { type Command, type RequestHandler } from '../bus/types';
import { type IDomainEventPublisher } from '../sync/ports';

/* -------------------------------- AddPhotos ------------------------------- */

export const ADD_PHOTOS = 'garment.photos.add';

export interface AddPhotoInput {
  readonly storageKey: string;
  readonly attributes?: Record<string, string>;
}

export class AddPhotosCommand implements Command<readonly PhotoId[]> {
  public readonly type = ADD_PHOTOS;
  public constructor(
    public readonly garmentId: GarmentId,
    public readonly photos: readonly AddPhotoInput[],
  ) {}
}

export class AddPhotosHandler implements RequestHandler<AddPhotosCommand, readonly PhotoId[]> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly ids: IdGenerator,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: AddPhotosCommand): Promise<Result<readonly PhotoId[]>> {
    const garment = await this.garments.findById(command.garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.garmentId} not found.`) };
    }
    const created: PhotoId[] = [];
    for (const input of command.photos) {
      const id = this.ids.next<'Photo'>();
      const photo = Photograph.create({
        id,
        storageKey: input.storageKey,
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      });
      if (!photo.ok) {
        return photo;
      }
      const added = garment.addPhoto(photo.value);
      if (!added.ok) {
        return added;
      }
      created.push(id);
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentPhotosChanged, {
      garmentId: command.garmentId,
      photoCount: garment.photos.length,
    });
    return ok(created);
  }
}

/* ------------------------------- RemovePhoto ------------------------------ */

export const REMOVE_PHOTO = 'garment.photos.remove';

export class RemovePhotoCommand implements Command<void> {
  public readonly type = REMOVE_PHOTO;
  public constructor(
    public readonly garmentId: GarmentId,
    public readonly photoId: PhotoId,
  ) {}
}

export class RemovePhotoHandler implements RequestHandler<RemovePhotoCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: RemovePhotoCommand): Promise<Result<void>> {
    const garment = await this.garments.findById(command.garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.garmentId} not found.`) };
    }
    const removed = garment.removePhoto(command.photoId);
    if (!removed.ok) {
      return removed;
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentPhotosChanged, {
      garmentId: command.garmentId,
      photoCount: garment.photos.length,
    });
    return ok(undefined);
  }
}

/* ------------------------------ ReorderPhotos ----------------------------- */

export const REORDER_PHOTOS = 'garment.photos.reorder';

export class ReorderPhotosCommand implements Command<void> {
  public readonly type = REORDER_PHOTOS;
  public constructor(
    public readonly garmentId: GarmentId,
    public readonly orderedPhotoIds: readonly PhotoId[],
  ) {}
}

export class ReorderPhotosHandler implements RequestHandler<ReorderPhotosCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: ReorderPhotosCommand): Promise<Result<void>> {
    const garment = await this.garments.findById(command.garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.garmentId} not found.`) };
    }
    const reordered = garment.reorderPhotos(command.orderedPhotoIds);
    if (!reordered.ok) {
      return reordered;
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentPhotosChanged, {
      garmentId: command.garmentId,
      photoCount: garment.photos.length,
    });
    return ok(undefined);
  }
}

/* ------------------------------ TransformPhoto ---------------------------- */

export const TRANSFORM_PHOTO = 'garment.photos.transform';

export interface TransformPhotoInput {
  readonly garmentId: GarmentId;
  readonly photoId: PhotoId;
  readonly rotation?: RotationDegrees;
  readonly crop?: CropRect;
  readonly setPrimary?: boolean;
}

/** Apply rotation / crop / primary changes to a single photo (non-destructive). */
export class TransformPhotoCommand implements Command<void> {
  public readonly type = TRANSFORM_PHOTO;
  public constructor(public readonly input: TransformPhotoInput) {}
}

export class TransformPhotoHandler implements RequestHandler<TransformPhotoCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: TransformPhotoCommand): Promise<Result<void>> {
    const { garmentId, photoId, rotation, crop, setPrimary } = command.input;
    const garment = await this.garments.findById(garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${garmentId} not found.`) };
    }
    const existing = garment.photos.find((p) => p.id === photoId);
    if (existing === undefined) {
      return { ok: false, error: new NotFoundError(`Photo ${photoId} not found.`) };
    }
    const changes: Parameters<Photograph['with']>[0] = {};
    if (rotation !== undefined) {
      changes.rotation = rotation;
    }
    if (crop !== undefined) {
      changes.crop = crop;
    }
    const updated = existing.with(changes);
    if (!updated.ok) {
      return updated;
    }
    const replaced = garment.replacePhoto(updated.value);
    if (!replaced.ok) {
      return replaced;
    }
    if (setPrimary === true) {
      const primary = garment.setPrimaryPhoto(photoId);
      if (!primary.ok) {
        return primary;
      }
    }
    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentPhotosChanged, {
      garmentId,
      photoCount: garment.photos.length,
    });
    return ok(undefined);
  }
}
