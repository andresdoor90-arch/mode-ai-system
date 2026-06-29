import { describe, it, expect } from 'vitest';

import { makeGarment } from '../__fixtures__/garments';
import { TextureManager } from './TextureManager';

describe('TextureManager', () => {
  it('maps subcategory to a fabric finish', () => {
    const tm = new TextureManager();
    expect(tm.materialFor(makeGarment({ id: 'a', subcategory: 'jeans' })).finish).toBe('denim');
    expect(tm.materialFor(makeGarment({ id: 'b', subcategory: 'sweater' })).finish).toBe('knit');
    expect(tm.materialFor(makeGarment({ id: 'c', subcategory: 'boots' })).finish).toBe('leather');
    expect(tm.materialFor(makeGarment({ id: 'd', subcategory: 'blouse' })).finish).toBe('satin');
    expect(tm.materialFor(makeGarment({ id: 'e', subcategory: 't-shirt' })).finish).toBe('matte');
  });

  it('lets explicit tags override the subcategory finish', () => {
    const tm = new TextureManager();
    const m = tm.materialFor(
      makeGarment({ id: 'f', subcategory: 't-shirt', tags: ['leather'] }),
    );
    expect(m.finish).toBe('leather');
  });

  it('reduces opacity for sheer fabrics', () => {
    const tm = new TextureManager();
    const m = tm.materialFor(makeGarment({ id: 'g', tags: ['sheer'] }));
    expect(m.opacity).toBeLessThan(1);
  });

  it('carries the garment colour into the material', () => {
    const tm = new TextureManager();
    const m = tm.materialFor(makeGarment({ id: 'h', colorHex: '#2e5cb8' }));
    expect(m.color.hex).toBe('#2e5cb8');
  });

  it('derives a texture key from the finish', () => {
    const tm = new TextureManager();
    const m = tm.materialFor(makeGarment({ id: 'i', subcategory: 'jeans' }));
    expect(m.textureKey).toBe('texture:fabric/denim');
  });

  it('memoises by colour + subcategory + tags', () => {
    const tm = new TextureManager();
    const g1 = makeGarment({ id: 'x1', colorHex: '#abcdef', subcategory: 'shirt' });
    const g2 = makeGarment({ id: 'x2', colorHex: '#abcdef', subcategory: 'shirt' });
    const a = tm.materialFor(g1);
    const b = tm.materialFor(g2);
    expect(a).toBe(b); // same cached instance — identical visual key
    expect(tm.size).toBe(1);
  });

  it('clamps roughness/metalness into [0,1]', () => {
    const tm = new TextureManager();
    const m = tm.materialFor(makeGarment({ id: 'j', subcategory: 'watch' }));
    expect(m.roughness).toBeGreaterThanOrEqual(0);
    expect(m.roughness).toBeLessThanOrEqual(1);
    expect(m.metalness).toBeGreaterThanOrEqual(0);
    expect(m.metalness).toBeLessThanOrEqual(1);
  });
});
