import { describe, it, expect } from 'vitest';

import { GarmentLayerSlot } from '../abstraction/slots';
import { casualOutfit, dressOutfit } from '../__fixtures__/garments';
import { SceneManager, EMPTY_OUTFIT } from './SceneManager';

describe('SceneManager', () => {
  it('builds an empty placeholder scene before any recommendation', () => {
    const sm = new SceneManager();
    const scene = sm.buildScene();
    expect(scene.outfitId).toBe(EMPTY_OUTFIT.id);
    expect(scene.layers).toHaveLength(0);
    expect(scene.avatar.meshKey).toContain('mannequin-v1');
    expect(scene.lights.length).toBeGreaterThan(0);
  });

  it('dresses the avatar when an outfit is set (visualise recommendation)', () => {
    const sm = new SceneManager();
    const scene = sm.setOutfit(casualOutfit);
    expect(scene.outfitId).toBe('principal');
    expect(scene.layers.length).toBe(4);
    expect(scene.outfitLabel).toBe('Principal');
  });

  it('swaps garments automatically when the recommendation changes', () => {
    const sm = new SceneManager();
    sm.setOutfit(casualOutfit);
    const next = sm.setOutfit(dressOutfit);
    expect(next.outfitId).toBe('mas-elegante');
    expect(next.layers.some((l) => l.slot === GarmentLayerSlot.FullBody)).toBe(true);
    expect(next.cacheKey).not.toBe(sm.renderCache.keys()[0]);
  });

  it('keeps the SAME avatar identity across recommendations (consistency)', () => {
    const sm = new SceneManager();
    const a = sm.setOutfit(casualOutfit).avatar;
    const b = sm.setOutfit(dressOutfit).avatar;
    expect(b.modelId).toBe(a.modelId);
    expect(b.bodyType).toBe(a.bodyType);
    expect(b.meshKey).toBe(a.meshKey);
  });

  it('serves a cached scene for an already-seen outfit', () => {
    const sm = new SceneManager();
    const first = sm.setOutfit(casualOutfit);
    sm.setOutfit(dressOutfit);
    const again = sm.setOutfit(casualOutfit);
    expect(again.cacheKey).toBe(first.cacheKey);
    // same dressed layers reused
    expect(again.layers.map((l) => l.garmentId)).toEqual(
      first.layers.map((l) => l.garmentId),
    );
  });

  it('rotates 360 and updates the camera without losing the outfit', () => {
    const sm = new SceneManager();
    sm.setOutfit(casualOutfit);
    const scene = sm.rotate(90);
    expect(scene.camera.azimuthDeg).toBe(90);
    expect(scene.layers.length).toBe(4);
  });

  it('zooms and applies view presets', () => {
    const sm = new SceneManager();
    sm.setOutfit(casualOutfit);
    const front = sm.applyView('front').camera;
    const back = sm.applyView('back').camera;
    expect(front.azimuthDeg).toBe(0);
    expect(back.azimuthDeg).toBe(180);
    const zoomed = sm.zoom(0.5).camera;
    expect(zoomed.distance).toBeLessThan(back.distance);
    expect(sm.currentView).toBe('back');
  });

  it('reflects an avatar model/body-type swap in subsequent scenes', () => {
    const sm = new SceneManager();
    sm.setOutfit(casualOutfit);
    const scene = sm.setBodyType('athletic');
    expect(scene.avatar.bodyType).toBe('athletic');
    expect(scene.avatar.meshKey).toContain('athletic');
  });

  it('rebuilds (different cache key) when lighting changes', () => {
    const sm = new SceneManager();
    const studio = sm.setOutfit(casualOutfit);
    const dramatic = sm.setLighting('dramatic');
    expect(dramatic.cacheKey).not.toBe(studio.cacheKey);
    expect(dramatic.lights.some((l) => l.type === 'point')).toBe(true);
  });
});
