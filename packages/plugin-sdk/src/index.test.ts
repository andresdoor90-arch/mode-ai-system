import { describe, expect, it } from 'vitest';

import {
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  PLUGIN_SDK_PACKAGE_NAME,
  PLUGIN_SDK_VERSION,
} from './index';

describe('@mas/plugin-sdk scaffold', () => {
  it('exposes the package name', () => {
    expect(PLUGIN_SDK_PACKAGE_NAME).toBe('@mas/plugin-sdk');
  });

  it('exposes a semantic version', () => {
    expect(PLUGIN_SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('pins the manifest schema version', () => {
    expect(PLUGIN_MANIFEST_SCHEMA_VERSION).toBe(1);
  });
});
