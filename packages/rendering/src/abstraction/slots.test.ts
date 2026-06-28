import { describe, it, expect } from 'vitest';

import {
  BodyRegion,
  EXCLUSIVE_SLOTS,
  GarmentLayerSlot,
  categoryToSlot,
  slotRenderOrder,
  slotToRegion,
} from './slots';

describe('categoryToSlot', () => {
  it('maps each domain category to its visual slot', () => {
    expect(categoryToSlot('tops')).toBe(GarmentLayerSlot.UpperBody);
    expect(categoryToSlot('bottoms')).toBe(GarmentLayerSlot.LowerBody);
    expect(categoryToSlot('dresses')).toBe(GarmentLayerSlot.FullBody);
    expect(categoryToSlot('outerwear')).toBe(GarmentLayerSlot.Outer);
    expect(categoryToSlot('shoes')).toBe(GarmentLayerSlot.Feet);
    expect(categoryToSlot('accessories')).toBe(GarmentLayerSlot.Accessory);
  });

  it('treats unknown categories as accessories (never crashes)', () => {
    expect(categoryToSlot('space-suit')).toBe(GarmentLayerSlot.Accessory);
  });
});

describe('slotToRegion', () => {
  it('maps slots to body regions', () => {
    expect(slotToRegion(GarmentLayerSlot.UpperBody)).toBe(BodyRegion.Torso);
    expect(slotToRegion(GarmentLayerSlot.LowerBody)).toBe(BodyRegion.Legs);
    expect(slotToRegion(GarmentLayerSlot.Feet)).toBe(BodyRegion.Feet);
    expect(slotToRegion(GarmentLayerSlot.FullBody)).toBe(BodyRegion.FullBody);
  });
});

describe('slotRenderOrder', () => {
  it('draws outerwear above upper body, and accessories on top', () => {
    expect(slotRenderOrder(GarmentLayerSlot.Outer)).toBeGreaterThan(
      slotRenderOrder(GarmentLayerSlot.UpperBody),
    );
    expect(slotRenderOrder(GarmentLayerSlot.Accessory)).toBeGreaterThan(
      slotRenderOrder(GarmentLayerSlot.Outer),
    );
    expect(slotRenderOrder(GarmentLayerSlot.Base)).toBe(0);
  });
});

describe('EXCLUSIVE_SLOTS', () => {
  it('marks the single-occupancy body slots', () => {
    expect(EXCLUSIVE_SLOTS).toContain(GarmentLayerSlot.UpperBody);
    expect(EXCLUSIVE_SLOTS).toContain(GarmentLayerSlot.LowerBody);
    expect(EXCLUSIVE_SLOTS).toContain(GarmentLayerSlot.FullBody);
    expect(EXCLUSIVE_SLOTS).toContain(GarmentLayerSlot.Feet);
    expect(EXCLUSIVE_SLOTS).not.toContain(GarmentLayerSlot.Accessory);
  });
});
