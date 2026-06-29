import {
  type GarmentId,
  type IOutfitHistoryRepository,
  type OutfitHistoryEntry,
  type OutfitHistoryEntryId,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type OutfitHistoryRow,
  outfitHistoryToDomain,
  outfitHistoryToRow,
} from './mappers/outfitHistoryMapper';

const COLUMNS =
  'id, outfit_id, garment_ids, signature, label, worn_on, worn_time, place, event, occasion, weather, temperature_c, role, comments, satisfaction, source, attributes, created_at';

const PLACEHOLDERS = COLUMNS.split(',')
  .map(() => '?')
  .join(', ');

/**
 * SQLite-backed {@link IOutfitHistoryRepository}: the definitive, persistent
 * outfit-usage history. Stores the worn combination plus the rich, extensible
 * usage context (date/time/place/event/weather/temperature/role/comments/
 * satisfaction). Search / filter / sort / statistics are pure application logic
 * over {@link findAll}; this repository only persists and retrieves.
 */
export class SqlOutfitHistoryRepository implements IOutfitHistoryRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(entry: OutfitHistoryEntry): Promise<void> {
    const row = outfitHistoryToRow(entry);
    wrapSync(
      () =>
        this.db
          .prepare(`INSERT OR REPLACE INTO outfit_history (${COLUMNS}) VALUES (${PLACEHOLDERS})`)
          .run(
            row.id,
            row.outfit_id,
            row.garment_ids,
            row.signature,
            row.label,
            row.worn_on,
            row.worn_time,
            row.place,
            row.event,
            row.occasion,
            row.weather,
            row.temperature_c,
            row.role,
            row.comments,
            row.satisfaction,
            row.source,
            row.attributes,
            row.created_at,
          ),
      (cause) => new DatabaseError(`Failed to save history entry ${entry.id}.`, cause),
    );
  }

  public async findById(id: OutfitHistoryEntryId): Promise<OutfitHistoryEntry | null> {
    const row = wrapSync(
      () =>
        this.db.prepare(`SELECT ${COLUMNS} FROM outfit_history WHERE id = ?`).get<OutfitHistoryRow>(id),
      (cause) => new DatabaseError(`Failed to load history entry ${id}.`, cause),
    );
    return row ? outfitHistoryToDomain(row) : null;
  }

  public async findAll(): Promise<readonly OutfitHistoryEntry[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${COLUMNS} FROM outfit_history ORDER BY worn_on DESC, created_at DESC`)
          .all<OutfitHistoryRow>(),
      (cause) => new DatabaseError('Failed to load outfit history.', cause),
    );
    return rows.map(outfitHistoryToDomain);
  }

  public async findByGarment(garmentId: GarmentId): Promise<readonly OutfitHistoryEntry[]> {
    // Pre-filter with a LIKE on the JSON id list, then verify exactly in the
    // domain (the entry knows its real garment ids).
    const rows = wrapSync(
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS} FROM outfit_history WHERE garment_ids LIKE ? ORDER BY worn_on DESC, created_at DESC`,
          )
          .all<OutfitHistoryRow>(`%"${garmentId}"%`),
      (cause) => new DatabaseError(`Failed to load history for garment ${garmentId}.`, cause),
    );
    return rows.map(outfitHistoryToDomain).filter((e) => e.garmentIds.includes(garmentId));
  }

  public async delete(id: OutfitHistoryEntryId): Promise<void> {
    wrapSync(
      () => this.db.prepare('DELETE FROM outfit_history WHERE id = ?').run(id),
      (cause) => new DatabaseError(`Failed to delete history entry ${id}.`, cause),
    );
  }

  public async count(): Promise<number> {
    const row = wrapSync(
      () => this.db.prepare('SELECT COUNT(*) AS n FROM outfit_history').get<{ n: number }>(),
      (cause) => new DatabaseError('Failed to count outfit history.', cause),
    );
    return Number(row?.n ?? 0);
  }
}
