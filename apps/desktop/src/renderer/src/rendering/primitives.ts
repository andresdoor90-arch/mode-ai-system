/**
 * Pure primitive-geometry derivation for the Three.js adapter.
 *
 * This is the part of the Three.js/R3F adapter that needs NO Three.js: it turns
 * an engine-agnostic {@link SceneDescription} (avatar + clothing layers) into
 * plain primitive descriptors (kind + args + transform) and material props. The
 * R3F components then instantiate `<mesh>`/`<meshStandardMaterial>` from these
 * descriptors. Keeping it pure means the avatar/garment placement maths is
 * unit-testable OFFLINE; only the actual `<Canvas>`/WebGL render is deferred.
 *
 * The fictional avatar is built from parametric primitives (no external model
 * file), so it renders anywhere and is trivially swappable later for a real
 * GLTF model behind the same descriptors.
 */
import {
  type AvatarDescriptor,
  type ClothingLayer,
  type MaterialDescriptor,
  BodyRegion,
} from '@mas/rendering';

export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'capsule';

/** A plain, engine-agnostic geometry instance. */
export interface PrimitiveDescriptor {
  readonly kind: PrimitiveKind;
  /** Geometry constructor args (e.g. box: [w,h,d]; cylinder: [rt,rb,h,seg]). */
  readonly args: readonly number[];
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
}

/** A named body part of the parametric mannequin. */
export interface AvatarPart {
  readonly id: string;
  readonly primitive: PrimitiveDescriptor;
  /** Skin/material colour as a hex string. */
  readonly colorHex: string;
}

/** Material props consumed by `<meshStandardMaterial {...} />`. */
export interface ThreeMaterialProps {
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly transparent: boolean;
  readonly opacity: number;
}

/** Convert an engine-agnostic material to Three standard-material props. */
export function materialProps(material: MaterialDescriptor): ThreeMaterialProps {
  return {
    color: material.color.hex,
    roughness: material.roughness,
    metalness: material.metalness,
    transparent: material.opacity < 1,
    opacity: material.opacity,
  };
}

/**
 * Build the parametric mannequin body parts, scaled by the avatar descriptor.
 * Positions are in metres, Y-up, feet near y=0.
 */
export function avatarParts(avatar: AvatarDescriptor): readonly AvatarPart[] {
  const s = avatar.scale;
  const skin = avatar.skinTone.hex;
  // Body-type width factor (subtle) — different body types support.
  const widthFactor =
    avatar.bodyType === 'plus'
      ? 1.18
      : avatar.bodyType === 'athletic'
        ? 1.06
        : avatar.bodyType === 'feminine'
          ? 0.94
          : 1;
  const w = widthFactor;

  return [
    {
      id: 'head',
      colorHex: skin,
      primitive: { kind: 'sphere', args: [0.14 * s, 24, 24], position: [0, 1.62 * s, 0] },
    },
    {
      id: 'neck',
      colorHex: skin,
      primitive: { kind: 'cylinder', args: [0.05 * s, 0.05 * s, 0.1 * s, 16], position: [0, 1.5 * s, 0] },
    },
    {
      id: 'torso',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.18 * s * w, 0.5 * s, 8, 16],
        position: [0, 1.16 * s, 0],
      },
    },
    {
      id: 'hips',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.17 * s * w, 0.16 * s, 8, 16],
        position: [0, 0.86 * s, 0],
      },
    },
    {
      id: 'leg-left',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.08 * s, 0.72 * s, 8, 16],
        position: [-0.1 * s, 0.42 * s, 0],
      },
    },
    {
      id: 'leg-right',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.08 * s, 0.72 * s, 8, 16],
        position: [0.1 * s, 0.42 * s, 0],
      },
    },
    {
      id: 'arm-left',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.06 * s, 0.6 * s, 8, 16],
        position: [-0.32 * s * w, 1.16 * s, 0],
        rotation: [0, 0, 0.08],
      },
    },
    {
      id: 'arm-right',
      colorHex: skin,
      primitive: {
        kind: 'capsule',
        args: [0.06 * s, 0.6 * s, 8, 16],
        position: [0.32 * s * w, 1.16 * s, 0],
        rotation: [0, 0, -0.08],
      },
    },
  ];
}

/**
 * Geometry for a single clothing layer, chosen from its body region. A slightly
 * larger primitive than the underlying body part so the garment "sits over" it;
 * outer layers get a touch more inflation so they stack above inner layers.
 */
export function layerPrimitive(layer: ClothingLayer, avatarScale = 1): PrimitiveDescriptor {
  const s = avatarScale;
  const inflate = layer.slot === 'outer' ? 0.04 : 0.02;

  switch (layer.region) {
    case BodyRegion.Torso:
      return {
        kind: 'capsule',
        args: [(0.19 + inflate) * s, 0.52 * s, 8, 16],
        position: [0, 1.16 * s, 0],
      };
    case BodyRegion.Legs:
      return {
        kind: 'capsule',
        args: [(0.16 + inflate) * s, 0.7 * s, 8, 16],
        position: [0, 0.62 * s, 0],
      };
    case BodyRegion.Feet:
      return {
        kind: 'box',
        args: [0.26 * s, 0.1 * s, 0.34 * s],
        position: [0, 0.05 * s, 0.04 * s],
      };
    case BodyRegion.FullBody:
      return {
        kind: 'cylinder',
        args: [0.16 * s, 0.32 * s, 1.05 * s, 20],
        position: [0, 0.86 * s, 0],
      };
    case BodyRegion.Head:
      return { kind: 'sphere', args: [0.16 * s, 16, 16], position: [0, 1.66 * s, 0] };
    case BodyRegion.Neck:
      return {
        kind: 'cylinder',
        args: [0.07 * s, 0.07 * s, 0.12 * s, 16],
        position: [0, 1.48 * s, 0.02 * s],
      };
    case BodyRegion.Waist:
      return {
        kind: 'cylinder',
        args: [0.19 * s, 0.19 * s, 0.08 * s, 20],
        position: [0, 0.96 * s, 0],
      };
    case BodyRegion.Hands:
      return { kind: 'sphere', args: [0.05 * s, 12, 12], position: [0.3 * s, 0.9 * s, 0] };
    case BodyRegion.Arms:
      return {
        kind: 'capsule',
        args: [0.07 * s, 0.58 * s, 8, 16],
        position: [0.32 * s, 1.16 * s, 0],
      };
    default:
      return {
        kind: 'capsule',
        args: [0.2 * s, 0.5 * s, 8, 16],
        position: [0, 1.16 * s, 0],
      };
  }
}
