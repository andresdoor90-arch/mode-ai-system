/**
 * Three.js / R3F adapter — the try-on canvas.
 *
 * CI/RUNTIME-DEFERRED (imports `@react-three/fiber`/`drei`/`three`; not
 * installable offline). This is the concrete graphics-engine adapter: it takes
 * a fully-formed, engine-agnostic {@link SceneDescription} and draws it with
 * React-Three-Fiber. Replacing R3F with another engine means rewriting ONLY
 * this folder — nothing else in the app changes.
 */
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';

import { type SceneDescription } from '@mas/rendering';

import { AvatarView } from './AvatarView';
import { CameraSync } from './CameraSync';
import { ClothingLayers } from './ClothingLayers';
import { SceneLights } from './SceneLights';
import { type CanvasHandles } from './screenshotSink';

export interface TryOnCanvasProps {
  readonly scene: SceneDescription;
  /** Called once the WebGL context is ready, exposing handles for capture. */
  readonly onReady?: (handles: CanvasHandles) => void;
}

export function TryOnCanvas({ scene, onReady }: TryOnCanvasProps): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{
        position: [scene.camera.position.x, scene.camera.position.y, scene.camera.position.z],
        fov: scene.camera.fovDeg,
      }}
      style={{ background: scene.background.hex }}
      onCreated={(state) => {
        onReady?.({ gl: state.gl, scene: state.scene, camera: state.camera });
      }}
    >
      <CameraSync camera={scene.camera} />
      <SceneLights lights={scene.lights} />

      <AvatarView avatar={scene.avatar} />
      <ClothingLayers layers={scene.layers} avatarScale={scene.avatar.scale} />

      {/* Soft contact shadow grounds the avatar; an environment adds subtle IBL. */}
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={4} blur={2.4} far={3} />
      <Environment preset="studio" />
    </Canvas>
  );
}
