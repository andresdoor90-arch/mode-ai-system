import { describe, expect, it } from 'vitest';

import { DEPENDS_ON, INFRASTRUCTURE_PACKAGE_NAME, INFRASTRUCTURE_VERSION } from './index';

describe('@mas/infrastructure scaffold', () => {
  it('exposes the package name', () => {
    expect(INFRASTRUCTURE_PACKAGE_NAME).toBe('@mas/infrastructure');
  });

  it('exposes a semantic version', () => {
    expect(INFRASTRUCTURE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is wired to the core package', () => {
    expect(DEPENDS_ON).toBe('@mas/core');
  });
});
