/**
 * Asset Manager.
 *
 * Resolves logical assets (avatar base meshes, per-category garment meshes,
 * accessory meshes) to stable *asset keys*. It performs NO file/network I/O and
 * holds NO business rules — it is a pure registry/resolver so it is fully
 * testable offline and so the actual loading strategy (GLTF from disk, a
 * procedural primitive, a remote CDN) is decided by the engine adapter, not
 * here. Swapping the avatar model or adding accessories is a manifest edit.
 */
import { type AvatarModelId, type BodyType } from '../abstraction/types';

/** A registered avatar base model and the body types it supports. */
export interface AvatarAsset {
  readonly modelId: AvatarModelId;
  readonly label: string;
  /** Asset key per body type; falls back to the model's default. */
  readonly meshKeysByBodyType: Readonly<Partial<Record<BodyType, string>>>;
  readonly defaultMeshKey: string;
}

/** The asset registry the manager resolves against. */
export interface AssetManifest {
  readonly avatars: readonly AvatarAsset[];
  /** Garment mesh key by category (e.g. `tops` → `mesh:garment/tops`). */
  readonly garmentMeshByCategory: Readonly<Record<string, string>>;
  /** Accessory mesh key by subcategory (future-proofing extension point). */
  readonly accessoryMeshBySubcategory: Readonly<Record<string, string>>;
  readonly fallbackGarmentMeshKey: string;
}

/** The built-in default manifest (procedural primitives in the engine adapter). */
export const DEFAULT_MANIFEST: AssetManifest = Object.freeze({
  avatars: Object.freeze([
    {
      modelId: 'mannequin-v1',
      label: 'Maniquí neutro',
      defaultMeshKey: 'mesh:avatar/mannequin-v1/neutral',
      meshKeysByBodyType: Object.freeze({
        neutral: 'mesh:avatar/mannequin-v1/neutral',
        feminine: 'mesh:avatar/mannequin-v1/feminine',
        masculine: 'mesh:avatar/mannequin-v1/masculine',
        athletic: 'mesh:avatar/mannequin-v1/athletic',
        plus: 'mesh:avatar/mannequin-v1/plus',
      }),
    },
  ]) as readonly AvatarAsset[],
  garmentMeshByCategory: Object.freeze({
    tops: 'mesh:garment/tops',
    bottoms: 'mesh:garment/bottoms',
    dresses: 'mesh:garment/dresses',
    outerwear: 'mesh:garment/outerwear',
    shoes: 'mesh:garment/shoes',
    accessories: 'mesh:garment/accessories',
  }),
  accessoryMeshBySubcategory: Object.freeze({
    hat: 'mesh:accessory/hat',
    scarf: 'mesh:accessory/scarf',
    tie: 'mesh:accessory/tie',
    belt: 'mesh:accessory/belt',
    bag: 'mesh:accessory/bag',
    watch: 'mesh:accessory/watch',
    jewelry: 'mesh:accessory/jewelry',
    sunglasses: 'mesh:accessory/sunglasses',
    gloves: 'mesh:accessory/gloves',
  }),
  fallbackGarmentMeshKey: 'mesh:garment/generic',
});

export class AssetManager {
  private readonly manifest: AssetManifest;

  public constructor(manifest: AssetManifest = DEFAULT_MANIFEST) {
    this.manifest = manifest;
  }

  /** All avatar models available to swap between (future model picker). */
  public listAvatarModels(): readonly AvatarAsset[] {
    return this.manifest.avatars;
  }

  /** Whether a given avatar model id is registered. */
  public hasAvatarModel(modelId: AvatarModelId): boolean {
    return this.manifest.avatars.some((a) => a.modelId === modelId);
  }

  /** Resolve the avatar mesh key for a model + body type (with fallbacks). */
  public resolveAvatarMesh(modelId: AvatarModelId, bodyType: BodyType): string {
    const asset =
      this.manifest.avatars.find((a) => a.modelId === modelId) ?? this.manifest.avatars[0];
    if (asset === undefined) {
      return 'mesh:avatar/fallback';
    }
    return asset.meshKeysByBodyType[bodyType] ?? asset.defaultMeshKey;
  }

  /** Resolve the mesh key for a garment, preferring accessory-specific meshes. */
  public resolveGarmentMesh(category: string, subcategory: string): string {
    if (category === 'accessories') {
      const accessory = this.manifest.accessoryMeshBySubcategory[subcategory];
      if (accessory !== undefined) {
        return accessory;
      }
    }
    return this.manifest.garmentMeshByCategory[category] ?? this.manifest.fallbackGarmentMeshKey;
  }
}
