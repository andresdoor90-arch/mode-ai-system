/**
 * useVirtualTryOn — binds the pure rendering layer to React state.
 *
 * Owns a single {@link SceneManager} (the pure, engine-agnostic composer) and a
 * {@link ScreenshotManager}, and exposes the current {@link SceneDescription}
 * plus camera/view/avatar/lighting/screenshot controls to a component. All the
 * actual logic lives in `@mas/rendering` (offline-tested); this hook is a thin
 * React binding that re-renders when the scene changes.
 *
 * It consumes ONLY structured outfit data (a {@link RenderableOutfit}); it never
 * touches the AI engine, providers or domain classes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type BodyType,
  type LightingPreset,
  type RenderableOutfit,
  type SceneDescription,
  type ScreenshotResult,
  type ViewPreset,
  SceneManager,
  ScreenshotManager,
} from '@mas/rendering';

import { type CanvasHandles, createCanvasScreenshotSink, downloadScreenshot } from './three/screenshotSink';

export interface VirtualTryOnControls {
  rotate: (deltaDeg: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  applyView: (preset: ViewPreset) => void;
  reset: () => void;
  setBodyType: (bodyType: BodyType) => void;
  setLighting: (preset: LightingPreset) => void;
}

export interface UseVirtualTryOn {
  scene: SceneDescription;
  controls: VirtualTryOnControls;
  /** Register the live engine handles (called from the canvas onReady). */
  registerCanvas: (handles: CanvasHandles) => void;
  /** Capture the current view and trigger a download. */
  capture: () => Promise<ScreenshotResult | null>;
  currentView: ViewPreset;
}

const ROTATE_STEP = 30;
const ZOOM_IN_FACTOR = 0.85;
const ZOOM_OUT_FACTOR = 1.18;

export function useVirtualTryOn(outfit: RenderableOutfit | null): UseVirtualTryOn {
  const manager = useMemo(() => new SceneManager(), []);
  const handlesRef = useRef<CanvasHandles | null>(null);
  const screenshots = useMemo(
    () => new ScreenshotManager(createCanvasScreenshotSink(() => handlesRef.current)),
    [],
  );

  const [scene, setScene] = useState<SceneDescription>(() => manager.buildScene());

  // Swap garments automatically whenever the selected recommendation changes.
  useEffect(() => {
    if (outfit !== null) {
      setScene(manager.setOutfit(outfit));
    }
  }, [outfit, manager]);

  const registerCanvas = useCallback((handles: CanvasHandles) => {
    handlesRef.current = handles;
  }, []);

  const controls = useMemo<VirtualTryOnControls>(
    () => ({
      rotate: (deltaDeg: number) => setScene(manager.rotate(deltaDeg)),
      zoomIn: () => setScene(manager.zoom(ZOOM_IN_FACTOR)),
      zoomOut: () => setScene(manager.zoom(ZOOM_OUT_FACTOR)),
      applyView: (preset: ViewPreset) => setScene(manager.applyView(preset)),
      reset: () => setScene(manager.resetCamera()),
      setBodyType: (bodyType: BodyType) => setScene(manager.setBodyType(bodyType)),
      setLighting: (preset: LightingPreset) => setScene(manager.setLighting(preset)),
    }),
    [manager],
  );

  const capture = useCallback(async (): Promise<ScreenshotResult | null> => {
    if (handlesRef.current === null) {
      return null;
    }
    const label = manager.currentOutfit.label ?? manager.currentOutfit.id;
    const result = await screenshots.capture(label, { view: manager.currentView });
    downloadScreenshot(result);
    return result;
  }, [manager, screenshots]);

  return {
    scene,
    controls,
    registerCanvas,
    capture,
    currentView: manager.currentView,
  };
}

export { ROTATE_STEP };
