/**
 * Persistence assembly (main process).
 *
 * The composition root resolves ONE {@link Persistence} bundle and hands it to
 * the application layer. Two interchangeable builders exist behind the same
 * port-typed shape:
 *
 *  - {@link createSqlPersistence} — the real, durable backing: the
 *    SQLite-backed repositories from `@mas/infrastructure`, wired over an open
 *    {@link SqlDatabase}. This is what production/CI uses.
 *  - {@link createInMemoryPersistence} — volatile `Map`-backed repositories,
 *    used only when no database is available (e.g. a quick smoke test).
 *
 * Because every field is a `@mas/core` repository PORT, swapping SQL for
 * in-memory (or any future engine) never touches the use cases, the IPC layer
 * or the renderer — the swap is confined to this single module.
 */
import type {
  ICategoryRepository,
  ICollectionRepository,
  IGarmentRepository,
  IOutfitHistoryRepository,
  IOutfitRepository,
  IUserProfileRepository,
} from '@mas/core';
import {
  type SqlDatabase,
  SqlCategoryRepository,
  SqlCollectionRepository,
  SqlGarmentRepository,
  SqlOutfitHistoryRepository,
  SqlOutfitRepository,
  SqlUserProfileRepository,
} from '@mas/infrastructure';

import {
  InMemoryCategoryRepository,
  InMemoryCollectionRepository,
  InMemoryGarmentRepository,
  InMemoryOutfitHistoryRepository,
  InMemoryOutfitRepository,
  InMemoryUserProfileRepository,
} from './inMemoryRepositories';

/** The full set of repository ports the application layer depends on. */
export interface Persistence {
  readonly garments: IGarmentRepository;
  readonly outfits: IOutfitRepository;
  readonly collections: ICollectionRepository;
  readonly profiles: IUserProfileRepository;
  readonly categories: ICategoryRepository;
  readonly history: IOutfitHistoryRepository;
}

/** Build the durable, SQLite-backed persistence over an open database. */
export const createSqlPersistence = (db: SqlDatabase): Persistence => {
  const garments = new SqlGarmentRepository(db);
  return {
    garments,
    outfits: new SqlOutfitRepository(db, garments),
    collections: new SqlCollectionRepository(db),
    profiles: new SqlUserProfileRepository(db),
    categories: new SqlCategoryRepository(db),
    history: new SqlOutfitHistoryRepository(db),
  };
};

/** Build volatile, in-memory persistence (tests / no-database fallback). */
export const createInMemoryPersistence = (): Persistence => ({
  garments: new InMemoryGarmentRepository(),
  outfits: new InMemoryOutfitRepository(),
  collections: new InMemoryCollectionRepository(),
  profiles: new InMemoryUserProfileRepository(),
  categories: new InMemoryCategoryRepository(),
  history: new InMemoryOutfitHistoryRepository(),
});
