/**
 * The replaceable-graphics-engine seam.
 *
 * `IRenderEngine` is the ONLY surface a concrete graphics engine implements.
 * The Three.js / React-Three-Fiber adapter (in `apps/desktop`) implements this
 * interface; the rest of M-A-S depends only on the interface, so swapping the
 * engine (Babylon, raw WebGPU, a 2D canvas fallback, …) never touches the
 * domain, the managers or the UI logic. Nothing here imports a renderer.
 */
import { type CameraState, type SceneDescription, type ScreenshotRequest, type ScreenshotResult } from './types';

/**
 * An opaque handle to wherever the engine should draw (e.g. an HTMLCanvasElement
 * in the Three.js adapter). Kept as `unknown` so this layer never references the
 * DOM; the adapter narrows it.
 */
export type RenderTarget = unknown;

/** A pluggable graphics engine. Implementations live OUTSIDE this package. */
export interface IRenderEngine {
  /** Stable id of the engine implementation (diagnostics/telemetry). */
  readonly id: string;

  /** Attach the engine to a draw target and start its loop. */
  mount(target: RenderTarget): void;

  /** Render (or diff to) a complete scene description. Idempotent per frame. */
  render(scene: SceneDescription): void;

  /** Update only the camera without rebuilding the scene (cheap path). */
  updateCamera(camera: CameraState): void;

  /** Capture the current frame as an image. */
  captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult>;

  /** Release all GPU/engine resources. */
  dispose(): void;
}

/**
 * The capability the Screenshot Manager needs. An {@link IRenderEngine}
 * satisfies it, but tests (and a future server-side capture path) can supply a
 * lightweight fake — keeping screenshot plumbing fully unit-testable offline.
 */
export interface IScreenshotSink {
  captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult>;
}

/**
 * A no-op engine. Useful as a safe default before a real engine mounts and as a
 * baseline in tests. It records the last scene/camera it was given.
 */
export class NullRenderEngine implements IRenderEngine {
  public readonly id = 'null-engine';
  public lastScene: SceneDescription | null = null;
  public lastCamera: CameraState | null = null;
  public mounted = false;
  public disposed = false;

  public mount(): void {
    this.mounted = true;
  }

  public render(scene: SceneDescription): void {
    this.lastScene = scene;
  }

  public updateCamera(camera: CameraState): void {
    this.lastCamera = camera;
  }

  public captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult> {
    return Promise.resolve({
      dataUrl: 'data:,',
      width: request.width,
      height: request.height,
      format: request.format,
      fileName: request.fileName,
      capturedAt: new Date(0).toISOString(),
    });
  }

  public dispose(): void {
    this.disposed = true;
  }
}
