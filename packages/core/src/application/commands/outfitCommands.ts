import { type GarmentId, type OutfitId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import { Outfit } from '../../domain/entities/Outfit';
import { type Garment } from '../../domain/entities/Garment';
import { type Occasion } from '../../domain/value-objects/Occasion';
import { type Season } from '../../domain/value-objects/Season';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type IOutfitRepository } from '../../domain/repositories/IOutfitRepository';
import { type Command, type RequestHandler } from '../bus/types';

/* -------------------------------------------------------------------------- */
/* CreateOutfit                                                               */
/* -------------------------------------------------------------------------- */

export const CREATE_OUTFIT = 'outfit.create';

export interface CreateOutfitCommandInput {
  readonly name: string;
  readonly garmentIds: readonly GarmentId[];
  readonly occasion: Occasion;
  readonly season: Season;
  readonly notes?: string;
  /** ISO timestamp supplied by the caller — the domain owns no clock. */
  readonly createdAt: string;
}

/** Assemble a named outfit from existing garments. */
export class CreateOutfitCommand implements Command<OutfitId> {
  public readonly type = CREATE_OUTFIT;
  public constructor(public readonly input: CreateOutfitCommandInput) {}
}

export class CreateOutfitHandler implements RequestHandler<CreateOutfitCommand, OutfitId> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly outfits: IOutfitRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async handle(command: CreateOutfitCommand): Promise<Result<OutfitId>> {
    const { input } = command;
    const resolved: Garment[] = [];
    for (const garmentId of input.garmentIds) {
      const garment = await this.garments.findById(garmentId);
      if (garment === null) {
        return { ok: false, error: new NotFoundError(`Garment ${garmentId} not found.`) };
      }
      resolved.push(garment);
    }

    const id = this.ids.next<'Outfit'>();
    const created = Outfit.create(id, {
      name: input.name,
      garments: resolved,
      occasion: input.occasion,
      season: input.season,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      createdAt: input.createdAt,
    });
    if (!created.ok) {
      return created;
    }
    await this.outfits.save(created.value);
    return ok(id);
  }
}

/* -------------------------------------------------------------------------- */
/* RateOutfit                                                                 */
/* -------------------------------------------------------------------------- */

export const RATE_OUTFIT = 'outfit.rate';

export interface RateOutfitInput {
  readonly outfitId: OutfitId;
  readonly rating: number;
}

/** Apply a manual 0–100 rating to an outfit. */
export class RateOutfitCommand implements Command<void> {
  public readonly type = RATE_OUTFIT;
  public constructor(public readonly input: RateOutfitInput) {}
}

export class RateOutfitHandler implements RequestHandler<RateOutfitCommand, void> {
  public constructor(private readonly outfits: IOutfitRepository) {}

  public async handle(command: RateOutfitCommand): Promise<Result<void>> {
    const outfit = await this.outfits.findById(command.input.outfitId);
    if (outfit === null) {
      return {
        ok: false,
        error: new NotFoundError(`Outfit ${command.input.outfitId} not found.`),
      };
    }
    const rated = outfit.rate(command.input.rating);
    if (!rated.ok) {
      return rated;
    }
    await this.outfits.save(outfit);
    return ok(undefined);
  }
}
