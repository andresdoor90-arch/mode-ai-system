import { AggregateRoot } from '../../shared/Entity';
import {
  type WardrobeId,
  type UserProfileId,
  type GarmentId,
  type CollectionId,
} from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError, InvariantViolationError, NotFoundError } from '../../shared/errors';
import { type GarmentCategory } from '../value-objects/GarmentCategory';
import { type Season } from '../value-objects/Season';
import { type Garment } from './Garment';
import { type WardrobeCollection } from './WardrobeCollection';

/**
 * Aggregate root owning a user's garments and collections.
 *
 * It is the consistency boundary for wardrobe mutations: garment ids are unique
 * within a wardrobe, a collection may only reference garments that exist in the
 * same wardrobe, and removing a garment prunes it from every collection so no
 * dangling references survive.
 */
export class Wardrobe extends AggregateRoot<'Wardrobe'> {
  private readonly _ownerId: UserProfileId;
  private readonly _garments: Map<string, Garment>;
  private readonly _collections: Map<string, WardrobeCollection>;

  private constructor(id: WardrobeId, ownerId: UserProfileId) {
    super(id);
    this._ownerId = ownerId;
    this._garments = new Map();
    this._collections = new Map();
  }

  public static create(id: WardrobeId, ownerId: UserProfileId): Wardrobe {
    return new Wardrobe(id, ownerId);
  }

  public get ownerId(): UserProfileId {
    return this._ownerId;
  }

  public get garments(): readonly Garment[] {
    return [...this._garments.values()];
  }

  public get collections(): readonly WardrobeCollection[] {
    return [...this._collections.values()];
  }

  public get size(): number {
    return this._garments.size;
  }

  public getGarment(id: GarmentId): Garment | undefined {
    return this._garments.get(id);
  }

  public hasGarment(id: GarmentId): boolean {
    return this._garments.has(id);
  }

  public addGarment(garment: Garment): Result<void, InvariantViolationError> {
    if (this._garments.has(garment.id)) {
      return err(
        new InvariantViolationError(`Garment ${garment.id} already exists in the wardrobe.`),
      );
    }
    this._garments.set(garment.id, garment);
    return ok(undefined);
  }

  /** Remove a garment and prune it from every collection that referenced it. */
  public removeGarment(id: GarmentId): Result<void, NotFoundError> {
    if (!this._garments.has(id)) {
      return err(new NotFoundError(`Garment ${id} is not in the wardrobe.`));
    }
    this._garments.delete(id);
    for (const collection of this._collections.values()) {
      collection.removeGarment(id);
    }
    return ok(undefined);
  }

  public addCollection(
    collection: WardrobeCollection,
  ): Result<void, ValidationError | InvariantViolationError> {
    if (this._collections.has(collection.id)) {
      return err(new InvariantViolationError(`Collection ${collection.id} already exists.`));
    }
    for (const garmentId of collection.garmentIds) {
      if (!this._garments.has(garmentId)) {
        return err(
          new ValidationError(
            `Collection references garment ${garmentId} which is not in the wardrobe.`,
          ),
        );
      }
    }
    this._collections.set(collection.id, collection);
    return ok(undefined);
  }

  public getCollection(id: CollectionId): WardrobeCollection | undefined {
    return this._collections.get(id);
  }

  /** Add a garment to a collection, enforcing that both already exist. */
  public assignGarmentToCollection(
    collectionId: CollectionId,
    garmentId: GarmentId,
  ): Result<void, NotFoundError> {
    const collection = this._collections.get(collectionId);
    if (collection === undefined) {
      return err(new NotFoundError(`Collection ${collectionId} not found.`));
    }
    if (!this._garments.has(garmentId)) {
      return err(new NotFoundError(`Garment ${garmentId} not found in the wardrobe.`));
    }
    collection.addGarment(garmentId);
    return ok(undefined);
  }

  /** All wearable garments in a given category. */
  public garmentsByCategory(category: GarmentCategory): readonly Garment[] {
    return this.garments.filter((g) => g.category === category);
  }

  /** All garments that support the given season. */
  public garmentsForSeason(season: Season): readonly Garment[] {
    return this.garments.filter((g) => g.supportsSeason(season));
  }

  /** Only garments eligible for recommendations (status Available). */
  public wearableGarments(): readonly Garment[] {
    return this.garments.filter((g) => g.isWearable);
  }
}
