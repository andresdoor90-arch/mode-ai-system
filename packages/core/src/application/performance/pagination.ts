/**
 * Pagination & list-virtualization logic (Module 8).
 *
 * Pure, offline-testable maths supporting libraries of 10,000+ garments: page
 * slicing for lazy loading and a windowing calculation a virtualized list/grid
 * uses to render only the rows currently on screen (plus a small overscan).
 */

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/** Slice an array into a 1-based page. Out-of-range pages clamp to valid bounds. */
export const paginate = <T>(items: readonly T[], page: number, pageSize: number): Page<T> => {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageSize: size,
    total,
    totalPages,
    hasNext: current < totalPages,
    hasPrevious: current > 1,
  };
};

/** The contiguous range of indices a virtualized list should render. */
export interface VirtualWindow {
  readonly startIndex: number;
  readonly endIndex: number;
  /** Number of items rendered (endIndex - startIndex + 1, or 0 when empty). */
  readonly visibleCount: number;
  /** Pixel offset of the first rendered item (for the top spacer). */
  readonly offsetTop: number;
  /** Total scrollable height (itemHeight * total). */
  readonly totalHeight: number;
}

export interface VirtualWindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly itemHeight: number;
  readonly total: number;
  /** Rows to render beyond the visible area on each side. */
  readonly overscan?: number;
  /** Items per row for a grid (1 = a list). */
  readonly columns?: number;
}

/**
 * Compute which rows of a uniformly-sized virtualized list/grid are visible.
 * Works for both lists (`columns = 1`) and grids (`columns > 1`).
 */
export const computeVirtualWindow = (input: VirtualWindowInput): VirtualWindow => {
  const columns = Math.max(1, Math.floor(input.columns ?? 1));
  const itemHeight = Math.max(1, input.itemHeight);
  const overscan = Math.max(0, Math.floor(input.overscan ?? 3));
  const total = Math.max(0, Math.floor(input.total));
  const rowCount = Math.ceil(total / columns);
  const totalHeight = rowCount * itemHeight;

  if (total === 0) {
    return { startIndex: 0, endIndex: -1, visibleCount: 0, offsetTop: 0, totalHeight: 0 };
  }

  const firstVisibleRow = Math.max(0, Math.floor(input.scrollTop / itemHeight) - overscan);
  const visibleRows = Math.ceil(input.viewportHeight / itemHeight) + overscan * 2;
  const lastVisibleRow = Math.min(rowCount - 1, firstVisibleRow + visibleRows);

  const startIndex = firstVisibleRow * columns;
  const endIndex = Math.min(total - 1, (lastVisibleRow + 1) * columns - 1);

  return {
    startIndex,
    endIndex,
    visibleCount: endIndex - startIndex + 1,
    offsetTop: firstVisibleRow * itemHeight,
    totalHeight,
  };
};
