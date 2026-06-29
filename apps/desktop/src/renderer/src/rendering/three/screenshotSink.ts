/**
 * Three.js / R3F adapter — screenshot sink.
 *
 * CI/RUNTIME-DEFERRED (uses the live WebGL renderer; not exercisable offline).
 *
 * Bridges the engine-agnostic {@link IScreenshotSink} (which the pure
 * `ScreenshotManager` calls) to a real Three.js `WebGLRenderer`: it renders the
 * scene at the requested resolution, reads the canvas back as a data URL, then
 * restores the previous size. The pure request/filename/format plumbing is
 * tested offline; only this WebGL read-back is deferred.
 */
import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';

import {
  type IScreenshotSink,
  type ScreenshotRequest,
  type ScreenshotResult,
} from '@mas/rendering';

export interface CanvasHandles {
  readonly gl: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: Camera;
}

/** Create an {@link IScreenshotSink} backed by a live R3F renderer. */
export function createCanvasScreenshotSink(
  getHandles: () => CanvasHandles | null,
): IScreenshotSink {
  return {
    captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult> {
      const handles = getHandles();
      if (handles === null) {
        return Promise.reject(new Error('Render surface is not ready for capture.'));
      }
      const { gl, scene, camera } = handles;
      const previous = gl.getSize(new Vector2());

      gl.setSize(request.width, request.height, false);
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL(request.format, request.quality);

      // Restore the on-screen size.
      gl.setSize(previous.x, previous.y, false);
      gl.render(scene, camera);

      return Promise.resolve({
        dataUrl,
        width: request.width,
        height: request.height,
        format: request.format,
        fileName: request.fileName,
        capturedAt: new Date().toISOString(),
      });
    },
  };
}

/** Trigger a browser download for a captured screenshot. */
export function downloadScreenshot(result: ScreenshotResult): void {
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
