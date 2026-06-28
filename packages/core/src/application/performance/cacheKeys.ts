/**
 * Deterministic thumbnail/image cache keys and a small LRU cache (Module 8).
 *
 * A stable key for a (photo, size, transform) triple lets the image cache reuse
 * a previously generated thumbnail across renders and sessions. The LRU bounds
 * memory for thousands of photos. Both are pure and offline-testable; the actual
 * thumbnail bytes are produced by an infrastructure adapter (deferred).
 */
import { type CropRect, type RotationDegrees } from '../../domain/value-objects/Photograph';

export interface ThumbnailSpec {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  readonly rotation?: RotationDegrees;
  readonly crop?: CropRect;
}

const roundCrop = (c: CropRect): string =>
  [c.x, c.y, c.width, c.height].map((n) => n.toFixed(3)).join('_');

/** Build a stable, collision-resistant cache key for a thumbnail request. */
export const thumbnailCacheKey = (spec: ThumbnailSpec): string => {
  const rotation = spec.rotation ?? 0;
  const crop = spec.crop ? roundCrop(spec.crop) : '0_0_1_1';
  const w = Math.max(1, Math.round(spec.width));
  const h = Math.max(1, Math.round(spec.height));
  return `thumb:${spec.storageKey}:${w}x${h}:r${rotation}:c${crop}`;
};

/**
 * A bounded least-recently-used cache. Generic over the cached value (a data
 * URL, an object URL, decoded bytes…). Eviction is O(1) thanks to Map insertion
 * order.
 */
export class LruCache<V> {
  private readonly store = new Map<string, V>();

  public constructor(private readonly capacity = 256) {}

  public get size(): number {
    return this.store.size;
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }

  public get(key: string): V | undefined {
    const value = this.store.get(key);
    if (value !== undefined) {
      // Touch: move to most-recently-used position.
      this.store.delete(key);
      this.store.set(key, value);
    }
    return value;
  }

  public set(key: string, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, value);
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  /** Keys ordered least- to most-recently-used (eviction order). */
  public keys(): readonly string[] {
    return [...this.store.keys()];
  }
}
