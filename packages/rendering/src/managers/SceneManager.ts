/**
 * Scene Manager.
 *
 * The composition root of the rendering layer (still pure & engine-free). It
 * wires together the Avatar Manager, Outfit Renderer, Camera Controller,
 * Lighting Manager and Render Cache to produce a complete, declarative
 * {@link SceneDescription}. Responsibilities:
 *  - hold the "current" outfit and rebuild the scene when the recommendation
 *    changes (automatic garment swap);
 *  - keep ONE avatar instance so the character stays consistent across every
 *    recommendation;
 *  - serve cached scenes for already-seen outfits;
 *  - expose camera intent (rotate 360°, zoom, view presets) and lighting/avatar
 *    swaps, each returning a freshly composed scene.
 *
 * It contains NO business rules and never imports a graphics engine — the React
 * adapter takes the {@link SceneDescription} it returns and feeds an
 * {@link IRenderEngine}.
 */
import { colorFromHex, type ColorDescriptor } from '../abstraction/color';
import {
  type CameraState,
  type RenderableOutfit,
  type SceneDescription,
  type ViewPreset,
  type AvatarModelId,
  type BodyType,
  type LightingPreset,
} from '../abstraction/types';
import { AvatarManager } from './AvatarManager';
import { CameraController } from './CameraController';
import { LightingManager } from './LightingManager';
import { OutfitRenderer } from './OutfitRenderer';
import { RenderCache, buildCacheKey } from './RenderCache';

/** A stable placeholder outfit shown before any recommendation arrives. */
export const EMPTY_OUTFIT: RenderableOutfit = Object.freeze({
  id: 'none',
  label: 'Sin recomendación',
  garments: [],
});

const DEFAULT_BACKGROUND = '#f5f5f4';

export interface SceneManagerDeps {
  readonly avatar?: AvatarManager;
  readonly outfitRenderer?: OutfitRenderer;
  readonly camera?: CameraController;
  readonly lighting?: LightingManager;
  readonly cache?: RenderCache;
  readonly backgroundHex?: string;
}

export class SceneManager {
  private readonly avatar: AvatarManager;
  private readonly outfitRenderer: OutfitRenderer;
  private readonly camera: CameraController;
  private readonly lighting: LightingManager;
  private readonly cache: RenderCache;
  private readonly background: ColorDescriptor;

  private outfit: RenderableOutfit = EMPTY_OUTFIT;
  private view: ViewPreset = 'front';

  public constructor(deps: SceneManagerDeps = {}) {
    this.avatar = deps.avatar ?? new AvatarManager();
    this.outfitRenderer = deps.outfitRenderer ?? new OutfitRenderer();
    this.camera = deps.camera ?? new CameraController({ target: this.avatar.focusPoint() });
    this.lighting = deps.lighting ?? new LightingManager();
    this.cache = deps.cache ?? new RenderCache();
    this.background = colorFromHex(deps.backgroundHex ?? DEFAULT_BACKGROUND);
  }

  /* ----------------------------- recommendation ----------------------------- */

  /**
   * Show a new outfit (e.g. when the AI recommendation changes). Garments are
   * swapped automatically; the same avatar is kept for consistency.
   */
  public setOutfit(outfit: RenderableOutfit): SceneDescription {
    this.outfit = outfit;
    return this.buildScene();
  }

  /** The outfit currently being shown. */
  public get currentOutfit(): RenderableOutfit {
    return this.outfit;
  }

  /* -------------------------------- camera --------------------------------- */

  /** Rotate the view around the avatar (supports a full 360°). */
  public rotate(deltaDeg: number): SceneDescription {
    this.camera.rotateBy(deltaDeg);
    return this.buildScene();
  }

  /** Zoom in (`factor < 1`) or out (`factor > 1`); clamped by the controller. */
  public zoom(factor: number): SceneDescription {
    this.camera.zoomBy(factor);
    return this.buildScene();
  }

  /** Jump to a named angle (front / back / left / right / three-quarter). */
  public applyView(preset: ViewPreset): SceneDescription {
    this.view = preset;
    this.camera.applyPreset(preset);
    return this.buildScene();
  }

  /** Reset the camera to the default front framing. */
  public resetCamera(): SceneDescription {
    this.view = 'front';
    this.camera.reset();
    return this.buildScene();
  }

  /** The current camera state (cheap path for the engine adapter). */
  public cameraState(): CameraState {
    return this.camera.describe();
  }

  public get currentView(): ViewPreset {
    return this.view;
  }

  /* --------------------------- avatar & lighting --------------------------- */

  /** Swap the base avatar model (consistent across the session afterwards). */
  public swapAvatarModel(modelId: AvatarModelId): SceneDescription {
    this.avatar.setBaseModel(modelId);
    return this.buildScene();
  }

  /** Switch the avatar body type. */
  public setBodyType(bodyType: BodyType): SceneDescription {
    this.avatar.setBodyType(bodyType);
    return this.buildScene();
  }

  /** Change the lighting preset. */
  public setLighting(preset: LightingPreset): SceneDescription {
    this.lighting.setPreset(preset);
    return this.buildScene();
  }

  /* --------------------------------- build --------------------------------- */

  /** Compose (or fetch from cache) the current scene description. */
  public buildScene(): SceneDescription {
    const camera = this.camera.describe();
    const key = buildCacheKey({
      avatarSignature: this.avatar.signature(),
      outfit: this.outfit,
      view: this.view,
      lightingPreset: this.lighting.currentPreset,
    });

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      // Re-use the dressed scene; overlay the live camera (cheap to recompute).
      return { ...cached, camera, cacheKey: key };
    }

    const scene: SceneDescription = {
      outfitId: this.outfit.id,
      ...(this.outfit.label !== undefined ? { outfitLabel: this.outfit.label } : {}),
      avatar: this.avatar.describe(),
      layers: this.outfitRenderer.toLayers(this.outfit),
      camera,
      lights: this.lighting.describe(),
      background: this.background,
      cacheKey: key,
    };
    this.cache.set(key, scene);
    return scene;
  }

  /** Expose the cache for diagnostics/invalidation. */
  public get renderCache(): RenderCache {
    return this.cache;
  }
}
