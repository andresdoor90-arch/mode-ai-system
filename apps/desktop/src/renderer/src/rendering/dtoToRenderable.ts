/**
 * DTO → renderer-input adapter (renderer side).
 *
 * The Virtual Try-On screen receives plain IPC DTOs (recommendation sets of
 * garments), never AI/domain objects. This thin, pure module maps an
 * {@link OutfitRecommendationDTO} into the engine-agnostic
 * {@link RenderableOutfit} consumed by `@mas/rendering`. It keeps the render
 * layer decoupled from the AI engine: it touches only structured garment data
 * (id/name/category/subcategory/colour), and drops score/explanation entirely.
 */
import { type RenderableOutfit, toRenderableOutfit } from '@mas/rendering';

import type { GarmentDTO, OutfitRecommendationDTO } from '@shared/ipc';

/** Map one recommendation DTO to a renderable outfit (id = recommendation kind). */
export function recommendationToRenderable(
  recommendation: OutfitRecommendationDTO,
): RenderableOutfit {
  return toRenderableOutfit(recommendation.kind, recommendation.garments, recommendation.label);
}

/** Map a loose list of garment DTOs (e.g. a saved outfit) to a renderable outfit. */
export function garmentsToRenderable(
  id: string,
  garments: readonly GarmentDTO[],
  label?: string,
): RenderableOutfit {
  return toRenderableOutfit(id, garments, label);
}
