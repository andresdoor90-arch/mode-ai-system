import { Entity } from '../../shared/Entity';
import { type GarmentId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError, InvariantViolationError } from '../../shared/errors';
import { type Color } from '../value-objects/Color';
import { GarmentCategory } from '../value-objects/GarmentCategory';
import { isSubcategoryOf } from '../value-objects/GarmentSubcategory';
import { Season } from '../value-objects/Season';
import { type Size } from '../value-objects/Size';

/**
 * Lifecycle status of a garment. The recommendation engine must never propose a
 * garment that is damaged, in the laundry or archived.
 */
export enum GarmentStatus {
  Available = 'available',
  InLaundry = 'in-laundry',
  Damaged = 'damaged',
  Archived = 'archived',
}

export interface GarmentProps {
  readonly name: string;
  readonly category: GarmentCategory;
  readonly subcategory: string;
  readonly color: Color;
  readonly brand: string | undefined;
  readonly size: Size | undefined;
  readonly seasons: readonly Season[];
  readonly images: readonly string[];
  readonly tags: readonly string[];
  readonly status: GarmentStatus;
  /** Number of times the garment has been worn — feeds freshness scoring. */
  readonly wearCount: number;
  /** ISO date (YYYY-MM-DD) the garment was last worn, if ever. */
  readonly lastWornAt: string | undefined;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface CreateGarmentInput {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: Color;
  seasons: Season[];
  brand?: string;
  size?: Size;
  images?: string[];
  tags?: string[];
  status?: GarmentStatus;
  wearCount?: number;
  lastWornAt?: string;
  metadata?: Record<string, string>;
}

/**
 * A single wearable item. Entity (identity = id). Mutating operations return a
 * `Result` and protect the garment's invariants (e.g. a valid subcategory for
 * its category, at least one season).
 */
export class Garment extends Entity<'Garment'> {
  private _name: string;
  private _category: GarmentCategory;
  private _subcategory: string;
  private _color: Color;
  private _brand: string | undefined;
  private _size: Size | undefined;
  private _seasons: Season[];
  private _images: string[];
  private _tags: string[];
  private _status: GarmentStatus;
  private _wearCount: number;
  private _lastWornAt: string | undefined;
  private _metadata: Record<string, string>;

  private constructor(id: GarmentId, props: GarmentProps) {
    super(id);
    this._name = props.name;
    this._category = props.category;
    this._subcategory = props.subcategory;
    this._color = props.color;
    this._brand = props.brand;
    this._size = props.size;
    this._seasons = [...props.seasons];
    this._images = [...props.images];
    this._tags = [...props.tags];
    this._status = props.status;
    this._wearCount = props.wearCount;
    this._lastWornAt = props.lastWornAt;
    this._metadata = { ...props.metadata };
  }

  public static create(
    id: GarmentId,
    input: CreateGarmentInput,
  ): Result<Garment, ValidationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Garment name must be a non-empty string.'));
    }
    if (!Object.values(GarmentCategory).includes(input.category)) {
      return err(new ValidationError(`"${input.category}" is not a valid category.`));
    }
    if (!isSubcategoryOf(input.category, input.subcategory)) {
      return err(
        new ValidationError(
          `"${input.subcategory}" is not a valid subcategory of ${input.category}.`,
        ),
      );
    }
    const seasons = input.seasons ?? [];
    if (seasons.length === 0) {
      return err(new ValidationError('A garment must declare at least one season.'));
    }
    const wearCount = input.wearCount ?? 0;
    if (!Number.isInteger(wearCount) || wearCount < 0) {
      return err(new ValidationError('wearCount must be a non-negative integer.'));
    }

    return ok(
      new Garment(id, {
        name: input.name.trim(),
        category: input.category,
        subcategory: input.subcategory,
        color: input.color,
        brand: input.brand,
        size: input.size,
        seasons: [...new Set(seasons)],
        images: input.images ?? [],
        tags: (input.tags ?? []).map((t) => t.toLowerCase()),
        status: input.status ?? GarmentStatus.Available,
        wearCount,
        lastWornAt: input.lastWornAt,
        metadata: input.metadata ?? {},
      }),
    );
  }

  public get name(): string {
    return this._name;
  }
  public get category(): GarmentCategory {
    return this._category;
  }
  public get subcategory(): string {
    return this._subcategory;
  }
  public get color(): Color {
    return this._color;
  }
  public get brand(): string | undefined {
    return this._brand;
  }
  public get size(): Size | undefined {
    return this._size;
  }
  public get seasons(): readonly Season[] {
    return this._seasons;
  }
  public get images(): readonly string[] {
    return this._images;
  }
  public get tags(): readonly string[] {
    return this._tags;
  }
  public get status(): GarmentStatus {
    return this._status;
  }
  public get wearCount(): number {
    return this._wearCount;
  }
  public get lastWornAt(): string | undefined {
    return this._lastWornAt;
  }
  public get metadata(): Readonly<Record<string, string>> {
    return this._metadata;
  }

  /** Whether the garment is eligible to appear in recommendations. */
  public get isWearable(): boolean {
    return this._status === GarmentStatus.Available;
  }

  /** Does this garment cover the given season? */
  public supportsSeason(season: Season): boolean {
    return (
      this._seasons.includes(Season.AllSeason) ||
      season === Season.AllSeason ||
      this._seasons.includes(season)
    );
  }

  public rename(name: string): Result<void, ValidationError> {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return err(new ValidationError('Garment name must be a non-empty string.'));
    }
    this._name = name.trim();
    return ok(undefined);
  }

  public recolor(color: Color): void {
    this._color = color;
  }

  public retag(tags: readonly string[]): void {
    this._tags = [...new Set(tags.map((t) => t.toLowerCase()))];
  }

  public changeStatus(status: GarmentStatus): Result<void, InvariantViolationError> {
    if (!Object.values(GarmentStatus).includes(status)) {
      return err(new InvariantViolationError(`"${status}" is not a valid garment status.`));
    }
    this._status = status;
    return ok(undefined);
  }

  /** Record that the garment was worn on the given ISO date (default today). */
  public markWorn(isoDate: string): Result<void, ValidationError> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return err(new ValidationError('markWorn expects an ISO date (YYYY-MM-DD).'));
    }
    this._wearCount += 1;
    this._lastWornAt = isoDate;
    return ok(undefined);
  }
}
