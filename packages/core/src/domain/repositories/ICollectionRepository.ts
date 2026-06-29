import { type CollectionId } from '../../shared/Identifier';
import { type WardrobeCollection } from '../entities/WardrobeCollection';

/**
 * Persistence contract for {@link WardrobeCollection} entities.
 */
export interface ICollectionRepository {
  save(collection: WardrobeCollection): Promise<void>;
  findById(id: CollectionId): Promise<WardrobeCollection | null>;
  findAll(): Promise<readonly WardrobeCollection[]>;
  delete(id: CollectionId): Promise<void>;
}
