import { randomUUID } from 'node:crypto';

import { StorageError } from '../errors/InfrastructureError';
import {
  type IFileStorage,
  type StoredFile,
  buildStorageKey,
  contentTypeForExtension,
} from './FileStorage';

/** Persisted metadata describing a stored garment image. */
export interface ImageMetadata {
  readonly key: string;
  readonly originalName: string | null;
  readonly contentType: string | null;
  readonly size: number;
  readonly createdAt: string;
}

/** Extensions accepted by the image store. */
export const ALLOWED_IMAGE_EXTENSIONS: readonly string[] = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'avif',
];

const IMAGE_NAMESPACE = 'images';

/**
 * Image file management at the infrastructure level.
 *
 * This is storage I/O only: it saves, retrieves and deletes raw image bytes and
 * tracks lightweight metadata. It performs **no** image *processing* (resizing,
 * background removal, colour extraction) — that lives in a later phase. It
 * delegates the actual byte persistence to an injected {@link IFileStorage}, so
 * the same logic works against local disk today and any other backend later.
 */
export class ImageStorageService {
  public constructor(
    private readonly storage: IFileStorage,
    private readonly maxBytes: number = 25 * 1024 * 1024,
  ) {}

  /** Store image bytes for a garment, returning its metadata. */
  public async saveImage(
    data: Uint8Array,
    options: { extension?: string; originalName?: string; contentType?: string } = {},
  ): Promise<ImageMetadata> {
    if (data.byteLength === 0) {
      throw new StorageError('Refusing to store an empty image.');
    }
    if (data.byteLength > this.maxBytes) {
      throw new StorageError(
        `Image of ${data.byteLength} bytes exceeds the ${this.maxBytes}-byte limit.`,
      );
    }
    const extension = normaliseExtension(options.extension, options.originalName);
    if (extension !== undefined && !ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
      throw new StorageError(`Unsupported image extension "${extension}".`);
    }
    const key = buildStorageKey(IMAGE_NAMESPACE, randomUUID(), extension);
    const saveOptions =
      options.contentType !== undefined
        ? { contentType: options.contentType, ...(extension !== undefined ? { extension } : {}) }
        : extension !== undefined
          ? { extension }
          : {};
    const stored: StoredFile = await this.storage.saveAs(key, data, saveOptions);
    return {
      key: stored.key,
      originalName: options.originalName ?? null,
      contentType: stored.contentType ?? contentTypeForExtension(extension),
      size: stored.size,
      createdAt: stored.createdAt,
    };
  }

  /** Retrieve raw image bytes by key. */
  public async getImage(key: string): Promise<Uint8Array> {
    return this.storage.read(key);
  }

  /** Whether an image key exists. */
  public async hasImage(key: string): Promise<boolean> {
    return this.storage.exists(key);
  }

  /** Delete a single image by key. */
  public async deleteImage(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  /** List every stored image key. */
  public async listImages(): Promise<readonly string[]> {
    return this.storage.list(IMAGE_NAMESPACE);
  }

  /**
   * Garbage-collect orphaned images: delete any stored image whose key is not
   * present in the supplied set of keys still referenced by garments. Returns
   * the keys that were removed.
   */
  public async pruneOrphans(referencedKeys: Iterable<string>): Promise<readonly string[]> {
    const referenced = new Set(referencedKeys);
    const all = await this.listImages();
    const removed: string[] = [];
    for (const key of all) {
      if (!referenced.has(key)) {
        await this.storage.delete(key);
        removed.push(key);
      }
    }
    return removed;
  }
}

/** Derive a lowercase extension from an explicit value or a filename. */
const normaliseExtension = (
  explicit: string | undefined,
  originalName: string | undefined,
): string | undefined => {
  if (explicit !== undefined && explicit.length > 0) {
    return explicit.replace(/^\./, '').toLowerCase();
  }
  if (originalName !== undefined) {
    const dot = originalName.lastIndexOf('.');
    if (dot > 0 && dot < originalName.length - 1) {
      return originalName.slice(dot + 1).toLowerCase();
    }
  }
  return undefined;
};
