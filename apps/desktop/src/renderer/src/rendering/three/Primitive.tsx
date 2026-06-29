/**
 * Three.js / React-Three-Fiber adapter — primitive mesh.
 *
 * CI/RUNTIME-DEFERRED: this module imports `three` (via R3F intrinsic elements).
 * `three`, `@react-three/fiber` and `@react-three/drei` cannot be installed in
 * the offline (INTEGRATIONS_ONLY) sandbox, so this file is NOT type-checked or
 * executed offline; it is validated in CI and at runtime. The placement maths it
 * relies on lives in the pure, offline-tested `../primitives.ts`.
 *
 * Renders one engine-agnostic {@link PrimitiveDescriptor} as an R3F `<mesh>`
 * with a standard material. Switching the geometry kind here (or swapping these
 * primitives for loaded GLTF meshes) is the only place geometry is created.
 */
import { type PrimitiveDescriptor, type ThreeMaterialProps } from '../primitives';

export interface PrimitiveProps {
  readonly primitive: PrimitiveDescriptor;
  readonly material: ThreeMaterialProps;
  readonly renderOrder?: number;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

function Geometry({ primitive }: { primitive: PrimitiveDescriptor }): JSX.Element {
  const args = primitive.args as number[];
  switch (primitive.kind) {
    case 'box':
      return <boxGeometry args={args as [number, number, number]} />;
    case 'sphere':
      return <sphereGeometry args={args as [number, number, number]} />;
    case 'cylinder':
      return <cylinderGeometry args={args as [number, number, number, number]} />;
    case 'capsule':
      return <capsuleGeometry args={args as [number, number, number, number]} />;
    default:
      return <boxGeometry args={[0.2, 0.2, 0.2]} />;
  }
}

export function Primitive({
  primitive,
  material,
  renderOrder = 0,
  castShadow = true,
  receiveShadow = true,
}: PrimitiveProps): JSX.Element {
  return (
    <mesh
      position={primitive.position as [number, number, number]}
      rotation={(primitive.rotation ?? [0, 0, 0]) as [number, number, number]}
      renderOrder={renderOrder}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <Geometry primitive={primitive} />
      <meshStandardMaterial
        color={material.color}
        roughness={material.roughness}
        metalness={material.metalness}
        transparent={material.transparent}
        opacity={material.opacity}
      />
    </mesh>
  );
}
