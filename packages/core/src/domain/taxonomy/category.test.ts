import { describe, it, expect } from 'vitest';

import { toId } from '../../shared/Identifier';
import { unwrap } from '../../shared/Result';
import { SequentialIdGenerator } from '../../shared/IdGenerator';
import { Category, slugify } from '../entities/Category';
import { CategoryMetadata } from '../value-objects/CategoryMetadata';
import { LayerSlot } from '../value-objects/GarmentCategory';
import {
  buildDefaultTaxonomy,
  defaultCategoryMetadata,
  defaultComfort,
  isDefaultHeavyOuterwear,
} from './defaultTaxonomy';
import { buildCategoryTree } from '../../application/queries/categoryQueries';

describe('slugify', () => {
  it('produces stable kebab slugs and strips accents', () => {
    expect(slugify('Pantalones Elegantes')).toBe('pantalones-elegantes');
    expect(slugify('Camisas Manga Corta')).toBe('camisas-manga-corta');
    expect(slugify('  Sacos & Blazers!  ')).toBe('sacos-blazers');
  });
});

describe('CategoryMetadata', () => {
  it('validates ranges and defaults missing fields', () => {
    const ok = unwrap(CategoryMetadata.create({ formality: 8, layerSlot: LayerSlot.Outer }));
    expect(ok.formality).toBe(8);
    expect(ok.comfort).toBe(0.8);
    expect(CategoryMetadata.create({ formality: 99 }).ok).toBe(false);
    expect(CategoryMetadata.create({ comfort: 2 }).ok).toBe(false);
  });

  it('supports forward-compatible attributes and immutable updates', () => {
    const md = unwrap(CategoryMetadata.create({ attributes: { fabricWeight: 'heavy' } }));
    const next = unwrap(md.with({ formality: 9 }));
    expect(next.formality).toBe(9);
    expect(next.attributes.fabricWeight).toBe('heavy');
    expect(md.formality).toBe(5); // original unchanged
  });
});

describe('Category aggregate', () => {
  it('creates a user-defined category (no hardcoding) with a derived slug', () => {
    const c = unwrap(Category.create(toId('c1'), { name: 'Relojes', metadata: { formality: 6 } }));
    expect(c.slug).toBe('relojes');
    expect(c.isSubcategory).toBe(false);
    expect(c.seeded).toBe(false);
    expect(c.metadata.formality).toBe(6);
  });

  it('rejects an empty name and an over-long name', () => {
    expect(Category.create(toId('c2'), { name: '  ' }).ok).toBe(false);
    expect(Category.create(toId('c3'), { name: 'x'.repeat(200) }).ok).toBe(false);
  });

  it('supports nesting (subcategories), grouping and reordering', () => {
    const parent = unwrap(Category.create(toId('p'), { name: 'Camisas' }));
    const child = unwrap(Category.create(toId('ch'), { name: 'Manga Larga', parentId: parent.id }));
    expect(child.isSubcategory).toBe(true);
    child.regroup('Formal');
    expect(child.group).toBe('Formal');
    unwrap(child.reorder(3));
    expect(child.order).toBe(3);
    unwrap(child.rename('Manga larga clásica'));
    expect(child.name).toBe('Manga larga clásica');
  });

  it('refuses to become its own parent', () => {
    const c = unwrap(Category.create(toId('self'), { name: 'X' }));
    expect(c.moveTo(toId('self')).ok).toBe(false);
  });
});

describe('default taxonomy seed/migration', () => {
  it('reproduces the legacy taxonomy as editable data with metadata', () => {
    const seeded = buildDefaultTaxonomy(new SequentialIdGenerator('cat'));
    const roots = seeded.filter((c) => c.parentId === null);
    expect(roots.map((r) => r.slug).sort()).toEqual(
      ['accessories', 'bottoms', 'dresses', 'outerwear', 'shoes', 'tops'].sort(),
    );
    // Every node is seeded but fully editable.
    expect(seeded.every((c) => c.seeded)).toBe(true);
    // A known subcategory keeps its legacy formality.
    const tie = seeded.find((c) => c.slug === 'tie');
    expect(tie?.metadata.formality).toBe(9);
    const evening = seeded.find((c) => c.slug === 'evening-gown');
    expect(evening?.metadata.formality).toBe(10);
    // Outerwear coat is flagged heavy.
    const coat = seeded.find((c) => c.slug === 'coat');
    expect(coat?.metadata.heavyOuterwear).toBe(true);
  });

  it('builds a sorted parent→children tree', () => {
    const seeded = buildDefaultTaxonomy(new SequentialIdGenerator('cat'));
    const tree = buildCategoryTree(seeded);
    expect(tree.length).toBe(6);
    const tops = tree.find((n) => n.category.slug === 'tops');
    expect(tops?.children.length ?? 0).toBeGreaterThan(0);
    // children are sorted by order
    const orders = tops!.children.map((c) => c.order);
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
  });

  it('exposes legacy fallbacks consistent with the seed', () => {
    expect(defaultComfort('heels')).toBe(0.2);
    expect(defaultComfort('unknown-thing')).toBe(0.8);
    expect(isDefaultHeavyOuterwear('parka')).toBe(true);
    expect(isDefaultHeavyOuterwear('blazer')).toBe(false);
    const md = defaultCategoryMetadata('shoes', 'dress-shoes');
    expect(md.layerSlot).toBe(LayerSlot.Feet);
    expect(md.formality).toBe(9);
  });
});
