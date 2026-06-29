/**
 * Payload → domain coercion helpers (main process only).
 *
 * IPC payloads carry primitive strings (a category name, a hex colour, season
 * identifiers). These helpers validate and convert them into the `@mas/core`
 * value objects the use cases expect, raising a descriptive error when a value
 * is not a member of its domain enum.
 */
import {
  Color,
  GarmentCategory,
  Occasion,
  Season,
  type CreateGarmentInput,
} from '@mas/core';

import type { AddGarmentPayload } from '../../shared/ipc';

function assertEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string,
  label: string,
): T[keyof T] {
  if ((Object.values(enumObj) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  throw new Error(`"${value}" is not a valid ${label}.`);
}

export function toGarmentCategory(value: string): GarmentCategory {
  return assertEnum(GarmentCategory, value, 'garment category');
}

export function toSeason(value: string): Season {
  return assertEnum(Season, value, 'season');
}

export function toOccasion(value: string): Occasion {
  return assertEnum(Occasion, value, 'occasion');
}

export function toColor(hex: string, name?: string): Color {
  const result = Color.fromHex(hex, name);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

/** Build a {@link CreateGarmentInput} from the add-garment IPC payload.
 *
 * Phase 6.5: the category is a DYNAMIC string (a user-defined category slug),
 * no longer validated against a fixed enum. When the garment references a
 * user-defined category by id, the main handler resolves and attaches its
 * {@link CategoryMetadata}; otherwise the domain falls back to the seed
 * taxonomy keyed by category/subcategory. */
export function toCreateGarmentInput(payload: AddGarmentPayload): CreateGarmentInput {
  const seasons = payload.seasons.map(toSeason);
  return {
    name: payload.name,
    category: payload.category,
    subcategory: payload.subcategory,
    color: toColor(payload.colorHex, payload.colorName),
    seasons,
    ...(payload.brand !== undefined ? { brand: payload.brand } : {}),
    ...(payload.material !== undefined ? { material: payload.material } : {}),
    ...(payload.tags !== undefined ? { tags: [...payload.tags] } : {}),
  };
}
