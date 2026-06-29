/**
 * Garment search / filter / sort (Module 2).
 *
 * Pure functions over an in-memory garment list plus a CQRS query that sources
 * the list from the {@link IGarmentRepository}. Kept pure so it is fully
 * offline-testable and free of any storage concern; a SQL-backed repository can
 * push these predicates down later without changing the contract.
 */
import { type Result, ok } from '../../shared/Result';
import { type Garment, type GarmentStatus } from '../../domain/entities/Garment';
import { type Season } from '../../domain/value-objects/Season';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type Query, type RequestHandler } from '../bus/types';
import { paginate, type Page } from '../performance/pagination';

export type GarmentSortField =
  | 'name'
  | 'wearCount'
  | 'lastWornAt'
  | 'purchaseDate'
  | 'formality'
  | 'category';

export type SortDirection = 'asc' | 'desc';

export interface GarmentSearchCriteria {
  /** Free-text query matched against name, brand, material and tags. */
  readonly text?: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly status?: GarmentStatus;
  readonly season?: Season;
  /** Every listed tag must be present. */
  readonly tags?: readonly string[];
  /** Exclude archived garments (default: archived are excluded). */
  readonly includeArchived?: boolean;
  readonly sortBy?: GarmentSortField;
  readonly sortDirection?: SortDirection;
  readonly page?: number;
  readonly pageSize?: number;
}

const matchesText = (garment: Garment, text: string): boolean => {
  const needle = text.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  const haystack = [
    garment.name,
    garment.brand ?? '',
    garment.material ?? '',
    garment.category,
    garment.subcategory,
    ...garment.tags,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
};

/** Apply the filter predicates (no sorting/paging). */
export const filterGarments = (
  garments: readonly Garment[],
  criteria: GarmentSearchCriteria,
): readonly Garment[] =>
  garments.filter((g) => {
    if (criteria.includeArchived !== true && g.isArchived) {
      return false;
    }
    if (criteria.status !== undefined && g.status !== criteria.status) {
      return false;
    }
    if (criteria.category !== undefined && g.category !== criteria.category) {
      return false;
    }
    if (criteria.subcategory !== undefined && g.subcategory !== criteria.subcategory) {
      return false;
    }
    if (criteria.season !== undefined && !g.supportsSeason(criteria.season)) {
      return false;
    }
    if (
      criteria.tags !== undefined &&
      !criteria.tags.every((t) => g.tags.includes(t.toLowerCase()))
    ) {
      return false;
    }
    if (criteria.text !== undefined && !matchesText(g, criteria.text)) {
      return false;
    }
    return true;
  });

const compareBy = (a: Garment, b: Garment, field: GarmentSortField): number => {
  switch (field) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'wearCount':
      return a.wearCount - b.wearCount;
    case 'formality':
      return a.formality - b.formality;
    case 'category':
      return a.category.localeCompare(b.category) || a.subcategory.localeCompare(b.subcategory);
    case 'lastWornAt':
      return (a.lastWornAt ?? '').localeCompare(b.lastWornAt ?? '');
    case 'purchaseDate':
      return (a.purchaseDate ?? '').localeCompare(b.purchaseDate ?? '');
    default:
      return 0;
  }
};

/** Sort a copy of the garments by the given field/direction (stable). */
export const sortGarments = (
  garments: readonly Garment[],
  field: GarmentSortField = 'name',
  direction: SortDirection = 'asc',
): readonly Garment[] => {
  const factor = direction === 'desc' ? -1 : 1;
  return [...garments].sort((a, b) => compareBy(a, b, field) * factor);
};

/** Full filter → sort → paginate pipeline. */
export const searchGarments = (
  garments: readonly Garment[],
  criteria: GarmentSearchCriteria = {},
): Page<Garment> => {
  const filtered = filterGarments(garments, criteria);
  const sorted = sortGarments(filtered, criteria.sortBy, criteria.sortDirection);
  return paginate(sorted, criteria.page ?? 1, criteria.pageSize ?? (sorted.length || 1));
};

/* ------------------------------- CQRS query ------------------------------- */

export const SEARCH_GARMENTS = 'wardrobe.search';

export class SearchGarmentsQuery implements Query<Page<Garment>> {
  public readonly type = SEARCH_GARMENTS;
  public constructor(public readonly criteria: GarmentSearchCriteria = {}) {}
}

export class SearchGarmentsHandler
  implements RequestHandler<SearchGarmentsQuery, Page<Garment>>
{
  public constructor(private readonly garments: IGarmentRepository) {}

  public async handle(query: SearchGarmentsQuery): Promise<Result<Page<Garment>>> {
    const all = await this.garments.findAll();
    return ok(searchGarments(all, query.criteria));
  }
}
