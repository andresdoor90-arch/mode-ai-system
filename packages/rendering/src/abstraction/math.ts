/**
 * Tiny, dependency-free math helpers for the engine-agnostic rendering layer.
 *
 * These types and functions describe *geometry as plain data* — they never
 * touch a graphics API. The Three.js adapter converts these into its own
 * `Vector3`/`Euler` types at the boundary, so nothing here depends on (or
 * leaks) a concrete engine.
 */

/** A point or direction in 3D space. Right-handed, Y-up. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Convenience constructor for a {@link Vec3}. */
export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** The origin `(0, 0, 0)`. */
export const ORIGIN: Vec3 = Object.freeze(vec3(0, 0, 0));

/** Clamp `value` into the inclusive range `[min, max]`. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Wrap an angle in degrees into the half-open range `[0, 360)`. Negative and
 * over-full rotations fold back correctly (e.g. `-90 -> 270`, `450 -> 90`).
 */
export const wrapDegrees = (deg: number): number => {
  const r = deg % 360;
  // `+ 0` normalises a possible `-0` (e.g. from `-360 % 360`) to `0`.
  return (r < 0 ? r + 360 : r) + 0;
};

/** Degrees → radians. */
export const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Radians → degrees. */
export const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

/** Linear interpolation between `a` and `b` by `t` (t is clamped to [0,1]). */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1);

/** Round a number to `decimals` places (default 4) for stable comparisons. */
export const round = (value: number, decimals = 4): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/**
 * Convert spherical orbit coordinates (around `target`) into a cartesian eye
 * position. `azimuthDeg` rotates around the Y axis (0 = +Z, in front of the
 * avatar), `polarDeg` is the vertical angle measured from the equator
 * (0 = level, +up), and `distance` is the radius. This is the maths a camera
 * rig needs and is fully unit-testable without any renderer.
 */
export const orbitToCartesian = (
  target: Vec3,
  azimuthDeg: number,
  polarDeg: number,
  distance: number,
): Vec3 => {
  const az = toRadians(wrapDegrees(azimuthDeg));
  const pol = toRadians(clamp(polarDeg, -89, 89));
  const horizontal = Math.cos(pol) * distance;
  return {
    x: round(target.x + horizontal * Math.sin(az)),
    y: round(target.y + Math.sin(pol) * distance),
    z: round(target.z + horizontal * Math.cos(az)),
  };
};
