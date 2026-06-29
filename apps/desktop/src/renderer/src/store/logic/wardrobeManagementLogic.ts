/**
 * Wardrobe-management UI logic (pure) — Module 7.
 *
 * Selection, view-mode, bulk-action and advanced-sort helpers for the
 * professional wardrobe screen (grid/list, multi-select, bulk actions, side
 * properties panel). Kept pure and framework-free so the behaviour is verified
 * offline; the Zustand store and React components merely compose these.
 */
import type { GarmentDTO, GarmentStatusDTO } from '@shared/ipc';

/** How the garment library is laid out. */
export type WardrobeViewMode = 'grid' | 'list';

/** Bulk actions available when one or more garments are selected. */
export type BulkAction = 'archive' | 'restore' | 'delete' | 'tag';

/** Extended sort orderings for the management screen. */
export type ManagementSort =
  | 'name-asc'
  | 'name-desc'
  | 'most-worn'
  | 'least-worn'
  | 'recently-added'
  | 'category';

/** Toggle a garment id in a selection set, returning a NEW set (immutable). */
export function toggleSelection(selection: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selection);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** Select a contiguous range (shift-click) between two ids in the visible list. */
export function selectRange(
  visible: readonly GarmentDTO[],
  selection: ReadonlySet<string>,
  anchorId: string,
  targetId: string,
): Set<string> {
  const next = new Set(selection);
  const a = visible.findIndex((g) => g.id === anchorId);
  const b = visible.findIndex((g) => g.id === targetId);
  if (a === -1 || b === -1) {
    next.add(targetId);
    return next;
  }
  const [start, end] = a <= b ? [a, b] : [b, a];
  for (let i = start; i <= end; i += 1) {
    next.add(visible[i]!.id);
  }
  return next;
}

/** Select-all / clear-all helpers. */
export function selectAll(visible: readonly GarmentDTO[]): Set<string> {
  return new Set(visible.map((g) => g.id));
}

/** Whether every visible garment is selected. */
export function isAllSelected(
  visible: readonly GarmentDTO[],
  selection: ReadonlySet<string>,
): boolean {
  return visible.length > 0 && visible.every((g) => selection.has(g.id));
}

/**
 * Which bulk actions are valid for the current selection. Archive is offered
 * when at least one non-archived garment is selected; restore when at least one
 * archived garment is selected. Delete/tag are always available for a non-empty
 * selection.
 */
export function availableBulkActions(selected: readonly GarmentDTO[]): readonly BulkAction[] {
  if (selected.length === 0) {
    return [];
  }
  const actions: BulkAction[] = ['delete', 'tag'];
  if (selected.some((g) => g.status !== 'archived')) {
    actions.unshift('archive');
  }
  if (selected.some((g) => g.status === 'archived')) {
    actions.unshift('restore');
  }
  return actions;
}

/** Resolve the garment DTOs for a selection set, preserving list order. */
export function resolveSelected(
  garments: readonly GarmentDTO[],
  selection: ReadonlySet<string>,
): GarmentDTO[] {
  return garments.filter((g) => selection.has(g.id));
}

/** Sort garments for the management screen. `addedOrder` is the insertion index. */
export function sortForManagement(
  garments: readonly GarmentDTO[],
  sort: ManagementSort,
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
    case 'category':
      return copy.sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      );
    case 'recently-added':
      // DTOs preserve insertion order; "recently added" reverses it.
      return copy.reverse();
    default:
      return copy;
  }
}

/** A small visual badge descriptor for a garment status indicator. */
export interface StatusIndicator {
  readonly label: string;
  readonly tone: 'positive' | 'warning' | 'danger' | 'neutral';
}

/** Map a garment status to its visual indicator (Module 7 status badges). */
export function statusIndicator(status: GarmentStatusDTO): StatusIndicator {
  switch (status) {
    case 'available':
      return { label: 'Available', tone: 'positive' };
    case 'in-laundry':
      return { label: 'In laundry', tone: 'warning' };
    case 'damaged':
      return { label: 'Damaged', tone: 'danger' };
    case 'archived':
      return { label: 'Archived', tone: 'neutral' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}
