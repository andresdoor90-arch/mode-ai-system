import { describe, expect, it } from 'vitest';

import { defineFactory } from './index';

interface Sample {
  id: string;
  label: string;
}

describe('defineFactory', () => {
  const build = defineFactory<Sample>(() => ({ id: 'default', label: 'default-label' }));

  it('produces defaults when no overrides are given', () => {
    expect(build()).toEqual({ id: 'default', label: 'default-label' });
  });

  it('applies overrides over defaults', () => {
    expect(build({ label: 'custom' })).toEqual({ id: 'default', label: 'custom' });
  });
});
