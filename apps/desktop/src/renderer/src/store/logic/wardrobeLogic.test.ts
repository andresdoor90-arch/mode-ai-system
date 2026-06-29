import { describe, it, expect } from 'vitest';

import type { GarmentDTO, GarmentStatusDTO } from '@shared/ipc';

import {
  countByStatus,
  DEFAULT_WARDROBE_FILTERS,
  filterGarments,
  groupByCategory,
  sortGarments,
  uniqueBrands,
} from './wardrobeLogic';

function garment(overrides: Partial<GarmentDTO> = {}): GarmentDTO {
  return {
    id: overrides.id ?? 'g1',
    name: overrides.name ?? 'Sample',
    category: overrides.category ?? 'tops',
    subcategory: overrides.subcategory ?? 'shirt',
    color: overrides.color ?? {
      hex: '#000000',
      name: 'Black',
      category: 'neutral',
      isNeutral: true,
    },
    brand: overrides.brand ?? null,
    seasons: overrides.seasons ?? ['all-season'],
    images: overrides.images ?? [],
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'available',
    wearCount: overrides.wearCount ?? 0,
    lastWornAt: overrides.lastWornAt ?? null,
  };
}

const wardrobe: GarmentDTO[] = [
  garment({
    id: 'a',
    name: 'Navy Shirt',
    category: 'tops',
    brand: 'Atelier',
    tags: ['work'],
    wearCount: 5,
    seasons: ['spring'],
  }),
  garment({
    id: 'b',
    name: 'Indigo Jeans',
    category: 'bottoms',
    brand: 'Denimco',
    tags: ['casual'],
    wearCount: 12,
    status: 'in-laundry',
  }),
  garment({
    id: 'c',
    name: 'Wool Coat',
    category: 'outerwear',
    brand: 'Atelier',
    tags: ['warm'],
    wearCount: 2,
    seasons: ['winter'],
  }),
];

describe('filterGarments', () => {
  it('returns everything with default filters', () => {
    expect(filterGarments(wardrobe, DEFAULT_WARDROBE_FILTERS)).toHaveLength(3);
  });

  it('matches the free-text query across name, brand and tags', () => {
    expect(filterGarments(wardrobe, { ...DEFAULT_WARDROBE_FILTERS, query: 'navy' })).toHaveLength(
      1,
    );
    expect(
      filterGarments(wardrobe, { ...DEFAULT_WARDROBE_FILTERS, query: 'atelier' }),
    ).toHaveLength(2);
    expect(filterGarments(wardrobe, { ...DEFAULT_WARDROBE_FILTERS, query: 'warm' })).toHaveLength(
      1,
    );
  });

  it('filters by category and status', () => {
    expect(
      filterGarments(wardrobe, { ...DEFAULT_WARDROBE_FILTERS, category: 'tops' }),
    ).toHaveLength(1);
    expect(
      filterGarments(wardrobe, {
        ...DEFAULT_WARDROBE_FILTERS,
        status: 'in-laundry' as GarmentStatusDTO,
      }),
    ).toHaveLength(1);
  });

  it('treats all-season garments as matching any season filter', () => {
    // 'a' is spring, 'b' is all-season, 'c' is winter -> spring filter keeps a & b.
    const result = filterGarments(wardrobe, { ...DEFAULT_WARDROBE_FILTERS, season: 'spring' });
    expect(result.map((g) => g.id).sort()).toEqual(['a', 'b']);
  });
});

describe('sortGarments', () => {
  it('sorts by name ascending and descending', () => {
    expect(sortGarments(wardrobe, 'name-asc').map((g) => g.name)[0]).toBe('Indigo Jeans');
    expect(sortGarments(wardrobe, 'name-desc').map((g) => g.name)[0]).toBe('Wool Coat');
  });

  it('sorts by wear count', () => {
    expect(sortGarments(wardrobe, 'most-worn').map((g) => g.id)[0]).toBe('b');
    expect(sortGarments(wardrobe, 'least-worn').map((g) => g.id)[0]).toBe('c');
  });

  it('does not mutate the input array', () => {
    const before = wardrobe.map((g) => g.id);
    sortGarments(wardrobe, 'name-asc');
    expect(wardrobe.map((g) => g.id)).toEqual(before);
  });
});

describe('groupByCategory / countByStatus / uniqueBrands', () => {
  it('groups by category', () => {
    const groups = groupByCategory(wardrobe);
    expect(Object.keys(groups).sort()).toEqual(['bottoms', 'outerwear', 'tops']);
    expect(groups.tops).toHaveLength(1);
  });

  it('counts garments by status', () => {
    const counts = countByStatus(wardrobe);
    expect(counts.available).toBe(2);
    expect(counts['in-laundry']).toBe(1);
    expect(counts.damaged).toBe(0);
  });

  it('lists unique sorted brands', () => {
    expect(uniqueBrands(wardrobe)).toEqual(['Atelier', 'Denimco']);
  });
});
