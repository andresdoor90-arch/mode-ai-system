import { describe, it, expect } from 'vitest';

import { paginate, computeVirtualWindow } from './pagination';
import { thumbnailCacheKey, LruCache } from './cacheKeys';
import { BackgroundJobQueue } from './BackgroundJobQueue';

describe('pagination', () => {
  const items = Array.from({ length: 10_000 }, (_, i) => i);

  it('slices large libraries into clamped 1-based pages', () => {
    const p = paginate(items, 3, 50);
    expect(p.items[0]).toBe(100);
    expect(p.items).toHaveLength(50);
    expect(p.totalPages).toBe(200);
    expect(p.hasNext).toBe(true);
    expect(p.hasPrevious).toBe(true);
    // out-of-range clamps to last page
    expect(paginate(items, 9999, 50).page).toBe(200);
  });
});

describe('list/grid virtualization window', () => {
  it('renders only the visible rows plus overscan for a list', () => {
    const w = computeVirtualWindow({
      scrollTop: 1000,
      viewportHeight: 500,
      itemHeight: 50,
      total: 10_000,
      overscan: 2,
    });
    // firstRow = floor(1000/50) - 2 = 18 → startIndex 18
    expect(w.startIndex).toBe(18);
    expect(w.offsetTop).toBe(18 * 50);
    expect(w.totalHeight).toBe(10_000 * 50);
    expect(w.visibleCount).toBeLessThan(40); // far fewer than 10k
  });

  it('handles grids (multiple columns) and empty lists', () => {
    const grid = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 300,
      itemHeight: 100,
      total: 100,
      columns: 4,
      overscan: 0,
    });
    expect(grid.startIndex).toBe(0);
    // rows 0..3 are within the window (3 visible + buffer row) → index 15
    expect(grid.endIndex).toBe(15);
    const empty = computeVirtualWindow({ scrollTop: 0, viewportHeight: 300, itemHeight: 100, total: 0 });
    expect(empty.visibleCount).toBe(0);
    expect(empty.endIndex).toBe(-1);
  });
});

describe('thumbnail cache keys + LRU', () => {
  it('derives stable, transform-sensitive keys', () => {
    const a = thumbnailCacheKey({ storageKey: 'img1', width: 128, height: 128 });
    const b = thumbnailCacheKey({ storageKey: 'img1', width: 128, height: 128, rotation: 90 });
    expect(a).toContain('thumb:img1:128x128');
    expect(a).not.toBe(b);
    expect(thumbnailCacheKey({ storageKey: 'img1', width: 128, height: 128 })).toBe(a);
  });

  it('evicts the least-recently-used entry beyond capacity', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // touch a → b is now LRU
    cache.set('c', 3); // evicts b
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.size).toBe(2);
  });
});

describe('background job queue', () => {
  it('respects bounded concurrency and drains', async () => {
    let active = 0;
    let maxActive = 0;
    const queue = new BackgroundJobQueue({ concurrency: 2 });
    const make = (id: string) => ({
      id,
      run: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return id;
      },
    });
    const results = await Promise.all([
      queue.enqueue(make('1')),
      queue.enqueue(make('2')),
      queue.enqueue(make('3')),
      queue.enqueue(make('4')),
    ]);
    expect(results).toEqual(['1', '2', '3', '4']);
    expect(maxActive).toBeLessThanOrEqual(2);
    await queue.onIdle();
    expect(queue.statusOf('1')).toBe('completed');
  });

  it('isolates a failing job without breaking the queue', async () => {
    const errors: string[] = [];
    const queue = new BackgroundJobQueue({ concurrency: 1, onError: (id) => errors.push(id) });
    await expect(
      queue.enqueue({ id: 'bad', run: async () => { throw new Error('boom'); } }),
    ).rejects.toThrow('boom');
    const okResult = await queue.enqueue({ id: 'good', run: async () => 42 });
    expect(okResult).toBe(42);
    expect(errors).toContain('bad');
    expect(queue.statusOf('bad')).toBe('failed');
  });
});
