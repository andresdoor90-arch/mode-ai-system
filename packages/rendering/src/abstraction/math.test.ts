import { describe, it, expect } from 'vitest';

import { clamp, lerp, orbitToCartesian, round, toRadians, vec3, wrapDegrees } from './math';

describe('clamp', () => {
  it('bounds a value into the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('wrapDegrees', () => {
  it('wraps into [0, 360)', () => {
    expect(wrapDegrees(0)).toBe(0);
    expect(wrapDegrees(360)).toBe(0);
    expect(wrapDegrees(-90)).toBe(270);
    expect(wrapDegrees(450)).toBe(90);
    expect(wrapDegrees(-360)).toBe(0);
  });

  it('supports a full 360 sweep returning to origin', () => {
    let a = 0;
    for (let i = 0; i < 36; i += 1) {
      a = wrapDegrees(a + 10);
    }
    expect(a).toBe(0);
  });
});

describe('lerp', () => {
  it('interpolates and clamps t', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
  });
});

describe('round', () => {
  it('rounds to 4 decimals by default', () => {
    expect(round(1.23456789)).toBe(1.2346);
  });
});

describe('orbitToCartesian', () => {
  const target = vec3(0, 1, 0);

  it('places the eye in front (+Z) at azimuth 0', () => {
    const eye = orbitToCartesian(target, 0, 0, 4);
    expect(eye.z).toBeCloseTo(4, 3);
    expect(eye.x).toBeCloseTo(0, 3);
    expect(eye.y).toBeCloseTo(1, 3);
  });

  it('places the eye behind (-Z) at azimuth 180', () => {
    const eye = orbitToCartesian(target, 180, 0, 4);
    expect(eye.z).toBeCloseTo(-4, 3);
  });

  it('places the eye to the side at azimuth 90', () => {
    const eye = orbitToCartesian(target, 90, 0, 4);
    expect(eye.x).toBeCloseTo(4, 3);
    expect(Math.abs(eye.z)).toBeLessThan(0.001);
  });

  it('clamps the polar angle to avoid flipping', () => {
    const eye = orbitToCartesian(target, 0, 200, 4);
    expect(Number.isFinite(eye.x)).toBe(true);
    expect(Number.isFinite(eye.y)).toBe(true);
  });

  it('uses radians consistently', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 5);
  });
});
