/**
 * Render Cache.
 *
 * Memoises built {@link SceneDescription}s by a deterministic key so that
 * re-showing an outfit (e.g. toggling back to a previous recommendation, or a
 * pure camera move that re-uses the same scene) is instant and visually stable.
 *
 * The key is derived ONLY from inputs that affect the drawn result: the avatar
 * signature, the outfit id, the (order-independent) set of garment id+colour
 * pairs, the active view preset and the lighting preset. Because garment order
 * does not change the key, the same outfit always maps to the same scene —
 * guaranteeing "consistent representation across recommendations". When the
 * recommendation changes, the outfit id / garment set changes, so the key
 * changes and a fresh scene is built (automatic swap).
 *
 * A small LRU bound keeps memory predictable.
 */
import {
  type RenderableOutfit,
  type SceneDescription,
  type ViewPreset,
} from '../abstraction/types';

export interface CacheKeyParts {
  readonly avatarSignature: string;
  readonly outfit: RenderableOutfit;
  readonly view: ViewPreset;
  readonly lightingPreset: string;
}

/** Build the deterministic, order-independent cache key for a scene. */
export const buildCacheKey = (parts: CacheKeyParts): string => {
  const garments = parts.outfit.garments
    .map((g) => `${g.id}:${g.colorHex.toLowerCase()}`)
    .sort()
    .join(',');
  return [
    `avatar=${parts.avatarSignature}`,
    `outfit=${parts.outfit.id}`,
    `garments=[${garments}]`,
    `view=${parts.view}`,
    `light=${parts.lightingPreset}`,
  ].join('|');
};

export interface RenderCacheOptions {
  /** Maximum number of scenes to retain (default 24). */
  readonly maxEntries?: number;
}

export class RenderCache {
  private readonly maxEntries: number;
  private readonly store = new Map<string, SceneDescription>();

  public constructor(options: RenderCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 24);
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }

  /** Get a cached scene, refreshing its LRU recency. */
  public get(key: string): SceneDescription | undefined {
    const value = this.store.get(key);
    if (value !== undefined) {
      // Refresh recency: re-insert at the end.
      this.store.delete(key);
      this.store.set(key, value);
    }
    return value;
  }

  /** Store a scene, evicting the least-recently-used entry when full. */
  public set(key: string, scene: SceneDescription): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, scene);
  }

  /** Remove every cached scene belonging to a given outfit id. */
  public invalidateOutfit(outfitId: string): number {
    let removed = 0;
    for (const [key, scene] of this.store) {
      if (scene.outfitId === outfitId) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  public clear(): void {
    this.store.clear();
  }

  public get size(): number {
    return this.store.size;
  }

  /** Currently cached keys, most-recently-used last. */
  public keys(): readonly string[] {
    return [...this.store.keys()];
  }
}
