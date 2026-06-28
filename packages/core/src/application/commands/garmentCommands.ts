import { type GarmentId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import {
  Garment,
  type CreateGarmentInput,
  type GarmentStatus,
} from '../../domain/entities/Garment';
import { type Color } from '../../domain/value-objects/Color';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type Command, type RequestHandler } from '../bus/types';

/* -------------------------------------------------------------------------- */
/* AddGarment                                                                 */
/* -------------------------------------------------------------------------- */

export const ADD_GARMENT = 'garment.add';

/** Add a brand-new garment to the wardrobe. */
export class AddGarmentCommand implements Command<GarmentId> {
  public readonly type = ADD_GARMENT;
  public constructor(public readonly input: CreateGarmentInput) {}
}

export class AddGarmentHandler implements RequestHandler<AddGarmentCommand, GarmentId> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async handle(command: AddGarmentCommand): Promise<Result<GarmentId>> {
    const id = this.ids.next<'Garment'>();
    const created = Garment.create(id, command.input);
    if (!created.ok) {
      return created;
    }
    await this.garments.save(created.value);
    return ok(id);
  }
}

/* -------------------------------------------------------------------------- */
/* UpdateGarment                                                              */
/* -------------------------------------------------------------------------- */

export const UPDATE_GARMENT = 'garment.update';

export interface UpdateGarmentInput {
  readonly id: GarmentId;
  readonly name?: string;
  readonly color?: Color;
  readonly tags?: readonly string[];
  readonly status?: GarmentStatus;
}

/** Mutate an existing garment's editable attributes. */
export class UpdateGarmentCommand implements Command<void> {
  public readonly type = UPDATE_GARMENT;
  public constructor(public readonly input: UpdateGarmentInput) {}
}

export class UpdateGarmentHandler implements RequestHandler<UpdateGarmentCommand, void> {
  public constructor(private readonly garments: IGarmentRepository) {}

  public async handle(command: UpdateGarmentCommand): Promise<Result<void>> {
    const { id, name, color, tags, status } = command.input;
    const garment = await this.garments.findById(id);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${id} not found.`) };
    }
    if (name !== undefined) {
      const renamed = garment.rename(name);
      if (!renamed.ok) {
        return renamed;
      }
    }
    if (color !== undefined) {
      garment.recolor(color);
    }
    if (tags !== undefined) {
      garment.retag(tags);
    }
    if (status !== undefined) {
      const changed = garment.changeStatus(status);
      if (!changed.ok) {
        return changed;
      }
    }
    await this.garments.save(garment);
    return ok(undefined);
  }
}

/* -------------------------------------------------------------------------- */
/* RemoveGarment                                                              */
/* -------------------------------------------------------------------------- */

export const REMOVE_GARMENT = 'garment.remove';

/** Permanently remove a garment from the wardrobe. */
export class RemoveGarmentCommand implements Command<void> {
  public readonly type = REMOVE_GARMENT;
  public constructor(public readonly id: GarmentId) {}
}

export class RemoveGarmentHandler implements RequestHandler<RemoveGarmentCommand, void> {
  public constructor(private readonly garments: IGarmentRepository) {}

  public async handle(command: RemoveGarmentCommand): Promise<Result<void>> {
    const existing = await this.garments.findById(command.id);
    if (existing === null) {
      return { ok: false, error: new NotFoundError(`Garment ${command.id} not found.`) };
    }
    await this.garments.delete(command.id);
    return ok(undefined);
  }
}
