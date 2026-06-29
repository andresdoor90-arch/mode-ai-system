import { Entity } from '../../shared/Entity';
import { type CollectionId, type GarmentId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';

export interface WardrobeCollectionProps {
  readonly name: string;
  readonly description: string | undefined;
  readonly garmentIds: readonly GarmentId[];
}

/**
 * A named grouping of garments (e.g. "Work capsule", "Holiday packing"). Holds
 * garment references by id rather than the garment objects themselves, keeping
 * the aggregate boundary clean.
 */
export class WardrobeCollection extends Entity<'Collection'> {
  private _name: string;
  private _description: string | undefined;
  private _garmentIds: GarmentId[];

  private constructor(id: CollectionId, props: WardrobeCollectionProps) {
    super(id);
    this._name = props.name;
    this._description = props.description;
    this._garmentIds = [...props.garmentIds];
  }

  public static create(
    id: CollectionId,
    input: { name: string; description?: string; garmentIds?: GarmentId[] },
  ): Result<WardrobeCollection, ValidationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Collection name must be a non-empty string.'));
    }
    const unique = [...new Set(input.garmentIds ?? [])];
    return ok(
      new WardrobeCollection(id, {
        name: input.name.trim(),
        description: input.description,
        garmentIds: unique,
      }),
    );
  }

  public get name(): string {
    return this._name;
  }
  public get description(): string | undefined {
    return this._description;
  }
  public get garmentIds(): readonly GarmentId[] {
    return this._garmentIds;
  }

  public rename(name: string): Result<void, ValidationError> {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return err(new ValidationError('Collection name must be a non-empty string.'));
    }
    this._name = name.trim();
    return ok(undefined);
  }

  public addGarment(garmentId: GarmentId): void {
    if (!this._garmentIds.includes(garmentId)) {
      this._garmentIds = [...this._garmentIds, garmentId];
    }
  }

  public removeGarment(garmentId: GarmentId): void {
    this._garmentIds = this._garmentIds.filter((id) => id !== garmentId);
  }

  public has(garmentId: GarmentId): boolean {
    return this._garmentIds.includes(garmentId);
  }
}
