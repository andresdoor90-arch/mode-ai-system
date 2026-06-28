import { describe, it, expect } from 'vitest';

import { AssetManager, DEFAULT_MANIFEST, type AssetManifest } from './AssetManager';

describe('AssetManager', () => {
  it('resolves the avatar mesh for known body types', () => {
    const am = new AssetManager();
    expect(am.resolveAvatarMesh('mannequin-v1', 'feminine')).toBe(
      'mesh:avatar/mannequin-v1/feminine',
    );
  });

  it('falls back to the default mesh for an unknown model', () => {
    const am = new AssetManager();
    expect(am.resolveAvatarMesh('does-not-exist', 'neutral')).toBe(
      'mesh:avatar/mannequin-v1/neutral',
    );
  });

  it('resolves garment meshes by category', () => {
    const am = new AssetManager();
    expect(am.resolveGarmentMesh('tops', 'shirt')).toBe('mesh:garment/tops');
    expect(am.resolveGarmentMesh('shoes', 'sneakers')).toBe('mesh:garment/shoes');
  });

  it('prefers accessory-specific meshes by subcategory', () => {
    const am = new AssetManager();
    expect(am.resolveGarmentMesh('accessories', 'hat')).toBe('mesh:accessory/hat');
    // unknown accessory subcategory → category mesh
    expect(am.resolveGarmentMesh('accessories', 'monocle')).toBe('mesh:garment/accessories');
  });

  it('uses the fallback mesh for unknown categories', () => {
    const am = new AssetManager();
    expect(am.resolveGarmentMesh('armor', 'plate')).toBe('mesh:garment/generic');
  });

  it('lists avatar models and reports membership', () => {
    const am = new AssetManager();
    expect(am.listAvatarModels().length).toBeGreaterThan(0);
    expect(am.hasAvatarModel('mannequin-v1')).toBe(true);
    expect(am.hasAvatarModel('nope')).toBe(false);
  });

  it('accepts a custom manifest (model swap extension point)', () => {
    const manifest: AssetManifest = {
      ...DEFAULT_MANIFEST,
      avatars: [
        {
          modelId: 'hero-v2',
          label: 'Hero',
          defaultMeshKey: 'mesh:avatar/hero-v2/default',
          meshKeysByBodyType: { athletic: 'mesh:avatar/hero-v2/athletic' },
        },
      ],
    };
    const am = new AssetManager(manifest);
    expect(am.hasAvatarModel('hero-v2')).toBe(true);
    expect(am.resolveAvatarMesh('hero-v2', 'athletic')).toBe('mesh:avatar/hero-v2/athletic');
    // body type missing in custom manifest → default mesh
    expect(am.resolveAvatarMesh('hero-v2', 'plus')).toBe('mesh:avatar/hero-v2/default');
  });
});
