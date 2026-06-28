/**
 * Texture / Material Manager.
 *
 * Derives an engine-agnostic {@link MaterialDescriptor} from a garment's plain
 * attributes (colour + subcategory + tags). The mapping from fabric "kind" to
 * roughness/metalness/finish is a *visual* concern and lives here, not in the
 * domain. Results are memoised by a deterministic key so repeated builds (and
 * cache lookups) are cheap and stable. No engine, no I/O.
 */
import { colorFromHex, type ColorDescriptor } from '../abstraction/color';
import {
  type MaterialDescriptor,
  type RenderableGarment,
  type SurfaceFinish,
} from '../abstraction/types';
import { clamp } from '../abstraction/math';

interface FinishProfile {
  readonly finish: SurfaceFinish;
  readonly roughness: number;
  readonly metalness: number;
  readonly opacity: number;
}

const FINISH_PROFILES: Readonly<Record<SurfaceFinish, FinishProfile>> = Object.freeze({
  matte: { finish: 'matte', roughness: 0.9, metalness: 0, opacity: 1 },
  satin: { finish: 'satin', roughness: 0.55, metalness: 0, opacity: 1 },
  glossy: { finish: 'glossy', roughness: 0.25, metalness: 0.05, opacity: 1 },
  metallic: { finish: 'metallic', roughness: 0.3, metalness: 0.9, opacity: 1 },
  leather: { finish: 'leather', roughness: 0.45, metalness: 0, opacity: 1 },
  denim: { finish: 'denim', roughness: 0.85, metalness: 0, opacity: 1 },
  knit: { finish: 'knit', roughness: 0.95, metalness: 0, opacity: 1 },
});

/** Map a subcategory to a fabric finish. Unknown → matte. */
const finishForSubcategory = (subcategory: string): SurfaceFinish => {
  switch (subcategory) {
    case 'jeans':
      return 'denim';
    case 'leather-jacket':
    case 'boots':
    case 'loafers':
    case 'dress-shoes':
    case 'belt':
    case 'bag':
      return 'leather';
    case 'sweater':
    case 'hoodie':
    case 'cardigan':
    case 'scarf':
    case 'gloves':
      return 'knit';
    case 'blouse':
    case 'cocktail-dress':
    case 'evening-gown':
    case 'tie':
      return 'satin';
    case 'heels':
    case 'watch':
    case 'jewelry':
    case 'sunglasses':
      return 'glossy';
    default:
      return 'matte';
  }
};

const finishFromTags = (tags: readonly string[] | undefined): SurfaceFinish | null => {
  if (tags === undefined) {
    return null;
  }
  if (tags.includes('leather')) return 'leather';
  if (tags.includes('denim')) return 'denim';
  if (tags.includes('silk') || tags.includes('satin')) return 'satin';
  if (tags.includes('wool') || tags.includes('knit')) return 'knit';
  if (tags.includes('metallic') || tags.includes('sequin')) return 'metallic';
  if (tags.includes('sheer')) return 'matte';
  return null;
};

export class TextureManager {
  private readonly cache = new Map<string, MaterialDescriptor>();

  /** Build (or reuse) the material for a garment. */
  public materialFor(garment: RenderableGarment): MaterialDescriptor {
    const key = this.keyFor(garment);
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const material = this.buildMaterial(garment);
    this.cache.set(key, material);
    return material;
  }

  /** Stable cache key for a garment's material. */
  public keyFor(garment: RenderableGarment): string {
    const tags = (garment.tags ?? []).slice().sort().join('+');
    return `${garment.colorHex.toLowerCase()}|${garment.subcategory}|${tags}`;
  }

  /** Texture asset key, derived from the resolved finish. */
  public textureKeyFor(finish: SurfaceFinish): string {
    return `texture:fabric/${finish}`;
  }

  public clear(): void {
    this.cache.clear();
  }

  public get size(): number {
    return this.cache.size;
  }

  private buildMaterial(garment: RenderableGarment): MaterialDescriptor {
    const color: ColorDescriptor = colorFromHex(garment.colorHex);
    const finish = finishFromTags(garment.tags) ?? finishForSubcategory(garment.subcategory);
    const profile = FINISH_PROFILES[finish];
    const sheer = (garment.tags ?? []).includes('sheer');
    return {
      color,
      roughness: clamp(profile.roughness, 0, 1),
      metalness: clamp(profile.metalness, 0, 1),
      opacity: sheer ? 0.7 : profile.opacity,
      finish,
      textureKey: this.textureKeyFor(finish),
    };
  }
}
