/**
 * Domain → DTO mappers (main process only).
 *
 * Converts rich `@mas/core` domain objects into the plain, structured-clone
 * safe shapes declared in the shared IPC contract. This is the single place
 * where the domain model is translated for transport; the renderer never sees
 * a domain class instance.
 */
import type { Color, Garment, Outfit, WardrobeCollection } from '@mas/core';

import type {
  ColorDTO,
  ColorPaletteDTO,
  GarmentDTO,
  GarmentStatusDTO,
  OutfitDTO,
  CollectionDTO,
} from '../../shared/ipc';

export function colorToDto(color: Color): ColorDTO {
  return {
    hex: color.hex,
    name: color.name,
    category: String(color.category),
    isNeutral: color.isNeutral,
  };
}

export function garmentToDto(garment: Garment): GarmentDTO {
  return {
    id: garment.id,
    name: garment.name,
    category: String(garment.category),
    subcategory: garment.subcategory,
    color: colorToDto(garment.color),
    brand: garment.brand ?? null,
    seasons: garment.seasons.map(String),
    images: [...garment.images],
    tags: [...garment.tags],
    status: garment.status as GarmentStatusDTO,
    wearCount: garment.wearCount,
    lastWornAt: garment.lastWornAt ?? null,
  };
}

export function collectionToDto(collection: WardrobeCollection): CollectionDTO {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description ?? null,
    garmentIds: [...collection.garmentIds],
  };
}

export function outfitToDto(outfit: Outfit): OutfitDTO {
  return {
    id: outfit.id,
    name: outfit.name,
    garments: outfit.garments.map(garmentToDto),
    occasion: String(outfit.occasion),
    season: String(outfit.season),
    rating: outfit.rating ?? null,
    notes: outfit.notes ?? null,
    createdAt: outfit.createdAt,
  };
}

export function colorsToPaletteDto(colors: readonly Color[]): ColorPaletteDTO {
  return { colors: colors.map(colorToDto) };
}
