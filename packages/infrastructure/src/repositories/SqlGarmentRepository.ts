import {
  type Garment,
  type GarmentId,
  type GarmentQuery,
  type IGarmentRepository,
  type Photograph,
  type Season,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import { type GarmentRow, garmentToDomain, garmentToRow } from './mappers/garmentMapper';
import {
  type PhotographRow,
  photographToDomain,
  photographToRow,
} from './mappers/photographMapper';

/** Columns written on save (the repo manages `version` itself). */
const WRITE_COLUMNS =
  'id, name, category, subcategory, category_id, category_metadata, color_hex, color_name, secondary_colors, brand, size_system, size_value, size_measurements, material, seasons, images, tags, status, wear_count, last_worn_at, purchase_date, notes, metadata, version';

/** Columns the row→domain mapper consumes (no `version`). */
const READ_COLUMNS =
  'id, name, category, subcategory, category_id, category_metadata, color_hex, color_name, secondary_colors, brand, size_system, size_value, size_measurements, material, seasons, images, tags, status, wear_count, last_worn_at, purchase_date, notes, metadata';

const WRITE_PLACEHOLDERS = WRITE_COLUMNS.split(',')
  .map(() => '?')
  .join(', ');

const PHOTO_COLUMNS =
  'id, garment_id, storage_key, "order", rotation, crop, is_primary, stage, attributes';

/** A single modification/audit record for a garment. */
export interface GarmentAuditEntry {
  readonly version: number;
  readonly changeType: string;
  readonly changedAt: string;
  readonly snapshot: string;
}

/**
 * SQLite-backed {@link IGarmentRepository}. Persists the full Phase 7 garment
 * model: extended metadata + the 1:N {@link Photograph} relation (in the
 * `photographs` table), with basic versioning and a modification/audit trail in
 * `garment_history`. Speaks only through the {@link SqlDatabase} port and the
 * mappers — no business rules live here.
 */
export class SqlGarmentRepository implements IGarmentRepository {
  public constructor(
    private readonly db: SqlDatabase,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public async save(garment: Garment): Promise<void> {
    const row = garmentToRow(garment);
    wrapSync(
      () =>
        this.db.transaction(() => {
          const prior = this.db
            .prepare('SELECT version FROM garments WHERE id = ?')
            .get<{ version: number }>(garment.id);
          const version = (prior ? Number(prior.version) : 0) + 1;
          const changeType = prior ? 'updated' : 'created';

          this.db
            .prepare(
              `INSERT OR REPLACE INTO garments (${WRITE_COLUMNS}) VALUES (${WRITE_PLACEHOLDERS})`,
            )
            .run(
              row.id,
              row.name,
              row.category,
              row.subcategory,
              row.category_id,
              row.category_metadata,
              row.color_hex,
              row.color_name,
              row.secondary_colors,
              row.brand,
              row.size_system,
              row.size_value,
              row.size_measurements,
              row.material,
              row.seasons,
              row.images,
              row.tags,
              row.status,
              row.wear_count,
              row.last_worn_at,
              row.purchase_date,
              row.notes,
              row.metadata,
              version,
            );

          // Replace the garment's photographs (1:N).
          this.db.prepare('DELETE FROM photographs WHERE garment_id = ?').run(garment.id);
          const insertPhoto = this.db.prepare(
            `INSERT INTO photographs (${PHOTO_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );
          for (const photo of garment.photos) {
            const pr = photographToRow(garment.id, photo);
            insertPhoto.run(
              pr.id,
              pr.garment_id,
              pr.storage_key,
              pr.order,
              pr.rotation,
              pr.crop,
              pr.is_primary,
              pr.stage,
              pr.attributes,
            );
          }

          // Append a modification/audit record (basic versioning).
          this.db
            .prepare(
              'INSERT INTO garment_history (garment_id, version, change_type, changed_at, snapshot) VALUES (?, ?, ?, ?, ?)',
            )
            .run(garment.id, version, changeType, this.clock(), JSON.stringify(row));
        }),
      (cause) => new DatabaseError(`Failed to save garment ${garment.id}.`, cause),
    );
  }

  private loadPhotos(garmentId: string): Photograph[] {
    return this.db
      .prepare(`SELECT ${PHOTO_COLUMNS} FROM photographs WHERE garment_id = ? ORDER BY "order" ASC`)
      .all<PhotographRow>(garmentId)
      .map(photographToDomain);
  }

  private hydrate(row: GarmentRow): Garment {
    return garmentToDomain(row, this.loadPhotos(row.id));
  }

  public async findById(id: GarmentId): Promise<Garment | null> {
    const garment = wrapSync(
      () => {
        const row = this.db
          .prepare(`SELECT ${READ_COLUMNS} FROM garments WHERE id = ?`)
          .get<GarmentRow>(id);
        return row ? this.hydrate(row) : null;
      },
      (cause) => new DatabaseError(`Failed to load garment ${id}.`, cause),
    );
    return garment;
  }

  public async findAll(): Promise<readonly Garment[]> {
    return wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${READ_COLUMNS} FROM garments ORDER BY name ASC`)
          .all<GarmentRow>()
          .map((row) => this.hydrate(row)),
      (cause) => new DatabaseError('Failed to load garments.', cause),
    );
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
    let garments = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${READ_COLUMNS} FROM garments${where} ORDER BY name ASC`)
          .all<GarmentRow>(...params)
          .map((row) => this.hydrate(row)),
      (cause) => new DatabaseError('Failed to query garments.', cause),
    );
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

  public async findByCategory(category: string): Promise<readonly Garment[]> {
    return wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${READ_COLUMNS} FROM garments WHERE category = ? ORDER BY name ASC`)
          .all<GarmentRow>(category)
          .map((row) => this.hydrate(row)),
      (cause) => new DatabaseError(`Failed to load garments for category ${category}.`, cause),
    );
  }

  public async delete(id: GarmentId): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          // Explicit cascade (FK enforcement is not guaranteed on every driver).
          this.db.prepare('DELETE FROM photographs WHERE garment_id = ?').run(id);
          this.db.prepare('DELETE FROM garments WHERE id = ?').run(id);
        }),
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

  /* ------------------------- versioning / audit trail ---------------------- */

  /** Current persisted version of a garment (0 when it does not exist). */
  public async version(id: GarmentId): Promise<number> {
    const row = wrapSync(
      () =>
        this.db.prepare('SELECT version FROM garments WHERE id = ?').get<{ version: number }>(id),
      (cause) => new DatabaseError(`Failed to read version of garment ${id}.`, cause),
    );
    return row ? Number(row.version) : 0;
  }

  /** The full modification/audit history of a garment, oldest first. */
  public async history(id: GarmentId): Promise<readonly GarmentAuditEntry[]> {
    return wrapSync(
      () =>
        this.db
          .prepare(
            'SELECT version, change_type AS changeType, changed_at AS changedAt, snapshot FROM garment_history WHERE garment_id = ? ORDER BY seq ASC',
          )
          .all<GarmentAuditEntry>(id)
          .map((r) => ({
            version: Number(r.version),
            changeType: r.changeType,
            changedAt: r.changedAt,
            snapshot: r.snapshot,
          })),
      (cause) => new DatabaseError(`Failed to load history of garment ${id}.`, cause),
    );
  }
}
