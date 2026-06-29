import { Entity } from '../../shared/Entity';
import { type OutfitId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError, InvariantViolationError } from '../../shared/errors';
import { LayerSlot } from '../value-objects/GarmentCategory';
import { type Occasion } from '../value-objects/Occasion';
import { type Season } from '../value-objects/Season';
import { type Garment } from './Garment';

export interface OutfitProps {
  readonly name: string;
  readonly garments: readonly Garment[];
  readonly occasion: Occasion;
  readonly season: Season;
  readonly rating: number | undefined;
  readonly notes: string | undefined;
  readonly createdAt: string;
}

export interface CreateOutfitInput {
  name: string;
  garments: Garment[];
  occasion: Occasion;
  season: Season;
  rating?: number;
  notes?: string;
  createdAt: string;
}

/** Maximum number of distinct garments allowed in a single outfit. */
export const MAX_GARMENTS_PER_OUTFIT = 12;

/**
 * A named combination of garments for a given occasion and season. The outfit
 * protects composition invariants: no empty outfits, no duplicate garments, at
 * most one item per exclusive slot (you cannot wear two pairs of shoes), and a
 * dress cannot be combined with a separate top + bottom.
 */
export class Outfit extends Entity<'Outfit'> {
  private _name: string;
  private _garments: Garment[];
  private _occasion: Occasion;
  private _season: Season;
  private _rating: number | undefined;
  private _notes: string | undefined;
  private readonly _createdAt: string;

  private constructor(id: OutfitId, props: OutfitProps) {
    super(id);
    this._name = props.name;
    this._garments = [...props.garments];
    this._occasion = props.occasion;
    this._season = props.season;
    this._rating = props.rating;
    this._notes = props.notes;
    this._createdAt = props.createdAt;
  }

  public static create(
    id: OutfitId,
    input: CreateOutfitInput,
  ): Result<Outfit, ValidationError | InvariantViolationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Outfit name must be a non-empty string.'));
    }
    const garments = input.garments ?? [];
    const composition = Outfit.validateComposition(garments);
    if (!composition.ok) {
      return composition;
    }
    if (input.rating !== undefined) {
      const ratingCheck = Outfit.validateRating(input.rating);
      if (!ratingCheck.ok) {
        return ratingCheck;
      }
    }
    return ok(
      new Outfit(id, {
        name: input.name.trim(),
        garments,
        occasion: input.occasion,
        season: input.season,
        rating: input.rating,
        notes: input.notes,
        createdAt: input.createdAt,
      }),
    );
  }

  private static validateRating(rating: number): Result<void, ValidationError> {
    if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
      return err(new ValidationError('Outfit rating must be between 0 and 100.'));
    }
    return ok(undefined);
  }

  private static validateComposition(
    garments: readonly Garment[],
  ): Result<void, ValidationError | InvariantViolationError> {
    if (garments.length === 0) {
      return err(new ValidationError('An outfit must contain at least one garment.'));
    }
    if (garments.length > MAX_GARMENTS_PER_OUTFIT) {
      return err(
        new ValidationError(`An outfit may contain at most ${MAX_GARMENTS_PER_OUTFIT} garments.`),
      );
    }
    const ids = new Set<string>();
    for (const garment of garments) {
      if (ids.has(garment.id)) {
        return err(
          new InvariantViolationError(`Garment ${garment.id} is duplicated in the outfit.`),
        );
      }
      ids.add(garment.id);
    }

    const slotCounts = new Map<LayerSlot, number>();
    for (const garment of garments) {
      const slot = garment.layerSlot;
      slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    }
    // Exclusive slots: only one item allowed.
    for (const slot of [LayerSlot.LowerBody, LayerSlot.FullBody, LayerSlot.Feet]) {
      if ((slotCounts.get(slot) ?? 0) > 1) {
        return err(new InvariantViolationError(`An outfit cannot contain two "${slot}" garments.`));
      }
    }
    // A full-body item (dress/jumpsuit) cannot coexist with upper or lower body items.
    if ((slotCounts.get(LayerSlot.FullBody) ?? 0) > 0) {
      if (
        (slotCounts.get(LayerSlot.UpperBody) ?? 0) > 0 ||
        (slotCounts.get(LayerSlot.LowerBody) ?? 0) > 0
      ) {
        return err(
          new InvariantViolationError(
            'A dress/jumpsuit cannot be combined with a separate top or bottom.',
          ),
        );
      }
    }
    return ok(undefined);
  }

  public get name(): string {
    return this._name;
  }
  public get garments(): readonly Garment[] {
    return this._garments;
  }
  public get occasion(): Occasion {
    return this._occasion;
  }
  public get season(): Season {
    return this._season;
  }
  public get rating(): number | undefined {
    return this._rating;
  }
  public get notes(): string | undefined {
    return this._notes;
  }
  public get createdAt(): string {
    return this._createdAt;
  }

  public hasGarment(id: string): boolean {
    return this._garments.some((g) => g.id === id);
  }

  public addGarment(garment: Garment): Result<void, ValidationError | InvariantViolationError> {
    const next = [...this._garments, garment];
    const check = Outfit.validateComposition(next);
    if (!check.ok) {
      return check;
    }
    this._garments = next;
    return ok(undefined);
  }

  public removeGarment(id: string): Result<void, ValidationError | InvariantViolationError> {
    const next = this._garments.filter((g) => g.id !== id);
    const check = Outfit.validateComposition(next);
    if (!check.ok) {
      return check;
    }
    this._garments = next;
    return ok(undefined);
  }

  /** Apply or replace the user's manual rating (0–100). */
  public rate(rating: number): Result<void, ValidationError> {
    const check = Outfit.validateRating(rating);
    if (!check.ok) {
      return check;
    }
    this._rating = rating;
    return ok(undefined);
  }

  public annotate(notes: string): void {
    this._notes = notes;
  }
}
