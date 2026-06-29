import { describe, it, expect } from 'vitest';

import { toId } from '../../shared/Identifier';
import { unwrap } from '../../shared/Result';
import { Garment, GarmentStatus } from './Garment';
import { CategoryMetadata } from '../value-objects/CategoryMetadata';
import { LayerSlot } from '../value-objects/GarmentCategory';
import { Photograph, FULL_CROP } from '../value-objects/Photograph';
import { Season } from '../value-objects/Season';
import { makeGarment, color } from '../../__fixtures__/testSupport';

const photo = (id: string, order = 0, primary = false): Photograph =>
  unwrap(Photograph.create({ id: toId(id), storageKey: `key-${id}`, order, isPrimary: primary }));

describe('Photograph value object', () => {
  it('validates rotation and crop bounds', () => {
    expect(Photograph.create({ id: toId('p'), storageKey: '' }).ok).toBe(false);
    expect(
      Photograph.create({ id: toId('p'), storageKey: 'k', rotation: 45 as never }).ok,
    ).toBe(false);
    expect(
      Photograph.create({ id: toId('p'), storageKey: 'k', crop: { x: 0.5, y: 0, width: 0.7, height: 1 } }).ok,
    ).toBe(false);
    expect(Photograph.create({ id: toId('p'), storageKey: 'k', crop: FULL_CROP }).ok).toBe(true);
  });

  it('rotates non-destructively in 90° steps', () => {
    const p = photo('a');
    expect(p.rotateClockwise().rotation).toBe(90);
    expect(p.rotateClockwise().rotateClockwise().rotateClockwise().rotateClockwise().rotation).toBe(0);
  });

  it('starts in the original (un-processed) stage', () => {
    expect(photo('a').stage).toBe('original');
  });
});

describe('Garment — dynamic category metadata', () => {
  it('reads formality/slot/comfort from carried metadata for user-defined categories', () => {
    const md = unwrap(
      CategoryMetadata.create({ layerSlot: LayerSlot.UpperBody, formality: 8, comfort: 0.3 }),
    );
    const g = unwrap(
      Garment.create(toId('g'), {
        name: 'Saco entallado',
        category: 'sacos', // a user-defined category, not in any enum
        subcategory: 'saco-formal',
        categoryId: toId('cat-sacos'),
        categoryMetadata: md,
        color: color('#222222'),
        seasons: [Season.AllSeason],
      }),
    );
    expect(g.formality).toBe(8);
    expect(g.layerSlot).toBe(LayerSlot.UpperBody);
    expect(g.comfort).toBe(0.3);
  });

  it('falls back to the seed taxonomy when no metadata is carried', () => {
    const g = makeGarment({ subcategory: 'blazer', category: 'outerwear' });
    // blazer formality from the legacy seed map is 8
    expect(g.formality).toBe(8);
    expect(g.layerSlot).toBe(LayerSlot.Outer);
  });

  it('skips hardcoded subcategory validation on the dynamic path', () => {
    // "saco-formal" is not a legacy subcategory, but with metadata it is accepted.
    const md = unwrap(CategoryMetadata.create({ formality: 7 }));
    const ok = Garment.create(toId('g'), {
      name: 'X',
      category: 'sacos',
      subcategory: 'saco-formal',
      categoryMetadata: md,
      color: color('#000000'),
      seasons: [Season.AllSeason],
    });
    expect(ok.ok).toBe(true);
  });
});

describe('Garment — smart metadata (extensible)', () => {
  it('stores the full metadata set and an open extension bag', () => {
    const g = unwrap(
      Garment.create(toId('g'), {
        name: 'Camisa',
        category: 'tops',
        subcategory: 'shirt',
        color: color('#ffffff', 'white'),
        secondaryColors: [color('#0000ff', 'blue')],
        brand: 'Acme',
        material: 'cotton',
        seasons: [Season.Summer],
        purchaseDate: '2025-01-15',
        notes: 'gift',
        metadata: { fitNote: 'slim' },
      }),
    );
    expect(g.secondaryColors).toHaveLength(1);
    expect(g.material).toBe('cotton');
    expect(g.purchaseDate).toBe('2025-01-15');
    expect(g.notes).toBe('gift');
    expect(g.usageFrequency).toBe(0);
    g.mergeMetadata({ careLabel: 'machine-wash' });
    expect(g.metadata.fitNote).toBe('slim');
    expect(g.metadata.careLabel).toBe('machine-wash');
  });

  it('rejects a malformed purchase date', () => {
    expect(
      Garment.create(toId('g'), {
        name: 'X',
        category: 'tops',
        subcategory: 'shirt',
        color: color('#ffffff'),
        seasons: [Season.Summer],
        purchaseDate: '15-01-2025',
      }).ok,
    ).toBe(false);
  });
});

describe('Garment — lifecycle', () => {
  it('archives and restores', () => {
    const g = makeGarment();
    expect(g.isWearable).toBe(true);
    unwrap(g.archive());
    expect(g.isArchived).toBe(true);
    expect(g.isWearable).toBe(false);
    unwrap(g.restore());
    expect(g.status).toBe(GarmentStatus.Available);
    // cannot restore a non-archived garment
    expect(g.restore().ok).toBe(false);
  });

  it('produces a duplication snapshot that preserves descriptive metadata', () => {
    const g = makeGarment({ brand: 'Acme', material: 'wool' });
    g.mergeMetadata({ k: 'v' });
    const snap = g.toSnapshot();
    expect(snap.name).toBe(g.name);
    expect(snap.brand).toBe('Acme');
    expect(snap.metadata?.k).toBe('v');
  });
});

describe('Garment — photographs', () => {
  it('adds, normalises order and assigns a primary by default', () => {
    const g = makeGarment();
    unwrap(g.addPhoto(photo('p1', 5)));
    unwrap(g.addPhoto(photo('p2', 1)));
    // add appends and renumbers sequentially; first added becomes primary.
    expect(g.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(g.photos.map((p) => p.order)).toEqual([0, 1]);
    expect(g.primaryPhoto?.id).toBe('p1');
  });

  it('rejects duplicate photo ids', () => {
    const g = makeGarment();
    unwrap(g.addPhoto(photo('p1')));
    expect(g.addPhoto(photo('p1')).ok).toBe(false);
  });

  it('reorders, sets primary and removes', () => {
    const g = makeGarment();
    unwrap(g.addPhoto(photo('p1', 0)));
    unwrap(g.addPhoto(photo('p2', 1)));
    unwrap(g.addPhoto(photo('p3', 2)));
    unwrap(g.reorderPhotos([toId('p3'), toId('p1'), toId('p2')]));
    expect(g.photos.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    unwrap(g.setPrimaryPhoto(toId('p2')));
    expect(g.primaryPhoto?.id).toBe('p2');
    unwrap(g.removePhoto(toId('p3')));
    expect(g.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(g.removePhoto(toId('missing')).ok).toBe(false);
  });
});
