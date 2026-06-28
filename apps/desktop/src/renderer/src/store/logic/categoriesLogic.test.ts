import { describe, it, expect } from 'vitest';

import type { CategoryDTO } from '@shared/ipc';
import {
  buildTree,
  groupRoots,
  moveInOrder,
  validateCategoryName,
  canDeleteCategory,
} from './categoriesLogic';

const cat = (over: Partial<CategoryDTO> & { id: string; name: string }): CategoryDTO => ({
  slug: over.slug ?? over.name.toLowerCase(),
  parentId: over.parentId ?? null,
  group: over.group ?? null,
  order: over.order ?? 0,
  seeded: over.seeded ?? false,
  metadata: {
    layerSlot: 'accessory',
    formality: 5,
    comfort: 0.8,
    heavyOuterwear: false,
    attributes: {},
  },
  ...over,
});

describe('buildTree', () => {
  it('nests subcategories under parents, sorted by order', () => {
    const cats = [
      cat({ id: 'p1', name: 'Camisas', order: 1 }),
      cat({ id: 'p0', name: 'Sacos', order: 0 }),
      cat({ id: 'c1', name: 'Manga larga', parentId: 'p1', order: 1 }),
      cat({ id: 'c0', name: 'Manga corta', parentId: 'p1', order: 0 }),
    ];
    const tree = buildTree(cats);
    expect(tree.map((n) => n.category.id)).toEqual(['p0', 'p1']);
    const camisas = tree.find((n) => n.category.id === 'p1');
    expect(camisas?.children.map((c) => c.id)).toEqual(['c0', 'c1']);
  });
});

describe('groupRoots', () => {
  it('groups top-level categories by their group label', () => {
    const groups = groupRoots([
      cat({ id: 'a', name: 'Sacos', group: 'Formal' }),
      cat({ id: 'b', name: 'Blazers', group: 'Formal' }),
      cat({ id: 'c', name: 'Relojes', group: null }),
    ]);
    expect(groups['Formal']?.map((c) => c.id)).toEqual(['a', 'b']);
    expect(groups['Ungrouped']?.map((c) => c.id)).toEqual(['c']);
  });
});

describe('moveInOrder (drag reorder)', () => {
  it('moves an item to a new index immutably', () => {
    expect(moveInOrder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveInOrder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});

describe('validateCategoryName', () => {
  const siblings = [cat({ id: 's1', name: 'Sacos' })];
  it('rejects empty, too-long and duplicate names', () => {
    expect(validateCategoryName('', siblings).name).toBeDefined();
    expect(validateCategoryName('x'.repeat(81), siblings).name).toBeDefined();
    expect(validateCategoryName('sacos', siblings).name).toBeDefined();
    expect(validateCategoryName('Blazers', siblings).name).toBeUndefined();
    // editing the same record is allowed to keep its name
    expect(validateCategoryName('Sacos', siblings, 's1').name).toBeUndefined();
  });
});

describe('canDeleteCategory', () => {
  it('blocks deletion while garments still reference the category', () => {
    const c = cat({ id: 'x', name: 'Sacos' });
    expect(canDeleteCategory(c, 3).ok).toBe(false);
    expect(canDeleteCategory(c, 0).ok).toBe(true);
  });
});
