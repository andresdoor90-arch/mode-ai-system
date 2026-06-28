/**
 * Domain → DTO mappers (main process only).
 *
 * Converts rich `@mas/core` domain objects into the plain, structured-clone
 * safe shapes declared in the shared IPC contract. This is the single place
 * where the domain model is translated for transport; the renderer never sees
 * a domain class instance.
 */
import type { Color, Garment, Outfit, WardrobeCollection, Category, Photograph } from '@mas/core';
import type { RecommendationSet } from '@mas/core';

import type {
  ColorDTO,
  ColorPaletteDTO,
  GarmentDTO,
  GarmentStatusDTO,
  OutfitDTO,
  CollectionDTO,
  PhotoDTO,
  CategoryDTO,
  RecommendationSetDTO,
} from '../../shared/ipc';

export function colorToDto(color: Color): ColorDTO {
  return {
    hex: color.hex,
    name: color.name,
    category: String(color.category),
    isNeutral: color.isNeutral,
  };
}

export function photoToDto(photo: Photograph): PhotoDTO {
  return {
    id: photo.id,
    storageKey: photo.storageKey,
    order: photo.order,
    rotation: photo.rotation,
    crop: { ...photo.crop },
    isPrimary: photo.isPrimary,
    stage: photo.stage,
  };
}

export function categoryToDto(category: Category): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    group: category.group,
    order: category.order,
    seeded: category.seeded,
    metadata: {
      layerSlot: String(category.metadata.layerSlot),
      formality: category.metadata.formality,
      comfort: category.metadata.comfort,
      heavyOuterwear: category.metadata.heavyOuterwear,
      attributes: { ...category.metadata.attributes },
    },
  };
}

export function garmentToDto(garment: Garment): GarmentDTO {
  return {
    id: garment.id,
    name: garment.name,
    category: String(garment.category),
    subcategory: garment.subcategory,
    categoryId: garment.categoryId ?? null,
    color: colorToDto(garment.color),
    secondaryColors: garment.secondaryColors.map(colorToDto),
    brand: garment.brand ?? null,
    material: garment.material ?? null,
    seasons: garment.seasons.map(String),
    images: [...garment.images],
    photos: garment.photos.map(photoToDto),
    tags: [...garment.tags],
    status: garment.status as GarmentStatusDTO,
    wearCount: garment.wearCount,
    formality: garment.formality,
    lastWornAt: garment.lastWornAt ?? null,
    purchaseDate: garment.purchaseDate ?? null,
    notes: garment.notes ?? null,
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

/** Map a full orchestration result to its serialisable DTO. */
export function recommendationSetToDto(set: RecommendationSet): RecommendationSetDTO {
  return {
    occasion: String(set.context.occasion),
    season: String(set.context.season),
    recommendations: set.recommendations.map((rec) => ({
      kind: rec.kind,
      label: rec.label,
      garments: rec.garments.map(garmentToDto),
      score: rec.score,
      explanation: rec.explanation,
    })),
    providerId: set.providerId,
    degraded: set.degraded,
    notes: [...set.notes],
  };
}
