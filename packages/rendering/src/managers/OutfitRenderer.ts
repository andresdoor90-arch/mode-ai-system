/**
 * Outfit Renderer.
 *
 * Turns a whole {@link RenderableOutfit} into an ordered list of
 * {@link ClothingLayer}s ready for the engine. Responsibilities (all visual,
 * none business):
 *  - delegate each garment to the {@link ClothingRenderer};
 *  - resolve *visual* slot occupancy so layers stack believably — a full-body
 *    garment (dress/jumpsuit) hides separate upper/lower layers; within an
 *    exclusive slot the first garment wins and extras are marked not-visible
 *    (kept in the list for inspection, never drawn twice);
 *  - sort deterministically by draw order then garment id, so the SAME outfit
 *    always yields the SAME layer list ("consistent representation").
 *
 * Swapping garments when the recommendation changes is just calling this again
 * with the new outfit — there is no hidden state.
 */
import { EXCLUSIVE_SLOTS, GarmentLayerSlot } from '../abstraction/slots';
import { type ClothingLayer, type RenderableOutfit } from '../abstraction/types';
import { ClothingRenderer } from './ClothingRenderer';

export class OutfitRenderer {
  private readonly clothing: ClothingRenderer;

  public constructor(clothing: ClothingRenderer = new ClothingRenderer()) {
    this.clothing = clothing;
  }

  /** Resolve an outfit into ordered, visibility-resolved clothing layers. */
  public toLayers(outfit: RenderableOutfit): readonly ClothingLayer[] {
    const layers = outfit.garments.map((g) => this.clothing.toLayer(g));
    const resolved = this.resolveVisibility(layers);
    return this.sort(resolved);
  }

  private resolveVisibility(layers: readonly ClothingLayer[]): ClothingLayer[] {
    const hasFullBody = layers.some((l) => l.slot === GarmentLayerSlot.FullBody);
    const occupied = new Set<GarmentLayerSlot>();

    return layers.map((layer) => {
      let visible = true;

      // A dress/jumpsuit visually supersedes separate top & bottom layers.
      if (
        hasFullBody &&
        (layer.slot === GarmentLayerSlot.UpperBody || layer.slot === GarmentLayerSlot.LowerBody)
      ) {
        visible = false;
      }

      // Only the first garment in an exclusive slot is drawn.
      if (visible && EXCLUSIVE_SLOTS.includes(layer.slot)) {
        if (occupied.has(layer.slot)) {
          visible = false;
        } else {
          occupied.add(layer.slot);
        }
      }

      return visible === layer.visible ? layer : { ...layer, visible };
    });
  }

  private sort(layers: ClothingLayer[]): ClothingLayer[] {
    return [...layers].sort((a, b) => {
      if (a.renderOrder !== b.renderOrder) {
        return a.renderOrder - b.renderOrder;
      }
      return a.garmentId < b.garmentId ? -1 : a.garmentId > b.garmentId ? 1 : 0;
    });
  }
}
