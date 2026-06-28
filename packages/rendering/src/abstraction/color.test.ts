import { describe, it, expect } from 'vitest';

import { colorFromHex, FALLBACK_HEX, mixColors, normalizeHex } from './color';

describe('normalizeHex', () => {
  it('accepts hex with and without leading #', () => {
    expect(normalizeHex('#A1B2C3')).toBe('#a1b2c3');
    expect(normalizeHex('a1b2c3')).toBe('#a1b2c3');
  });

  it('rejects malformed hex', () => {
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('nope')).toBeNull();
    expect(normalizeHex('#12345g')).toBeNull();
  });
});

describe('colorFromHex', () => {
  it('derives rgb / srgb / linear / luminance for white', () => {
    const c = colorFromHex('#ffffff');
    expect(c.rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(c.srgb.r).toBe(1);
    expect(c.linear.r).toBe(1);
    expect(c.luminance).toBeCloseTo(1, 3);
    expect(c.isDark).toBe(false);
  });

  it('flags dark colours', () => {
    const c = colorFromHex('#000000');
    expect(c.luminance).toBeCloseTo(0, 5);
    expect(c.isDark).toBe(true);
  });

  it('applies the sRGB->linear transfer (linear < srgb for mid greys)', () => {
    const c = colorFromHex('#808080');
    expect(c.linear.r).toBeLessThan(c.srgb.r);
  });

  it('falls back to a neutral grey on invalid input', () => {
    const c = colorFromHex('garbage');
    expect(c.hex).toBe(FALLBACK_HEX);
  });
});

describe('mixColors', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    const black = colorFromHex('#000000');
    const white = colorFromHex('#ffffff');
    expect(mixColors(black, white, 0).hex).toBe('#000000');
    expect(mixColors(black, white, 1).hex).toBe('#ffffff');
  });

  it('produces a mid grey at t=0.5', () => {
    const mixed = mixColors(colorFromHex('#000000'), colorFromHex('#ffffff'), 0.5);
    expect(mixed.rgb.r).toBeGreaterThanOrEqual(127);
    expect(mixed.rgb.r).toBeLessThanOrEqual(128);
  });
});
