import { describe, it, expect } from 'vitest';

import { BodyRegion, GarmentLayerSlot } from '../abstraction/slots';
import { coat, jeans, shirt } from '../__fixtures__/garments';
import { ClothingRenderer } from './ClothingRenderer';

describe('ClothingRenderer', () => {
  it('resolves a shirt into an upper-body torso layer', () => {
    const layer = new ClothingRenderer().toLayer(shirt);
    expect(layer.garmentId).toBe('g-shirt');
    expect(layer.slot).toBe(GarmentLayerSlot.UpperBody);
    expect(layer.region).toBe(BodyRegion.Torso);
    expect(layer.visible).toBe(true);
    expect(layer.meshKey).toBe('mesh:garment/tops');
  });

  it('maps the garment colour into the layer material', () => {
    const layer = new ClothingRenderer().toLayer(jeans);
    expect(layer.material.color.hex).toBe('#1f3a5f');
    expect(layer.material.finish).toBe('denim');
  });

  it('gives outerwear a higher render order than tops', () => {
    const cr = new ClothingRenderer();
    expect(cr.toLayer(coat).renderOrder).toBeGreaterThan(cr.toLayer(shirt).renderOrder);
  });
});
