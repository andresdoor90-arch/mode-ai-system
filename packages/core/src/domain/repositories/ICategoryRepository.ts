import { type CategoryId } from '../../shared/Identifier';
import { type Category } from '../entities/Category';

/**
 * Persistence contract for the user-defined {@link Category} taxonomy.
 * Declared in the domain, implemented by infrastructure. Categories are data
 * the user owns; there are no hardcoded categories anywhere in the system.
 */
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  /** Persist many categories at once (used by seeding/migration). */
  saveMany(categories: readonly Category[]): Promise<void>;
  findById(id: CategoryId): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  /** Every category, ordered by `order` then name. */
  findAll(): Promise<readonly Category[]>;
  /** Top-level categories (no parent). */
  findRoots(): Promise<readonly Category[]>;
  /** Direct children (subcategories) of a parent. */
  findChildren(parentId: CategoryId): Promise<readonly Category[]>;
  delete(id: CategoryId): Promise<void>;
  count(): Promise<number>;
}
