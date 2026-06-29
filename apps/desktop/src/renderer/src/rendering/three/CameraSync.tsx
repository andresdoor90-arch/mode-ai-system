/**
 * Three.js / R3F adapter — camera sync.
 *
 * CI/RUNTIME-DEFERRED (imports R3F/three; not installable offline).
 *
 * Drives the live R3F camera from the engine-agnostic {@link CameraState}
 * computed by the pure `CameraController` (rotation/zoom/view presets). The
 * camera math is owned by the abstraction; this component only copies the
 * resulting position/fov onto the actual camera each frame, smoothing for a
 * pleasant transition.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

import { type CameraState } from '@mas/rendering';

export interface CameraSyncProps {
  readonly camera: CameraState;
  /** Smoothing factor 0..1 per frame (1 = snap). */
  readonly smoothing?: number;
}

export function CameraSync({ camera, smoothing = 0.18 }: CameraSyncProps): null {
  const { camera: three } = useThree();
  const targetPos = useRef(new Vector3(camera.position.x, camera.position.y, camera.position.z));
  const lookAt = useRef(new Vector3(camera.target.x, camera.target.y, camera.target.z));

  useEffect(() => {
    targetPos.current.set(camera.position.x, camera.position.y, camera.position.z);
    lookAt.current.set(camera.target.x, camera.target.y, camera.target.z);
    if ('fov' in three) {
      (three as { fov: number }).fov = camera.fovDeg;
      (three as { updateProjectionMatrix: () => void }).updateProjectionMatrix();
    }
  }, [camera, three]);

  useFrame(() => {
    three.position.lerp(targetPos.current, smoothing);
    three.lookAt(lookAt.current);
  });

  return null;
}
