import { describe, expect, it } from 'vitest';

import { ExtensionPointId } from '../contracts/extensionPoints';
import { PLUGIN_MANIFEST_SCHEMA_VERSION, type PluginManifest } from '../contracts/manifest';
import { CompatibilityChecker } from './compatibility';
import { validateManifest } from './manifestValidator';

const goodManifest = (): Record<string, unknown> => ({
  id: 'studio.colorpalette',
  name: 'Color Palette Studio',
  version: '1.2.0',
  manifestSchemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  engines: { mas: '>=0.7.0 <1.0.0', sdk: '^0.7.0' },
  permissions: ['wardrobe:read', 'analyzer:provide'],
  contributes: [ExtensionPointId.Analyzer],
});

describe('manifest validation', () => {
  it('accepts a well-formed manifest and normalises optional fields', () => {
    const result = validateManifest(goodManifest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.id).toBe('studio.colorpalette');
      expect(result.manifest.contributes).toContain(ExtensionPointId.Analyzer);
      expect(result.manifest.engines.sdk).toBe('^0.7.0');
    }
  });

  it('collects every problem at once', () => {
    const result = validateManifest({
      id: 'BAD ID',
      name: '',
      version: 'not-semver',
      manifestSchemaVersion: 99,
      engines: {},
      permissions: ['wardrobe:read', 'totally-made-up'],
      contributes: ['nonexistent-point'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
      expect(result.errors.some((e) => e.includes('totally-made-up'))).toBe(true);
      expect(result.errors.some((e) => e.includes('nonexistent-point'))).toBe(true);
    }
  });

  it('rejects a non-object and a wrong schema version', () => {
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest('nope').ok).toBe(false);
    const wrongSchema = validateManifest({ ...goodManifest(), manifestSchemaVersion: 2 });
    expect(wrongSchema.ok).toBe(false);
  });

  it('requires engines.mas', () => {
    const noMas = validateManifest({ ...goodManifest(), engines: { sdk: '^0.7.0' } });
    expect(noMas.ok).toBe(false);
  });
});

describe('compatibility checking', () => {
  const manifest = (): PluginManifest => {
    const r = validateManifest(goodManifest());
    if (!r.ok) throw new Error('fixture manifest invalid');
    return r.manifest;
  };

  it('accepts a compatible host + sdk', () => {
    const checker = new CompatibilityChecker({ hostVersion: '0.7.3', sdkVersion: '0.7.0' });
    expect(checker.isCompatible(manifest())).toBe(true);
  });

  it('rejects an incompatible host with a reason', () => {
    const checker = new CompatibilityChecker({ hostVersion: '1.1.0', sdkVersion: '0.7.0' });
    const result = checker.check(manifest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons[0]).toContain('M-A-S host');
    }
  });

  it('rejects an incompatible sdk range', () => {
    const checker = new CompatibilityChecker({ hostVersion: '0.7.3', sdkVersion: '0.6.0' });
    expect(checker.isCompatible(manifest())).toBe(false);
  });
});
