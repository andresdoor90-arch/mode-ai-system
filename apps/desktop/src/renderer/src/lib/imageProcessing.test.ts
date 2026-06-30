import { BaselineColorExtractor } from '@mas/core';
import { describe, expect, it } from 'vitest';

import { segmentGarmentSamples } from './imageProcessing';

/**
 * Build a raw RGBA buffer from a per-pixel painter. Mirrors what a canvas
 * `getImageData().data` would contain, so we can test segmentation without a DOM.
 */
const buildRgba = (
  width: number,
  height: number,
  paint: (x: number, y: number) => readonly [number, number, number, number],
): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
};

const WHITE: readonly [number, number, number, number] = [255, 255, 255, 255];
const NAVY: readonly [number, number, number, number] = [30, 40, 90, 255];

describe('segmentGarmentSamples', () => {
  it('ignores a white background and keeps only the garment pixels', () => {
    const size = 12;
    // Navy garment fills the interior; white sheet around the border.
    const data = buildRgba(size, size, (x, y) => {
      const border = x < 2 || x >= size - 2 || y < 2 || y >= size - 2;
      return border ? WHITE : NAVY;
    });
    const samples = segmentGarmentSamples(data, size, size);
    expect(samples.length).toBeGreaterThan(0);
    // Not a single white background pixel survives.
    expect(samples.every((s) => s.r < 120 && s.g < 120 && s.b < 160)).toBe(true);
    // And the colour baseline now reads the garment colour, not the backdrop.
    const [primary] = new BaselineColorExtractor().extract(samples, 1);
    expect(primary).toBe('#1e285a'); // ≈ navy, never #ffffff
  });

  it('also strips a dark/wood-toned backdrop', () => {
    const size = 12;
    const WOOD: readonly [number, number, number, number] = [150, 110, 70, 255];
    const RED: readonly [number, number, number, number] = [200, 30, 30, 255];
    const data = buildRgba(size, size, (x, y) => {
      const border = x < 2 || x >= size - 2 || y < 2 || y >= size - 2;
      return border ? WOOD : RED;
    });
    const samples = segmentGarmentSamples(data, size, size);
    expect(samples.length).toBeGreaterThan(0);
    // The wood tone (high red+green, low blue) must be gone; only the red shirt.
    expect(samples.every((s) => s.r > 150 && s.g < 90 && s.b < 90)).toBe(true);
  });

  it('keeps a SMALL object (e.g. a thin belt) that covers a tiny % of the frame', () => {
    // 40×40 white frame with a thin brown belt (~3% of pixels). The previous
    // 5%-of-frame floor discarded this and fell back to the white background;
    // the small absolute floor now keeps the belt so its colour wins.
    const size = 40;
    const BROWN: readonly [number, number, number, number] = [120, 70, 40, 255];
    const data = buildRgba(size, size, (x, y) => {
      const onBelt = y >= 19 && y <= 20 && x >= 8 && x <= 31;
      return onBelt ? BROWN : WHITE;
    });
    const samples = segmentGarmentSamples(data, size, size);
    expect(samples.length).toBe(48);
    expect(samples.every((s) => s.r === 120 && s.g === 70 && s.b === 40)).toBe(true);
    const [primary] = new BaselineColorExtractor().extract(samples, 1);
    expect(primary).not.toBe('#ffffff'); // the white sheet must NOT win
  });

  it('falls back to every opaque pixel when the garment fills the frame', () => {
    const size = 10;
    // Uniform colour everywhere: the border estimate equals the garment, so
    // segmentation cannot separate them — keep all pixels rather than lose colour.
    const data = buildRgba(size, size, () => WHITE);
    const samples = segmentGarmentSamples(data, size, size);
    expect(samples.length).toBe(size * size);
  });

  it('skips fully transparent pixels (cut-out backgrounds)', () => {
    const size = 8;
    const data = buildRgba(size, size, (x, y) => {
      const inObject = x >= 3 && x <= 4 && y >= 3 && y <= 4;
      return inObject ? NAVY : [0, 0, 0, 0];
    });
    const samples = segmentGarmentSamples(data, size, size);
    // Only the 4 opaque navy pixels are considered.
    expect(samples.length).toBe(4);
    expect(samples.every((s) => s.b === 90)).toBe(true);
  });
});
