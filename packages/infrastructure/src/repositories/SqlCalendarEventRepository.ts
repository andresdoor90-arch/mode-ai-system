import { type CalendarEvent, type CalendarEventId, type ICalendarEventRepository } from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type CalendarEventRow,
  calendarEventToDomain,
  calendarEventToRow,
} from './mappers/calendarEventMapper';

/** SQLite-backed {@link ICalendarEventRepository}. */
export class SqlCalendarEventRepository implements ICalendarEventRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(event: CalendarEvent): Promise<void> {
    const row = calendarEventToRow(event);
    wrapSync(
      () =>
        this.db
          .prepare(
            'INSERT OR REPLACE INTO calendar_events (id, title, date, occasion, dress_code, suggested_outfit_ids) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(row.id, row.title, row.date, row.occasion, row.dress_code, row.suggested_outfit_ids),
      (cause) => new DatabaseError(`Failed to save calendar event ${event.id}.`, cause),
    );
  }

  public async findById(id: CalendarEventId): Promise<CalendarEvent | null> {
    const row = wrapSync(
      () => this.db.prepare('SELECT * FROM calendar_events WHERE id = ?').get<CalendarEventRow>(id),
      (cause) => new DatabaseError(`Failed to load calendar event ${id}.`, cause),
    );
    return row ? calendarEventToDomain(row) : null;
  }

  public async findAll(): Promise<readonly CalendarEvent[]> {
    const rows = wrapSync(
      () =>
        this.db.prepare('SELECT * FROM calendar_events ORDER BY date ASC').all<CalendarEventRow>(),
      (cause) => new DatabaseError('Failed to load calendar events.', cause),
    );
    return rows.map(calendarEventToDomain);
  }

  public async findBetween(
    fromIsoDate: string,
    toIsoDate: string,
  ): Promise<readonly CalendarEvent[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare('SELECT * FROM calendar_events WHERE date >= ? AND date <= ? ORDER BY date ASC')
          .all<CalendarEventRow>(fromIsoDate, toIsoDate),
      (cause) => new DatabaseError('Failed to load calendar events in range.', cause),
    );
    return rows.map(calendarEventToDomain);
  }

  public async delete(id: CalendarEventId): Promise<void> {
    wrapSync(
      () => this.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id),
      (cause) => new DatabaseError(`Failed to delete calendar event ${id}.`, cause),
    );
  }
}
