import {
  CalendarEvent,
  type DressCode,
  type Occasion,
  type OutfitId,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toJson } from './mapperUtils';

/** Raw `calendar_events` table row. */
export interface CalendarEventRow {
  id: string;
  title: string;
  date: string;
  occasion: string;
  dress_code: string | null;
  suggested_outfit_ids: string;
}

/** Reconstruct a {@link CalendarEvent} from a row. */
export const calendarEventToDomain = (row: CalendarEventRow): CalendarEvent => {
  const dressCode = row.dress_code ?? undefined;
  const suggestedOutfitIds = parseJson<string[]>(
    row.suggested_outfit_ids,
    [],
    `event ${row.id} suggestions`,
  ).map((id) => toId<'Outfit'>(id));

  return mustOk(
    CalendarEvent.create(toId<'CalendarEvent'>(row.id), {
      title: row.title,
      date: row.date,
      occasion: row.occasion as Occasion,
      suggestedOutfitIds,
      ...(dressCode !== undefined ? { dressCode: dressCode as DressCode } : {}),
    }),
    `event ${row.id}`,
  );
};

/** Flatten a {@link CalendarEvent} into a row. */
export const calendarEventToRow = (event: CalendarEvent): CalendarEventRow => ({
  id: event.id,
  title: event.title,
  date: event.date,
  occasion: event.occasion,
  dress_code: event.dressCode ?? null,
  suggested_outfit_ids: toJson(event.suggestedOutfitIds as readonly OutfitId[]),
});
