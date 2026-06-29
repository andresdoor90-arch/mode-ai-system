import { describe, expect, it } from 'vitest';

import type { GarmentDTO } from '@shared/ipc';

import {
  buildOutfitLayers,
  contrastColor,
  garmentToLayer,
  normalizePattern,
  slotForGarment,
} from './outfitModel';

const garment = (over: Partial<GarmentDTO>): GarmentDTO =>
  ({
    id: over.id ?? 'g1',
    name: over.name ?? 'Item',
    category: over.category ?? 'tops',
    subcategory: over.subcategory ?? 'shirt',
    categoryId: null,
    color: over.color ?? { hex: '#ffffff', name: 'White', category: 'neutral', isNeutral: true },
    secondaryColors: over.secondaryColors ?? [],
    brand: null,
    material: null,
    seasons: ['all-season'],
    images: [],
    photos: [],
    tags: [],
    status: 'available',
    wearCount: 0,
    formality: 5,
    lastWornAt: null,
    purchaseDate: null,
    notes: null,
    ...(over.metadata !== undefined ? { metadata: over.metadata } : {}),
  }) as GarmentDTO;

describe('slotForGarment', () => {
  it('maps categories to body slots', () => {
    expect(slotForGarment({ category: 'tops', subcategory: 'shirt' })).toBe('top');
    expect(slotForGarment({ category: 'bottoms', subcategory: 'jeans' })).toBe('bottom');
    expect(slotForGarment({ category: 'outerwear', subcategory: 'blazer' })).toBe('outerwear');
    expect(slotForGarment({ category: 'shoes', subcategory: 'sneakers' })).toBe('shoes');
    expect(slotForGarment({ category: 'accessories', subcategory: 'belt' })).toBe('belt');
    expect(slotForGarment({ category: 'accessories', subcategory: 'hat' })).toBe('accessory');
    expect(slotForGarment({ category: 'unknown', subcategory: 'x' })).toBeNull();
  });
});

describe('normalizePattern', () => {
  it('recognises Spanish and English pattern words', () => {
    expect(normalizePattern('Rayas azules')).toBe('stripes');
    expect(normalizePattern('A cuadros')).toBe('checks');
    expect(normalizePattern('Puntos negros')).toBe('dots');
    expect(normalizePattern('Estampado floral')).toBe('print');
    expect(normalizePattern('Liso')).toBe('solid');
    expect(normalizePattern(undefined)).toBe('solid');
  });
});

describe('contrastColor', () => {
  it('returns dark on light and light on dark', () => {
    expect(contrastColor('#ffffff')).toBe('#1b1b1f');
    expect(contrastColor('#000000')).toBe('#f4f4f5');
  });
});

describe('garmentToLayer', () => {
  it('builds a simplified layer with pattern + contrast colour', () => {
    const layer = garmentToLayer(
      garment({
        id: 'shirt',
        category: 'tops',
        subcategory: 'shirt',
        color: { hex: '#ffffff', name: 'Blanco', category: 'neutral', isNeutral: true },
        metadata: { pattern: 'Lunares' },
      }),
    );
    expect(layer?.slot).toBe('top');
    expect(layer?.pattern).toBe('dots');
    expect(layer?.colorHex).toBe('#ffffff');
    // White base → dark dots by default contrast.
    expect(layer?.patternColorHex).toBe('#1b1b1f');
  });

  it('uses an explicit secondary colour for the pattern when present', () => {
    const layer = garmentToLayer(
      garment({
        category: 'tops',
        color: { hex: '#ffffff', name: 'Blanco', category: 'neutral', isNeutral: true },
        secondaryColors: [{ hex: '#1f4fff', name: 'Azul', category: 'cool', isNeutral: false }],
        metadata: { pattern: 'Rayas' },
      }),
    );
    expect(layer?.pattern).toBe('stripes');
    expect(layer?.patternColorHex).toBe('#1f4fff');
  });

  it('returns null for garments with no body slot', () => {
    expect(garmentToLayer(garment({ category: 'unknown', subcategory: 'x' }))).toBeNull();
  });
});

describe('buildOutfitLayers', () => {
  it('orders layers by slot z-order and skips empty slots', () => {
    const layers = buildOutfitLayers({
      top: garment({ id: 'top', category: 'tops', subcategory: 'shirt' }),
      bottom: garment({ id: 'bottom', category: 'bottoms', subcategory: 'jeans' }),
      shoes: garment({ id: 'shoes', category: 'shoes', subcategory: 'sneakers' }),
    });
    expect(layers.map((l) => l.slot)).toEqual(['bottom', 'top', 'shoes']);
  });

  it('is empty for an empty selection', () => {
    expect(buildOutfitLayers({})).toEqual([]);
  });
});
