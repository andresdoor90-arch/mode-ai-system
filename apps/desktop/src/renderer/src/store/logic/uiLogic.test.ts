import { describe, it, expect } from 'vitest';

import { addToast, dismissToast, toggle, TOAST_LIMIT, type Toast } from './uiLogic';

describe('addToast', () => {
  it('appends a toast with a default variant', () => {
    const result = addToast([], { title: 'Saved' }, 't1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 't1', title: 'Saved', variant: 'default' });
  });

  it('preserves description and explicit variant', () => {
    const result = addToast(
      [],
      { title: 'Oops', description: 'Failed', variant: 'destructive' },
      't2',
    );
    expect(result[0]).toEqual({
      id: 't2',
      title: 'Oops',
      description: 'Failed',
      variant: 'destructive',
    });
  });

  it('caps the queue at TOAST_LIMIT keeping the most recent', () => {
    let toasts: Toast[] = [];
    for (let i = 0; i < TOAST_LIMIT + 3; i += 1) {
      toasts = addToast(toasts, { title: `t${i}` }, `id-${i}`);
    }
    expect(toasts).toHaveLength(TOAST_LIMIT);
    expect(toasts[toasts.length - 1]!.title).toBe(`t${TOAST_LIMIT + 2}`);
  });
});

describe('dismissToast', () => {
  it('removes the matching toast', () => {
    const toasts = addToast(addToast([], { title: 'a' }, 'a'), { title: 'b' }, 'b');
    const result = dismissToast(toasts, 'a');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('b');
  });
});

describe('toggle', () => {
  it('inverts a boolean', () => {
    expect(toggle(true)).toBe(false);
    expect(toggle(false)).toBe(true);
  });
});
