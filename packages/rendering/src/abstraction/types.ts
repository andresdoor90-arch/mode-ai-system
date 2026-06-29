/**
 * The engine-agnostic data contract of the M-A-S virtual try-on system.
 *
 * Everything here is plain, serialisable data — no class instances, no Three.js
 * types, no DOM. A {@link SceneDescription} is a complete, declarative snapshot
 * of "what to draw"; a graphics engine adapter ({@link IRenderEngine}) turns it
 * into pixels. Because this is the only thing the engine sees, the engine is
 * fully replaceable without touching the domain, the managers or the UI.
 */
import { type ColorDescriptor } from './color';
import { type Vec3 } from './math';
import { type BodyRegion, type GarmentLayerSlot } from './slots';

/* ------------------------------- inputs ---------------------------------- */

/**
 * The minimal, plain shape the renderer consumes for one garment. It is
 * structurally a subset of the app's `GarmentDTO`, so the desktop layer maps a
 * DTO to this without the rendering package ever importing Electron or the
 * domain. NOTE: contains only descriptive attributes, never AI/score data.
 */
export interface RenderableGarment {
  readonly id: string;
  readonly name: string;
  /** Domain `GarmentCategory` value, e.g. `'tops'`, `'shoes'`. */
  readonly category: string;
  /** Domain subcategory value, e.g. `'jeans'`, `'sneakers'`. */
  readonly subcategory: string;
  /** Garment colour as a hex string (from the domain `Color`). */
  readonly colorHex: string;
  readonly colorName?: string;
  readonly isNeutral?: boolean;
  readonly tags?: readonly string[];
}

/**
 * A complete outfit to visualise. `id` identifies the outfit for caching and
 * "consistent representation across recommendations"; for an AI recommendation
 * this is typically `principal` / `mas-elegante` / `mas-comoda`.
 */
export interface RenderableOutfit {
  readonly id: string;
  readonly label?: string;
  readonly garments: readonly RenderableGarment[];
}

/* ------------------------------ materials -------------------------------- */

/** Surface finishes derived from a garment's subcategory/tags. */
export type SurfaceFinish =
  | 'matte'
  | 'satin'
  | 'glossy'
  | 'metallic'
  | 'leather'
  | 'denim'
  | 'knit';

/** A physically-based-ish material description (engine-agnostic). */
export interface MaterialDescriptor {
  readonly color: ColorDescriptor;
  /** Micro-surface roughness `0..1` (0 = mirror, 1 = fully diffuse). */
  readonly roughness: number;
  /** Metalness `0..1`. */
  readonly metalness: number;
  /** Opacity `0..1` (sheer fabrics < 1). */
  readonly opacity: number;
  readonly finish: SurfaceFinish;
  /** Optional texture asset key resolved by the Texture/Asset managers. */
  readonly textureKey?: string;
}

/* ------------------------------- avatar ---------------------------------- */

/** Identifier of a swappable base avatar mesh. Extension point. */
export type AvatarModelId = string;

/** Supported body types. New values can be added without code changes elsewhere. */
export type BodyType = 'neutral' | 'feminine' | 'masculine' | 'athletic' | 'plus';

/** Avatar poses. Extension point for future animation work. */
export type AvatarPose = 'standing' | 'relaxed' | 'walking' | 't-pose';

/** A complete, plain description of the fictional character to draw. */
export interface AvatarDescriptor {
  readonly modelId: AvatarModelId;
  readonly bodyType: BodyType;
  readonly pose: AvatarPose;
  readonly skinTone: ColorDescriptor;
  /** Uniform scale applied to the base mesh. */
  readonly scale: number;
  /** Asset key for the base mesh, resolved by the Asset Manager. */
  readonly meshKey: string;
  /** Future-proofing: accessory attachment points the engine may populate. */
  readonly attachmentPoints: readonly AttachmentPoint[];
}

/** A named point on the avatar where an accessory can be attached (future). */
export interface AttachmentPoint {
  readonly id: string;
  readonly region: BodyRegion;
  readonly offset: Vec3;
}

/* ------------------------------ clothing --------------------------------- */

/** One resolved, drawable clothing layer on the avatar. */
export interface ClothingLayer {
  readonly garmentId: string;
  readonly name: string;
  readonly slot: GarmentLayerSlot;
  readonly region: BodyRegion;
  /** Draw order — lower first; guarantees correct stacking. */
  readonly renderOrder: number;
  readonly material: MaterialDescriptor;
  /** Asset key for this garment's mesh, resolved by the Asset Manager. */
  readonly meshKey: string;
  /** Whether the layer is currently visible (e.g. hidden by a dress). */
  readonly visible: boolean;
}

/* ------------------------------- camera ---------------------------------- */

/** Named camera angles the user can jump to. */
export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'three-quarter';

/** A complete, plain camera state (spherical orbit around `target`). */
export interface CameraState {
  /** Orbit angle around the vertical axis, `[0, 360)`. 0 = front. */
  readonly azimuthDeg: number;
  /** Vertical angle from the equator, clamped `[-89, 89]`. */
  readonly polarDeg: number;
  /** Orbit radius (zoom). */
  readonly distance: number;
  /** Point the camera looks at. */
  readonly target: Vec3;
  /** Field of view in degrees. */
  readonly fovDeg: number;
  /** Computed eye position (kept in sync with the orbit params). */
  readonly position: Vec3;
}

/* ------------------------------- lighting -------------------------------- */

export type LightType = 'ambient' | 'hemisphere' | 'directional' | 'point';

/** A single light, described as plain data. */
export interface LightDescriptor {
  readonly id: string;
  readonly type: LightType;
  readonly intensity: number;
  readonly color: ColorDescriptor;
  readonly position?: Vec3;
  /** Whether this light casts shadows (engine may honour it). */
  readonly castShadow?: boolean;
}

/** Named lighting setups. */
export type LightingPreset = 'studio' | 'soft' | 'dramatic';

/* -------------------------------- scene ---------------------------------- */

/**
 * A complete declarative snapshot of the try-on scene. This is the single
 * payload an {@link IRenderEngine} consumes — the seam that makes the graphics
 * engine replaceable.
 */
export interface SceneDescription {
  /** The outfit being shown (id used for caching/consistency). */
  readonly outfitId: string;
  readonly outfitLabel?: string;
  readonly avatar: AvatarDescriptor;
  readonly layers: readonly ClothingLayer[];
  readonly camera: CameraState;
  readonly lights: readonly LightDescriptor[];
  readonly background: ColorDescriptor;
  /** Deterministic key identifying this scene for caching/diffing. */
  readonly cacheKey: string;
}

/* ----------------------------- screenshots ------------------------------- */

export type ImageFormat = 'image/png' | 'image/jpeg';

/** A request to capture the current view. */
export interface ScreenshotRequest {
  readonly width: number;
  readonly height: number;
  readonly format: ImageFormat;
  readonly fileName: string;
  /** Which angle was active when the shot was requested (for the filename). */
  readonly view: ViewPreset;
  /** JPEG quality `0..1` (ignored for PNG). */
  readonly quality?: number;
}

/** The result of a capture. */
export interface ScreenshotResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly format: ImageFormat;
  readonly fileName: string;
  /** ISO timestamp of capture. */
  readonly capturedAt: string;
}
