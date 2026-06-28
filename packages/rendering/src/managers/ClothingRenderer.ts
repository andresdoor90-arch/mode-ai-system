/**
 * Clothing Renderer.
 *
 * Turns ONE plain {@link RenderableGarment} into a drawable {@link ClothingLayer}
 * by combining: the visual slot/region/draw-order (from `slots`), the material
 * (from the Texture Manager) and the mesh asset key (from the Asset Manager).
 * It re-uses the domain's already-decided category — it does NOT decide what to
 * wear or validate combinations (that is the domain's job).
 */
import { categoryToSlot, slotRenderOrder, slotToRegion } from '../abstraction/slots';
import { type ClothingLayer, type RenderableGarment } from '../abstraction/types';
import { AssetManager } from './AssetManager';
import { TextureManager } from './TextureManager';

export class ClothingRenderer {
  private readonly assets: AssetManager;
  private readonly textures: TextureManager;

  public constructor(
    assets: AssetManager = new AssetManager(),
    textures: TextureManager = new TextureManager(),
  ) {
    this.assets = assets;
    this.textures = textures;
  }

  /** Resolve a single garment into a visible clothing layer. */
  public toLayer(garment: RenderableGarment): ClothingLayer {
    const slot = categoryToSlot(garment.category);
    return {
      garmentId: garment.id,
      name: garment.name,
      slot,
      region: slotToRegion(slot),
      renderOrder: slotRenderOrder(slot),
      material: this.textures.materialFor(garment),
      meshKey: this.assets.resolveGarmentMesh(garment.category, garment.subcategory),
      visible: true,
    };
  }
}
