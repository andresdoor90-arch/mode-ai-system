/**
 * Three.js / R3F adapter — clothing layers.
 *
 * CI/RUNTIME-DEFERRED (imports R3F/three intrinsics; not installable offline).
 *
 * Renders each VISIBLE {@link ClothingLayer} over the avatar using the pure
 * {@link layerPrimitive} geometry and {@link materialProps} mapping (both
 * offline-tested). Draw order comes straight from the layer so a coat always
 * stacks above a shirt. When the recommendation changes, the layer list changes
 * and React reconciles the meshes — the automatic garment swap.
 */
import { type ClothingLayer } from '@mas/rendering';

import { layerPrimitive, materialProps } from '../primitives';
import { Primitive } from './Primitive';

export interface ClothingLayersProps {
  readonly layers: readonly ClothingLayer[];
  readonly avatarScale?: number;
}

export function ClothingLayers({ layers, avatarScale = 1 }: ClothingLayersProps): JSX.Element {
  return (
    <group name="clothing">
      {layers
        .filter((layer) => layer.visible)
        .map((layer) => (
          <Primitive
            key={layer.garmentId}
            primitive={layerPrimitive(layer, avatarScale)}
            material={materialProps(layer.material)}
            renderOrder={layer.renderOrder}
          />
        ))}
    </group>
  );
}
