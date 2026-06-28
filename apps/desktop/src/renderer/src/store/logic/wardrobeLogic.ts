/**
 * Wardrobe state logic (pure).
 *
 * Filtering, sorting and grouping of garments are expressed as pure functions
 * over plain DTOs, deliberately decoupled from Zustand and React. The store
 * (`wardrobeStore`) composes these; tests exercise them directly without any
 * framework, which is what lets the wardrobe logic be verified offline.
 */
import type { GarmentDTO, GarmentStatusDTO } from '@shared/ipc';

/** Active filters applied to the wardrobe grid. */
export interface WardrobeFilters {
  readonly query: string;
  readonly category: string | 'all';
  readonly status: GarmentStatusDTO | 'all';
  readonly season: string | 'all';
}

/** Sort orderings offered in the UI. */
export type WardrobeSort = 'name-asc' | 'name-desc' | 'most-worn' | 'least-worn';

export const DEFAULT_WARDROBE_FILTERS: WardrobeFilters = {
  query: '',
  category: 'all',
  status: 'all',
  season: 'all',
};

/** Whether a garment matches the free-text query (name, brand or tags). */
function matchesQuery(garment: GarmentDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return true;
  }
  if (garment.name.toLowerCase().includes(q)) {
    return true;
  }
  if (garment.brand !== null && garment.brand.toLowerCase().includes(q)) {
    return true;
  }
  return garment.tags.some((tag) => tag.toLowerCase().includes(q));
}

/** Apply all active filters, returning the matching garments in input order. */
export function filterGarments(
  garments: readonly GarmentDTO[],
  filters: WardrobeFilters,
): GarmentDTO[] {
  return garments.filter((garment) => {
    if (!matchesQuery(garment, filters.query)) {
      return false;
    }
    if (filters.category !== 'all' && garment.category !== filters.category) {
      return false;
    }
    if (filters.status !== 'all' && garment.status !== filters.status) {
      return false;
    }
    if (
      filters.season !== 'all' &&
      !garment.seasons.includes(filters.season) &&
      !garment.seasons.includes('all-season')
    ) {
      return false;
    }
    return true;
  });
}

/** Return a new array sorted according to the chosen ordering. */
export function sortGarments(
  garments: readonly GarmentDTO[],
  sort: WardrobeSort,
): GarmentDTO[] {
  const copy = [...garments];
  switch (sort) {
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'most-worn':
      return copy.sort((a, b) => b.wearCount - a.wearCount);
    case 'least-worn':
      return copy.sort((a, b) => a.wearCount - b.wearCount);
    default:
      return copy;
  }
}

/** Group garments by their category. */
export function groupByCategory(
  garments: readonly GarmentDTO[],
): Record<string, GarmentDTO[]> {
  const groups: Record<string, GarmentDTO[]> = {};
  for (const garment of garments) {
    (groups[garment.category] ??= []).push(garment);
  }
  return groups;
}

/** Count garments per lifecycle status. */
export function countByStatus(
  garments: readonly GarmentDTO[],
): Record<GarmentStatusDTO, number> {
  const counts: Record<GarmentStatusDTO, number> = {
    available: 0,
    'in-laundry': 0,
    damaged: 0,
    archived: 0,
  };
  for (const garment of garments) {
    counts[garment.status] += 1;
  }
  return counts;
}

/** Distinct, sorted brand names present in the wardrobe. */
export function uniqueBrands(garments: readonly GarmentDTO[]): string[] {
  const brands = new Set<string>();
  for (const garment of garments) {
    if (garment.brand !== null && garment.brand.length > 0) {
      brands.add(garment.brand);
    }
  }
  return [...brands].sort((a, b) => a.localeCompare(b));
}
