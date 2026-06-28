import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME, CORE_VERSION } from './index';

describe('@mas/core scaffold', () => {
  it('exposes the package name', () => {
    expect(CORE_PACKAGE_NAME).toBe('@mas/core');
  });

  it('exposes a semantic version', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
