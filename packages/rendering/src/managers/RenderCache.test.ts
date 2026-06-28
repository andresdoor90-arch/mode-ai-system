import { describe, it, expect } from 'vitest';

import { type SceneDescription } from '../abstraction/types';
import { colorFromHex } from '../abstraction/color';
import { vec3 } from '../abstraction/math';
import { casualOutfit, dressOutfit, shirt, jeans } from '../__fixtures__/garments';
import { RenderCache, buildCacheKey } from './RenderCache';

const fakeScene = (outfitId: string, key: string): SceneDescription => ({
  outfitId,
  avatar: {
    modelId: 'mannequin-v1',
    bodyType: 'neutral',
    pose: 'standing',
    skinTone: colorFromHex('#c79a78'),
    scale: 1,
    meshKey: 'mesh:avatar/mannequin-v1/neutral',
    attachmentPoints: [],
  },
  layers: [],
  camera: {
    azimuthDeg: 0,
    polarDeg: 0,
    distance: 4,
    target: vec3(0, 1, 0),
    fovDeg: 45,
    position: vec3(0, 1, 4),
  },
  lights: [],
  background: colorFromHex('#ffffff'),
  cacheKey: key,
});

describe('buildCacheKey', () => {
  it('is independent of garment order (consistent representation)', () => {
    const a = buildCacheKey({
      avatarSignature: 'av',
      outfit: { id: 'o', garments: [shirt, jeans] },
      view: 'front',
      lightingPreset: 'studio',
    });
    const b = buildCacheKey({
      avatarSignature: 'av',
      outfit: { id: 'o', garments: [jeans, shirt] },
      view: 'front',
      lightingPreset: 'studio',
    });
    expect(a).toBe(b);
  });

  it('changes when the outfit (recommendation) changes', () => {
    const base = {
      avatarSignature: 'av',
      view: 'front' as const,
      lightingPreset: 'studio',
    };
    const a = buildCacheKey({ ...base, outfit: casualOutfit });
    const b = buildCacheKey({ ...base, outfit: dressOutfit });
    expect(a).not.toBe(b);
  });

  it('changes when the view preset changes', () => {
    const a = buildCacheKey({
      avatarSignature: 'av',
      outfit: casualOutfit,
      view: 'front',
      lightingPreset: 'studio',
    });
    const b = buildCacheKey({
      avatarSignature: 'av',
      outfit: casualOutfit,
      view: 'back',
      lightingPreset: 'studio',
    });
    expect(a).not.toBe(b);
  });
});

describe('RenderCache', () => {
  it('stores and retrieves scenes', () => {
    const cache = new RenderCache();
    cache.set('k1', fakeScene('o1', 'k1'));
    expect(cache.has('k1')).toBe(true);
    expect(cache.get('k1')?.outfitId).toBe('o1');
  });

  it('evicts the least-recently-used entry beyond the bound', () => {
    const cache = new RenderCache({ maxEntries: 2 });
    cache.set('k1', fakeScene('o1', 'k1'));
    cache.set('k2', fakeScene('o2', 'k2'));
    cache.get('k1'); // touch k1 so k2 becomes LRU
    cache.set('k3', fakeScene('o3', 'k3'));
    expect(cache.has('k2')).toBe(false);
    expect(cache.has('k1')).toBe(true);
    expect(cache.has('k3')).toBe(true);
  });

  it('invalidates all scenes for an outfit (on recommendation change)', () => {
    const cache = new RenderCache();
    cache.set('o1-front', fakeScene('o1', 'o1-front'));
    cache.set('o1-back', fakeScene('o1', 'o1-back'));
    cache.set('o2-front', fakeScene('o2', 'o2-front'));
    const removed = cache.invalidateOutfit('o1');
    expect(removed).toBe(2);
    expect(cache.size).toBe(1);
    expect(cache.has('o2-front')).toBe(true);
  });

  it('clears everything', () => {
    const cache = new RenderCache();
    cache.set('k1', fakeScene('o1', 'k1'));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
