import {
  type Garment,
  type GarmentCategory,
  type GarmentId,
  type GarmentQuery,
  type IGarmentRepository,
  type Season,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type GarmentRow,
  garmentToDomain,
  garmentToRow,
} from './mappers/garmentMapper';

const COLUMNS =
  'id, name, category, subcategory, color_hex, color_name, brand, size_system, size_value, size_measurements, seasons, images, tags, status, wear_count, last_worn_at, metadata';

const PLACEHOLDERS = COLUMNS.split(',')
  .map(() => '?')
  .join(', ');

/**
 * SQLite-backed {@link IGarmentRepository}. Speaks to the database exclusively
 * through the {@link SqlDatabase} port and maps rows to/from the domain via the
 * garment mapper — it contains no business rules of its own.
 */
export class SqlGarmentRepository implements IGarmentRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(garment: Garment): Promise<void> {
    const row = garmentToRow(garment);
    wrapSync(
      () =>
        this.db
          .prepare(`INSERT OR REPLACE INTO garments (${COLUMNS}) VALUES (${PLACEHOLDERS})`)
          .run(
            row.id,
            row.name,
            row.category,
            row.subcategory,
            row.color_hex,
            row.color_name,
            row.brand,
            row.size_system,
            row.size_value,
            row.size_measurements,
            row.seasons,
            row.images,
            row.tags,
            row.status,
            row.wear_count,
            row.last_worn_at,
            row.metadata,
          ),
      (cause) => new DatabaseError(`Failed to save garment ${garment.id}.`, cause),
    );
  }

  public async findById(id: GarmentId): Promise<Garment | null> {
    const row = wrapSync(
      () => this.db.prepare(`SELECT ${COLUMNS} FROM garments WHERE id = ?`).get<GarmentRow>(id),
      (cause) => new DatabaseError(`Failed to load garment ${id}.`, cause),
    );
    return row ? garmentToDomain(row) : null;
  }

  public async findAll(): Promise<readonly Garment[]> {
    const rows = wrapSync(
      () => this.db.prepare(`SELECT ${COLUMNS} FROM garments ORDER BY name ASC`).all<GarmentRow>(),
      (cause) => new DatabaseError('Failed to load garments.', cause),
    );
    return rows.map(garmentToDomain);
  }

  public async query(criteria: GarmentQuery): Promise<readonly Garment[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (criteria.category !== undefined) {
      clauses.push('category = ?');
      params.push(criteria.category);
    }
    if (criteria.subcategory !== undefined) {
      clauses.push('subcategory = ?');
      params.push(criteria.subcategory);
    }
    if (criteria.status !== undefined) {
      clauses.push('status = ?');
      params.push(criteria.status);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${COLUMNS} FROM garments${where} ORDER BY name ASC`)
          .all<GarmentRow>(...params),
      (cause) => new DatabaseError('Failed to query garments.', cause),
    );
    let garments = rows.map(garmentToDomain);
    // Season and tag filters operate on derived domain state, so apply them
    // in-memory after the SQL pre-filter to keep the query simple and correct.
    if (criteria.season !== undefined) {
      const season = criteria.season as Season;
      garments = garments.filter((g) => g.supportsSeason(season));
    }
    if (criteria.tags !== undefined && criteria.tags.length > 0) {
      const tags = criteria.tags;
      garments = garments.filter((g) => tags.every((t) => g.tags.includes(t)));
    }
    return garments;
  }

  public async findByCategory(category: GarmentCategory): Promise<readonly Garment[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${COLUMNS} FROM garments WHERE category = ? ORDER BY name ASC`)
          .all<GarmentRow>(category),
      (cause) => new DatabaseError(`Failed to load garments for category ${category}.`, cause),
    );
    return rows.map(garmentToDomain);
  }

  public async delete(id: GarmentId): Promise<void> {
    wrapSync(
      () => this.db.prepare('DELETE FROM garments WHERE id = ?').run(id),
      (cause) => new DatabaseError(`Failed to delete garment ${id}.`, cause),
    );
  }

  public async count(): Promise<number> {
    const row = wrapSync(
      () => this.db.prepare('SELECT COUNT(*) AS n FROM garments').get<{ n: number }>(),
      (cause) => new DatabaseError('Failed to count garments.', cause),
    );
    return Number(row?.n ?? 0);
  }
}
