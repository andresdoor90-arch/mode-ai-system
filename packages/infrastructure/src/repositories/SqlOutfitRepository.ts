import {
  type Garment,
  type IGarmentRepository,
  type IOutfitRepository,
  type Occasion,
  type Outfit,
  type OutfitId,
  type OutfitQuery,
} from '@mas/core';

import { DatabaseError, MappingError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import { type OutfitRow, outfitToDomain, outfitToRow } from './mappers/outfitMapper';

/**
 * SQLite-backed {@link IOutfitRepository}. Outfit ↔ garment membership is held
 * in the `outfit_garments` join table; garments themselves are hydrated through
 * the injected {@link IGarmentRepository}, so there is a single source of truth
 * for garment persistence.
 */
export class SqlOutfitRepository implements IOutfitRepository {
  public constructor(
    private readonly db: SqlDatabase,
    private readonly garments: IGarmentRepository,
  ) {}

  public async save(outfit: Outfit): Promise<void> {
    const row = outfitToRow(outfit);
    wrapSync(
      () =>
        this.db.transaction(() => {
          this.db
            .prepare(
              'INSERT OR REPLACE INTO outfits (id, name, occasion, season, rating, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .run(row.id, row.name, row.occasion, row.season, row.rating, row.notes, row.created_at);
          this.db.prepare('DELETE FROM outfit_garments WHERE outfit_id = ?').run(row.id);
          const insert = this.db.prepare(
            'INSERT INTO outfit_garments (outfit_id, garment_id, position) VALUES (?, ?, ?)',
          );
          outfit.garments.forEach((garment, index) => {
            insert.run(row.id, garment.id, index);
          });
        }),
      (cause) => new DatabaseError(`Failed to save outfit ${outfit.id}.`, cause),
    );
  }

  public async findById(id: OutfitId): Promise<Outfit | null> {
    const row = wrapSync(
      () => this.db.prepare('SELECT * FROM outfits WHERE id = ?').get<OutfitRow>(id),
      (cause) => new DatabaseError(`Failed to load outfit ${id}.`, cause),
    );
    return row ? this.hydrate(row) : null;
  }

  public async findAll(): Promise<readonly Outfit[]> {
    return this.hydrateAll(
      wrapSync(
        () => this.db.prepare('SELECT * FROM outfits ORDER BY created_at DESC').all<OutfitRow>(),
        (cause) => new DatabaseError('Failed to load outfits.', cause),
      ),
    );
  }

  public async query(criteria: OutfitQuery): Promise<readonly Outfit[]> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (criteria.occasion !== undefined) {
      clauses.push('occasion = ?');
      params.push(criteria.occasion);
    }
    if (criteria.season !== undefined) {
      clauses.push('season = ?');
      params.push(criteria.season);
    }
    if (criteria.minRating !== undefined) {
      clauses.push('rating IS NOT NULL AND rating >= ?');
      params.push(criteria.minRating);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = wrapSync(
      () =>
        this.db
          .prepare(`SELECT * FROM outfits${where} ORDER BY created_at DESC`)
          .all<OutfitRow>(...params),
      (cause) => new DatabaseError('Failed to query outfits.', cause),
    );
    return this.hydrateAll(rows);
  }

  public async findByOccasion(occasion: Occasion): Promise<readonly Outfit[]> {
    return this.query({ occasion });
  }

  public async delete(id: OutfitId): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          this.db.prepare('DELETE FROM outfit_garments WHERE outfit_id = ?').run(id);
          this.db.prepare('DELETE FROM outfits WHERE id = ?').run(id);
        }),
      (cause) => new DatabaseError(`Failed to delete outfit ${id}.`, cause),
    );
  }

  private async hydrate(row: OutfitRow): Promise<Outfit> {
    const garmentIds = wrapSync(
      () =>
        this.db
          .prepare(
            'SELECT garment_id FROM outfit_garments WHERE outfit_id = ? ORDER BY position ASC',
          )
          .all<{ garment_id: string }>(row.id)
          .map((r) => r.garment_id),
      (cause) => new DatabaseError(`Failed to load garments for outfit ${row.id}.`, cause),
    );

    const garments: Garment[] = [];
    for (const garmentId of garmentIds) {
      const garment = await this.garments.findById(garmentId as Garment['id']);
      if (garment === null) {
        throw new MappingError(
          `Outfit ${row.id} references missing garment ${garmentId}.`,
        );
      }
      garments.push(garment);
    }
    return outfitToDomain(row, garments);
  }

  private async hydrateAll(rows: readonly OutfitRow[]): Promise<readonly Outfit[]> {
    const outfits: Outfit[] = [];
    for (const row of rows) {
      outfits.push(await this.hydrate(row));
    }
    return outfits;
  }
}
