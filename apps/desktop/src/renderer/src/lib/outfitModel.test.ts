import { describe, expect, it } from 'vitest';

import type { GarmentDTO } from '@shared/ipc';

import {
  buildOutfitLayers,
  contrastColor,
  garmentToLayer,
  normalizePattern,
  selectionFromGarments,
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
  it('maps the fixed taxonomy categories to body slots', () => {
    expect(slotForGarment({ category: 'tops', subcategory: 'shirt' })).toBe('top');
    expect(slotForGarment({ category: 'bottoms', subcategory: 'jeans' })).toBe('bottom');
    expect(slotForGarment({ category: 'outerwear', subcategory: 'blazer' })).toBe('outerwear');
    expect(slotForGarment({ category: 'shoes', subcategory: 'sneakers' })).toBe('shoes');
    expect(slotForGarment({ category: 'accessories', subcategory: 'belt' })).toBe('belt');
    expect(slotForGarment({ category: 'accessories', subcategory: 'hat' })).toBe('accessory');
  });

  it('prefers the explicit category layer slot (user-defined categories)', () => {
    expect(
      slotForGarment({
        category: 'mi-categoria',
        subcategory: '',
        metadata: { layerSlot: 'upper-body' },
      }),
    ).toBe('top');
    expect(
      slotForGarment({ category: 'x', subcategory: '', metadata: { layerSlot: 'lower-body' } }),
    ).toBe('bottom');
    expect(
      slotForGarment({ category: 'x', subcategory: '', metadata: { layerSlot: 'outer' } }),
    ).toBe('outerwear');
    expect(
      slotForGarment({ category: 'x', subcategory: '', metadata: { layerSlot: 'feet' } }),
    ).toBe('shoes');
    expect(
      slotForGarment({
        category: 'x',
        subcategory: 'cinturon',
        metadata: { layerSlot: 'accessory' },
      }),
    ).toBe('belt');
    expect(
      slotForGarment({ category: 'x', subcategory: 'reloj', metadata: { layerSlot: 'accessory' } }),
    ).toBe('accessory');
  });

  it('infers the slot from a user-named category when no layer slot is set', () => {
    expect(slotForGarment({ category: 'Camisas de iglesia', subcategory: '' })).toBe('top');
    expect(slotForGarment({ category: 'Zapatos formales', subcategory: '' })).toBe('shoes');
    expect(slotForGarment({ category: 'Cinturones', subcategory: '' })).toBe('belt');
    expect(slotForGarment({ category: 'Ocasión especial', subcategory: '' })).toBeNull();
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

describe('selectionFromGarments (advisor auto-dress)', () => {
  it('places each recommended garment in its body slot (first wins per slot)', () => {
    const selection = selectionFromGarments([
      garment({ id: 'shirt', category: 'tops', subcategory: 'shirt' }),
      garment({ id: 'jeans', category: 'bottoms', subcategory: 'jeans' }),
      garment({ id: 'oxford', category: 'shoes', subcategory: 'oxford' }),
      // A second top must NOT displace the first (engine returns one per slot,
      // but we stay coherent regardless).
      garment({ id: 'tee', category: 'tops', subcategory: 'tee' }),
    ]);
    expect(selection.top?.id).toBe('shirt');
    expect(selection.bottom?.id).toBe('jeans');
    expect(selection.shoes?.id).toBe('oxford');
    // The resulting selection draws as ordered layers on the mannequin.
    expect(buildOutfitLayers(selection).map((l) => l.slot)).toEqual(['bottom', 'top', 'shoes']);
  });

  it('skips garments with no wearable slot and yields an empty selection for none', () => {
    expect(selectionFromGarments([garment({ category: 'unknown', subcategory: 'x' })])).toEqual({});
    expect(selectionFromGarments([])).toEqual({});
  });
});
