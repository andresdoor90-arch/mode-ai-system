import { type OutfitId } from '../../shared/Identifier';
import { type Outfit } from '../entities/Outfit';
import { type Occasion } from '../value-objects/Occasion';
import { type Season } from '../value-objects/Season';

/** Filter criteria for querying outfits. */
export interface OutfitQuery {
  readonly occasion?: Occasion;
  readonly season?: Season;
  readonly minRating?: number;
}

/**
 * Persistence contract for {@link Outfit} aggregates. Implemented by the
 * infrastructure layer.
 */
export interface IOutfitRepository {
  save(outfit: Outfit): Promise<void>;
  findById(id: OutfitId): Promise<Outfit | null>;
  findAll(): Promise<readonly Outfit[]>;
  query(criteria: OutfitQuery): Promise<readonly Outfit[]>;
  findByOccasion(occasion: Occasion): Promise<readonly Outfit[]>;
  delete(id: OutfitId): Promise<void>;
}
