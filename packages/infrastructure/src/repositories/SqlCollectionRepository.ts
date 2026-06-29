import {
  type CollectionId,
  type ICollectionRepository,
  type WardrobeCollection,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type CollectionRow,
  collectionToDomain,
  collectionToRow,
} from './mappers/collectionMapper';

/**
 * SQLite-backed {@link ICollectionRepository}. Membership is stored by garment
 * id in the `collection_garments` join table; the collection aggregate only
 * ever holds ids, so no garment hydration is required.
 */
export class SqlCollectionRepository implements ICollectionRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(collection: WardrobeCollection): Promise<void> {
    const row = collectionToRow(collection);
    wrapSync(
      () =>
        this.db.transaction(() => {
          this.db
            .prepare('INSERT OR REPLACE INTO collections (id, name, description) VALUES (?, ?, ?)')
            .run(row.id, row.name, row.description);
          this.db.prepare('DELETE FROM collection_garments WHERE collection_id = ?').run(row.id);
          const insert = this.db.prepare(
            'INSERT INTO collection_garments (collection_id, garment_id, position) VALUES (?, ?, ?)',
          );
          collection.garmentIds.forEach((garmentId, index) => {
            insert.run(row.id, garmentId, index);
          });
        }),
      (cause) => new DatabaseError(`Failed to save collection ${collection.id}.`, cause),
    );
  }

  public async findById(id: CollectionId): Promise<WardrobeCollection | null> {
    const row = wrapSync(
      () => this.db.prepare('SELECT * FROM collections WHERE id = ?').get<CollectionRow>(id),
      (cause) => new DatabaseError(`Failed to load collection ${id}.`, cause),
    );
    if (!row) {
      return null;
    }
    return collectionToDomain(row, this.memberIds(row.id));
  }

  public async findAll(): Promise<readonly WardrobeCollection[]> {
    const rows = wrapSync(
      () => this.db.prepare('SELECT * FROM collections ORDER BY name ASC').all<CollectionRow>(),
      (cause) => new DatabaseError('Failed to load collections.', cause),
    );
    return rows.map((row) => collectionToDomain(row, this.memberIds(row.id)));
  }

  public async delete(id: CollectionId): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          this.db.prepare('DELETE FROM collection_garments WHERE collection_id = ?').run(id);
          this.db.prepare('DELETE FROM collections WHERE id = ?').run(id);
        }),
      (cause) => new DatabaseError(`Failed to delete collection ${id}.`, cause),
    );
  }

  private memberIds(collectionId: string): readonly string[] {
    return wrapSync(
      () =>
        this.db
          .prepare(
            'SELECT garment_id FROM collection_garments WHERE collection_id = ? ORDER BY position ASC',
          )
          .all<{ garment_id: string }>(collectionId)
          .map((r) => r.garment_id),
      (cause) =>
        new DatabaseError(`Failed to load members of collection ${collectionId}.`, cause),
    );
  }
}
