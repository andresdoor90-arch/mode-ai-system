/**
 * Avatar Manager.
 *
 * Owns the fictional character's appearance descriptor: which base model, body
 * type, pose, skin tone and scale. It contains NO business rules — it never
 * decides what to wear or whether an outfit is valid; it only describes the
 * mannequin to draw. Garment placement is the Clothing/Outfit renderers' job.
 *
 * Future-proofing lives here as explicit, data-only extension points: swapping
 * the base model, switching body type, posing and (later) accessory attachment
 * points are all simple state changes that produce a new {@link AvatarDescriptor}.
 */
import { colorFromHex, type ColorDescriptor } from '../abstraction/color';
import { vec3, type ORIGIN } from '../abstraction/math';
import { BodyRegion } from '../abstraction/slots';
import {
  type AttachmentPoint,
  type AvatarDescriptor,
  type AvatarModelId,
  type AvatarPose,
  type BodyType,
} from '../abstraction/types';
import { AssetManager } from './AssetManager';

export interface AvatarManagerOptions {
  readonly modelId?: AvatarModelId;
  readonly bodyType?: BodyType;
  readonly pose?: AvatarPose;
  readonly skinToneHex?: string;
  readonly scale?: number;
}

/** Default neutral skin tone for the fictional character. */
export const DEFAULT_SKIN_TONE = '#c79a78';

/** Standard accessory attachment points, available for future accessories. */
const DEFAULT_ATTACHMENT_POINTS: readonly AttachmentPoint[] = Object.freeze([
  { id: 'head', region: BodyRegion.Head, offset: vec3(0, 1.75, 0) },
  { id: 'neck', region: BodyRegion.Neck, offset: vec3(0, 1.5, 0.05) },
  { id: 'waist', region: BodyRegion.Waist, offset: vec3(0, 1.0, 0.08) },
  { id: 'left-wrist', region: BodyRegion.Hands, offset: vec3(-0.25, 1.0, 0) },
  { id: 'right-wrist', region: BodyRegion.Hands, offset: vec3(0.25, 1.0, 0) },
]);

export class AvatarManager {
  private readonly assets: AssetManager;
  private modelId: AvatarModelId;
  private bodyType: BodyType;
  private pose: AvatarPose;
  private skinTone: ColorDescriptor;
  private scale: number;

  public constructor(
    assets: AssetManager = new AssetManager(),
    options: AvatarManagerOptions = {},
  ) {
    this.assets = assets;
    this.modelId = options.modelId ?? 'mannequin-v1';
    this.bodyType = options.bodyType ?? 'neutral';
    this.pose = options.pose ?? 'standing';
    this.skinTone = colorFromHex(options.skinToneHex ?? DEFAULT_SKIN_TONE);
    this.scale = options.scale ?? 1;
  }

  /** Swap the base avatar model (future model picker). Falls back if unknown. */
  public setBaseModel(modelId: AvatarModelId): this {
    this.modelId = this.assets.hasAvatarModel(modelId) ? modelId : this.modelId;
    return this;
  }

  /** Switch body type (different body types support). */
  public setBodyType(bodyType: BodyType): this {
    this.bodyType = bodyType;
    return this;
  }

  /** Change the pose (future animation/pose presets). */
  public setPose(pose: AvatarPose): this {
    this.pose = pose;
    return this;
  }

  public setSkinTone(hex: string): this {
    this.skinTone = colorFromHex(hex);
    return this;
  }

  public setScale(scale: number): this {
    this.scale = scale > 0 ? scale : this.scale;
    return this;
  }

  public get currentModelId(): AvatarModelId {
    return this.modelId;
  }

  public get currentBodyType(): BodyType {
    return this.bodyType;
  }

  /** Produce the current immutable avatar descriptor. */
  public describe(): AvatarDescriptor {
    return {
      modelId: this.modelId,
      bodyType: this.bodyType,
      pose: this.pose,
      skinTone: this.skinTone,
      scale: this.scale,
      meshKey: this.assets.resolveAvatarMesh(this.modelId, this.bodyType),
      attachmentPoints: DEFAULT_ATTACHMENT_POINTS,
    };
  }

  /** The avatar's look-at focus point (chest height), for the camera target. */
  public focusPoint(): typeof ORIGIN {
    return vec3(0, 1.1 * this.scale, 0);
  }

  /**
   * A short signature of the avatar's identity, used in cache keys so the same
   * avatar yields a consistent representation across recommendations.
   */
  public signature(): string {
    return `${this.modelId}:${this.bodyType}:${this.pose}:${this.skinTone.hex}:${this.scale}`;
  }
}
