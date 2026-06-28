import { describe, it, expect } from 'vitest';

import { GarmentLayerSlot } from '../abstraction/slots';
import { casualOutfit, dress, heels, jeans, makeGarment, shirt } from '../__fixtures__/garments';
import { OutfitRenderer } from './OutfitRenderer';

describe('OutfitRenderer', () => {
  it('produces one layer per garment, sorted by render order', () => {
    const layers = new OutfitRenderer().toLayers(casualOutfit);
    expect(layers).toHaveLength(4);
    const orders = layers.map((l) => l.renderOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    // outerwear (coat) draws last among the body layers
    expect(layers[layers.length - 1]?.slot).toBe(GarmentLayerSlot.Outer);
  });

  it('hides separate top & bottom when a full-body dress is present', () => {
    const layers = new OutfitRenderer().toLayers({
      id: 'mix',
      garments: [dress, shirt, jeans, heels],
    });
    const byId = new Map(layers.map((l) => [l.garmentId, l]));
    expect(byId.get('g-dress')?.visible).toBe(true);
    expect(byId.get('g-shirt')?.visible).toBe(false);
    expect(byId.get('g-jeans')?.visible).toBe(false);
    expect(byId.get('g-heels')?.visible).toBe(true);
  });

  it('keeps only the first garment visible within an exclusive slot', () => {
    const a = makeGarment({ id: 'top-a', category: 'tops', subcategory: 'shirt' });
    const b = makeGarment({ id: 'top-b', category: 'tops', subcategory: 'blouse' });
    const layers = new OutfitRenderer().toLayers({ id: 'two-tops', garments: [a, b] });
    const visible = layers.filter((l) => l.slot === GarmentLayerSlot.UpperBody && l.visible);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.garmentId).toBe('top-a');
  });

  it('is deterministic: same outfit yields the same layer order', () => {
    const r = new OutfitRenderer();
    const first = r.toLayers(casualOutfit).map((l) => l.garmentId);
    const second = r.toLayers(casualOutfit).map((l) => l.garmentId);
    expect(first).toEqual(second);
  });

  it('handles an empty outfit gracefully', () => {
    expect(new OutfitRenderer().toLayers({ id: 'none', garments: [] })).toHaveLength(0);
  });
});
