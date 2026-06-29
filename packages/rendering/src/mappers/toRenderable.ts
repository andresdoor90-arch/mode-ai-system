/**
 * Mappers from plain, transport-shaped data to the renderer's input types.
 *
 * These accept *structural* shapes (a subset of the app's `GarmentDTO` /
 * recommendation DTOs) so the desktop layer can hand DTOs straight in WITHOUT
 * this package importing Electron, the IPC contract or the domain. The renderer
 * therefore depends only on the shape of structured garment data — exactly the
 * "consume only structured domain information" mandate.
 */
import { type RenderableGarment, type RenderableOutfit } from '../abstraction/types';

/** Minimal colour shape (a subset of the app's `ColorDTO`). */
export interface ColorLike {
  readonly hex: string;
  readonly name?: string | null;
  readonly isNeutral?: boolean;
}

/** Minimal garment shape (a subset of the app's `GarmentDTO`). */
export interface GarmentLike {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly color: ColorLike;
  readonly tags?: readonly string[];
}

/** Map one structured garment into a {@link RenderableGarment}. */
export const toRenderableGarment = (garment: GarmentLike): RenderableGarment => ({
  id: garment.id,
  name: garment.name,
  category: garment.category,
  subcategory: garment.subcategory,
  colorHex: garment.color.hex,
  ...(garment.color.name != null ? { colorName: garment.color.name } : {}),
  ...(garment.color.isNeutral !== undefined ? { isNeutral: garment.color.isNeutral } : {}),
  ...(garment.tags !== undefined ? { tags: garment.tags } : {}),
});

/** Map a set of structured garments into a {@link RenderableOutfit}. */
export const toRenderableOutfit = (
  id: string,
  garments: readonly GarmentLike[],
  label?: string,
): RenderableOutfit => ({
  id,
  ...(label !== undefined ? { label } : {}),
  garments: garments.map(toRenderableGarment),
});
