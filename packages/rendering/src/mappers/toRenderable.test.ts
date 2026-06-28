import { describe, it, expect } from 'vitest';

import { toRenderableGarment, toRenderableOutfit, type GarmentLike } from './toRenderable';

const dto: GarmentLike = {
  id: 'g1',
  name: 'Camisa',
  category: 'tops',
  subcategory: 'shirt',
  color: { hex: '#2e5cb8', name: 'Azul', isNeutral: false },
  tags: ['casual'],
};

describe('toRenderableGarment', () => {
  it('flattens a DTO-shaped garment into renderer input', () => {
    const g = toRenderableGarment(dto);
    expect(g).toEqual({
      id: 'g1',
      name: 'Camisa',
      category: 'tops',
      subcategory: 'shirt',
      colorHex: '#2e5cb8',
      colorName: 'Azul',
      isNeutral: false,
      tags: ['casual'],
    });
  });

  it('omits optional fields that are absent/null', () => {
    const g = toRenderableGarment({
      id: 'g2',
      name: 'X',
      category: 'shoes',
      subcategory: 'sneakers',
      color: { hex: '#ffffff', name: null },
    });
    expect(g.colorName).toBeUndefined();
    expect(g.isNeutral).toBeUndefined();
    expect(g.tags).toBeUndefined();
  });
});

describe('toRenderableOutfit', () => {
  it('maps an id, optional label and garments', () => {
    const outfit = toRenderableOutfit('principal', [dto], 'Principal');
    expect(outfit.id).toBe('principal');
    expect(outfit.label).toBe('Principal');
    expect(outfit.garments).toHaveLength(1);
    expect(outfit.garments[0]?.colorHex).toBe('#2e5cb8');
  });

  it('omits the label when not provided', () => {
    const outfit = toRenderableOutfit('none', []);
    expect(outfit.label).toBeUndefined();
    expect(outfit.garments).toHaveLength(0);
  });
});
