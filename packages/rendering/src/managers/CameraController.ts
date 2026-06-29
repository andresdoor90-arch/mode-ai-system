/**
 * Camera Controller.
 *
 * Pure orbit-camera maths: 360° rotation, clamped zoom and named view presets
 * (front / back / left / right / three-quarter). It holds a {@link CameraState}
 * and every mutation returns a fresh, fully-derived state (including the
 * cartesian eye position) — no engine, no DOM, fully unit-testable. The engine
 * adapter just copies the resulting state onto its camera each frame.
 */
import { clamp, orbitToCartesian, vec3, wrapDegrees, type Vec3 } from '../abstraction/math';
import { type CameraState, type ViewPreset } from '../abstraction/types';

export interface CameraControllerOptions {
  readonly target?: Vec3;
  readonly distance?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly fovDeg?: number;
  readonly polarDeg?: number;
}

/** Azimuth (degrees) for each named preset. 0 = facing the camera (front). */
export const PRESET_AZIMUTH: Readonly<Record<ViewPreset, number>> = Object.freeze({
  front: 0,
  back: 180,
  left: 90,
  right: 270,
  'three-quarter': 45,
});

const DEFAULT_DISTANCE = 4;
const DEFAULT_MIN = 1.5;
const DEFAULT_MAX = 9;
const DEFAULT_FOV = 45;

export class CameraController {
  private readonly target: Vec3;
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly fovDeg: number;
  private azimuthDeg: number;
  private polarDeg: number;
  private distance: number;

  public constructor(options: CameraControllerOptions = {}) {
    this.target = options.target ?? vec3(0, 1.1, 0);
    this.minDistance = options.minDistance ?? DEFAULT_MIN;
    this.maxDistance = options.maxDistance ?? DEFAULT_MAX;
    this.fovDeg = options.fovDeg ?? DEFAULT_FOV;
    this.distance = clamp(options.distance ?? DEFAULT_DISTANCE, this.minDistance, this.maxDistance);
    this.azimuthDeg = 0;
    this.polarDeg = options.polarDeg ?? 0;
  }

  /** Rotate the avatar/camera by `deltaDeg` around the vertical axis (360°). */
  public rotateBy(deltaDeg: number): this {
    this.azimuthDeg = wrapDegrees(this.azimuthDeg + deltaDeg);
    return this;
  }

  /** Set an absolute azimuth, normalised to `[0, 360)`. */
  public setAzimuth(deg: number): this {
    this.azimuthDeg = wrapDegrees(deg);
    return this;
  }

  /** Tilt vertically, clamped to a safe range to avoid gimbal flip. */
  public tiltBy(deltaDeg: number): this {
    this.polarDeg = clamp(this.polarDeg + deltaDeg, -80, 80);
    return this;
  }

  /**
   * Multiplicative zoom. `factor < 1` zooms in (smaller radius), `> 1` zooms
   * out. The distance is clamped to the configured range.
   */
  public zoomBy(factor: number): this {
    const safe = factor > 0 ? factor : 1;
    this.distance = clamp(this.distance * safe, this.minDistance, this.maxDistance);
    return this;
  }

  /** Set an absolute zoom distance (clamped). */
  public setDistance(distance: number): this {
    this.distance = clamp(distance, this.minDistance, this.maxDistance);
    return this;
  }

  /** Jump to a named angle. Distance/tilt are kept (only azimuth changes). */
  public applyPreset(preset: ViewPreset): this {
    this.azimuthDeg = PRESET_AZIMUTH[preset];
    if (preset === 'three-quarter') {
      this.polarDeg = clamp(this.polarDeg === 0 ? 8 : this.polarDeg, -80, 80);
    }
    return this;
  }

  /** Reset to the default front view at the default distance. */
  public reset(): this {
    this.azimuthDeg = 0;
    this.polarDeg = 0;
    this.distance = clamp(DEFAULT_DISTANCE, this.minDistance, this.maxDistance);
    return this;
  }

  public get currentDistance(): number {
    return this.distance;
  }

  public get currentAzimuth(): number {
    return this.azimuthDeg;
  }

  /** Produce the current immutable, fully-derived camera state. */
  public describe(): CameraState {
    return {
      azimuthDeg: this.azimuthDeg,
      polarDeg: this.polarDeg,
      distance: this.distance,
      target: this.target,
      fovDeg: this.fovDeg,
      position: orbitToCartesian(this.target, this.azimuthDeg, this.polarDeg, this.distance),
    };
  }
}
