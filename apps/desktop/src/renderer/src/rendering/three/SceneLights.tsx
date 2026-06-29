/**
 * Three.js / R3F adapter — lights.
 *
 * CI/RUNTIME-DEFERRED (imports R3F/three intrinsics; not installable offline).
 *
 * Instantiates R3F light elements from the engine-agnostic
 * {@link LightDescriptor}s produced by the pure `LightingManager`.
 */
import { type LightDescriptor } from '@mas/rendering';

export interface SceneLightsProps {
  readonly lights: readonly LightDescriptor[];
}

export function SceneLights({ lights }: SceneLightsProps): JSX.Element {
  return (
    <>
      {lights.map((light) => {
        const color = light.color.hex;
        const position = (light.position ?? { x: 0, y: 0, z: 0 }) as {
          x: number;
          y: number;
          z: number;
        };
        const pos: [number, number, number] = [position.x, position.y, position.z];
        switch (light.type) {
          case 'ambient':
            return <ambientLight key={light.id} intensity={light.intensity} color={color} />;
          case 'hemisphere':
            return (
              <hemisphereLight
                key={light.id}
                intensity={light.intensity}
                color={color}
                position={pos}
              />
            );
          case 'point':
            return (
              <pointLight
                key={light.id}
                intensity={light.intensity}
                color={color}
                position={pos}
                castShadow={light.castShadow ?? false}
              />
            );
          case 'directional':
          default:
            return (
              <directionalLight
                key={light.id}
                intensity={light.intensity}
                color={color}
                position={pos}
                castShadow={light.castShadow ?? false}
              />
            );
        }
      })}
    </>
  );
}
