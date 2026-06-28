import { describe, it, expect } from 'vitest';

import { Color, ColorCategory } from './Color';
import { unwrap } from '../../shared/Result';

describe('Color', () => {
  it('parses a 6-digit hex with or without leading #', () => {
    const a = unwrap(Color.fromHex('#ff0000'));
    const b = unwrap(Color.fromHex('FF0000'));
    expect(a.hex).toBe('#ff0000');
    expect(b.hex).toBe('#ff0000');
  });

  it('rejects malformed hex strings', () => {
    expect(Color.fromHex('#fff').ok).toBe(false);
    expect(Color.fromHex('not-a-color').ok).toBe(false);
    expect(Color.fromHex('#gggggg').ok).toBe(false);
  });

  it('derives RGB and HSL from hex', () => {
    const red = unwrap(Color.fromHex('#ff0000'));
    expect(red.rgb).toEqual({ r: 255, g: 0, b: 0 });
    expect(red.hsl.h).toBe(0);
    expect(red.hsl.s).toBe(100);
    expect(red.hsl.l).toBe(50);
  });

  it('classifies warm, cool and neutral colours', () => {
    expect(unwrap(Color.fromHex('#ff0000')).category).toBe(ColorCategory.Warm);
    expect(unwrap(Color.fromHex('#0000ff')).category).toBe(ColorCategory.Cool);
    expect(unwrap(Color.fromHex('#808080')).category).toBe(ColorCategory.Neutral);
    expect(unwrap(Color.fromHex('#000000')).isNeutral).toBe(true);
    expect(unwrap(Color.fromHex('#ffffff')).isNeutral).toBe(true);
  });

  it('computes the shortest hue distance (wrapping around 360)', () => {
    const red = unwrap(Color.fromHex('#ff0000')); // hue 0
    const limeGreen = unwrap(Color.fromHex('#00ff00')); // hue 120
    const violet = unwrap(Color.fromHex('#7f00ff')); // hue ~270
    expect(red.hueDistance(limeGreen)).toBe(120);
    // 0 vs 270 -> shortest is 90, not 270.
    expect(red.hueDistance(violet)).toBe(90);
  });

  it('builds from RGB and HSL and round-trips hue', () => {
    const fromRgb = unwrap(Color.fromRgb({ r: 0, g: 0, b: 255 }));
    expect(fromRgb.hex).toBe('#0000ff');
    const fromHsl = unwrap(Color.fromHsl({ h: 240, s: 100, l: 50 }));
    expect(fromHsl.hsl.h).toBe(240);
  });

  it('validates RGB and HSL ranges', () => {
    expect(Color.fromRgb({ r: 300, g: 0, b: 0 }).ok).toBe(false);
    expect(Color.fromHsl({ h: 400, s: 0, l: 0 }).ok).toBe(false);
  });

  it('is compared by value', () => {
    expect(unwrap(Color.fromHex('#abcdef')).equals(unwrap(Color.fromHex('#ABCDEF')))).toBe(true);
    expect(unwrap(Color.fromHex('#abcdef')).equals(unwrap(Color.fromHex('#123456')))).toBe(false);
  });
});
