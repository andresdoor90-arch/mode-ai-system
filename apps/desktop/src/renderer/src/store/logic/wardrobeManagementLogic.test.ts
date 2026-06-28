import { describe, it, expect } from 'vitest';

import type { GarmentDTO } from '@shared/ipc';
import {
  toggleSelection,
  selectRange,
  selectAll,
  isAllSelected,
  availableBulkActions,
  resolveSelected,
  sortForManagement,
  statusIndicator,
} from './wardrobeManagementLogic';

const g = (id: string, over: Partial<GarmentDTO> = {}): GarmentDTO => ({
  id,
  name: over.name ?? `G ${id}`,
  category: over.category ?? 'tops',
  subcategory: 'shirt',
  categoryId: null,
  color: { hex: '#000000', name: 'black', category: 'neutral', isNeutral: true },
  secondaryColors: [],
  brand: null,
  material: null,
  seasons: ['all-season'],
  images: [],
  photos: [],
  tags: [],
  status: over.status ?? 'available',
  wearCount: over.wearCount ?? 0,
  formality: over.formality ?? 5,
  lastWornAt: null,
  purchaseDate: null,
  notes: null,
});

describe('selection', () => {
  const visible = [g('a'), g('b'), g('c'), g('d')];

  it('toggles ids immutably', () => {
    const s1 = toggleSelection(new Set(), 'a');
    expect([...s1]).toEqual(['a']);
    const s2 = toggleSelection(s1, 'a');
    expect(s2.size).toBe(0);
  });

  it('selects a shift-click range', () => {
    const s = selectRange(visible, new Set(), 'b', 'd');
    expect([...s].sort()).toEqual(['b', 'c', 'd']);
  });

  it('select-all and isAllSelected', () => {
    const all = selectAll(visible);
    expect(all.size).toBe(4);
    expect(isAllSelected(visible, all)).toBe(true);
    expect(isAllSelected(visible, new Set(['a']))).toBe(false);
  });
});

describe('bulk actions', () => {
  it('offers archive for active and restore for archived selections', () => {
    expect(availableBulkActions([])).toEqual([]);
    const active = availableBulkActions([g('a', { status: 'available' })]);
    expect(active).toContain('archive');
    expect(active).not.toContain('restore');
    const archived = availableBulkActions([g('a', { status: 'archived' })]);
    expect(archived).toContain('restore');
    const mixed = availableBulkActions([
      g('a', { status: 'available' }),
      g('b', { status: 'archived' }),
    ]);
    expect(mixed).toContain('archive');
    expect(mixed).toContain('restore');
  });

  it('resolves selected DTOs in list order', () => {
    const list = [g('a'), g('b'), g('c')];
    expect(resolveSelected(list, new Set(['c', 'a'])).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('management sort', () => {
  const list = [
    g('a', { name: 'Zeta', wearCount: 1, category: 'tops' }),
    g('b', { name: 'Alpha', wearCount: 9, category: 'shoes' }),
  ];
  it('sorts by name, wear and category, and reverses for recently-added', () => {
    expect(sortForManagement(list, 'name-asc').map((x) => x.name)).toEqual(['Alpha', 'Zeta']);
    expect(sortForManagement(list, 'most-worn')[0]?.name).toBe('Alpha');
    expect(sortForManagement(list, 'category')[0]?.category).toBe('shoes');
    expect(sortForManagement(list, 'recently-added')[0]?.id).toBe('b');
  });
});

describe('status indicators', () => {
  it('maps statuses to tones', () => {
    expect(statusIndicator('available').tone).toBe('positive');
    expect(statusIndicator('damaged').tone).toBe('danger');
    expect(statusIndicator('archived').tone).toBe('neutral');
  });
});
