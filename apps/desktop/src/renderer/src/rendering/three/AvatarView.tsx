/**
 * Three.js / R3F adapter — fictional avatar.
 *
 * CI/RUNTIME-DEFERRED (imports R3F/three intrinsics; not installable offline).
 *
 * Renders the parametric mannequin from the pure {@link avatarParts} geometry
 * (offline-tested). Swapping this for a loaded GLTF base model — or different
 * body types — is isolated to this component; the rest of the app only sees an
 * {@link AvatarDescriptor}.
 */
import { type AvatarDescriptor } from '@mas/rendering';

import { avatarParts } from '../primitives';
import { Primitive } from './Primitive';

export interface AvatarViewProps {
  readonly avatar: AvatarDescriptor;
}

export function AvatarView({ avatar }: AvatarViewProps): JSX.Element {
  const parts = avatarParts(avatar);
  return (
    <group name="avatar">
      {parts.map((part) => (
        <Primitive
          key={part.id}
          primitive={part.primitive}
          material={{
            color: part.colorHex,
            roughness: 0.85,
            metalness: 0,
            transparent: false,
            opacity: 1,
          }}
        />
      ))}
    </group>
  );
}
