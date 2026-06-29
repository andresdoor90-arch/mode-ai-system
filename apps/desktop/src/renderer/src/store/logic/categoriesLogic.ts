/**
 * Category-management UI logic (pure) — Module 1.
 *
 * Tree building, reorder computation and create-form validation for the dynamic
 * category manager. Pure and framework-free so it is verified offline; the
 * React page and store compose these. No category is hardcoded — everything is
 * derived from the {@link CategoryDTO} data the main process returns.
 */
import type { CategoryDTO, CategoryNodeDTO } from '@shared/ipc';

/** Build a sorted parent → children tree from a flat category list. */
export function buildTree(categories: readonly CategoryDTO[]): CategoryNodeDTO[] {
  const byParent = new Map<string | null, CategoryDTO[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const sort = (list: CategoryDTO[]): CategoryDTO[] =>
    [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return sort(byParent.get(null) ?? []).map((root) => ({
    category: root,
    children: sort(byParent.get(root.id) ?? []),
  }));
}

/** Group top-level categories by their `group` label (for grouped display). */
export function groupRoots(
  categories: readonly CategoryDTO[],
): Record<string, CategoryDTO[]> {
  const groups: Record<string, CategoryDTO[]> = {};
  for (const c of categories) {
    if (c.parentId !== null) {
      continue;
    }
    const key = c.group ?? 'Ungrouped';
    (groups[key] ??= []).push(c);
  }
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => a.order - b.order);
  }
  return groups;
}

/** Move an item within an ordered id list (drag-reorder), returning a new list. */
export function moveInOrder(
  orderedIds: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...orderedIds];
  if (fromIndex < 0 || fromIndex >= next.length) {
    return next;
  }
  const [moved] = next.splice(fromIndex, 1);
  const clampedTo = Math.max(0, Math.min(next.length, toIndex));
  next.splice(clampedTo, 0, moved!);
  return next;
}

export interface CategoryFormErrors {
  readonly name?: string;
}

/** Validate a new/edited category name against the existing siblings. */
export function validateCategoryName(
  name: string,
  siblings: readonly CategoryDTO[],
  editingId?: string,
): CategoryFormErrors {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { name: 'Name is required.' };
  }
  if (trimmed.length > 80) {
    return { name: 'Name must be at most 80 characters.' };
  }
  const clash = siblings.some(
    (c) => c.id !== editingId && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (clash) {
    return { name: 'A category with this name already exists here.' };
  }
  return {};
}

/** Whether a category can be deleted (informational guard for the UI). */
export function canDeleteCategory(
  category: CategoryDTO,
  garmentsInCategory: number,
): { ok: boolean; reason?: string } {
  if (garmentsInCategory > 0) {
    return {
      ok: false,
      reason: `${garmentsInCategory} garment(s) still use "${category.name}". Reassign them first.`,
    };
  }
  return { ok: true };
}
