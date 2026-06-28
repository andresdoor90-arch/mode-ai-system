import { type CalendarEventId } from '../../shared/Identifier';
import { type CalendarEvent } from '../entities/CalendarEvent';

/**
 * Persistence contract for {@link CalendarEvent} entities.
 */
export interface ICalendarEventRepository {
  save(event: CalendarEvent): Promise<void>;
  findById(id: CalendarEventId): Promise<CalendarEvent | null>;
  findAll(): Promise<readonly CalendarEvent[]>;
  /** Events whose date falls within the inclusive [from, to] ISO date range. */
  findBetween(fromIsoDate: string, toIsoDate: string): Promise<readonly CalendarEvent[]>;
  delete(id: CalendarEventId): Promise<void>;
}
