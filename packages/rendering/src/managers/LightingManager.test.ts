import { describe, it, expect } from 'vitest';

import { LightingManager } from './LightingManager';

describe('LightingManager', () => {
  it('defaults to a studio three/four-point setup with an ambient', () => {
    const lm = new LightingManager();
    const lights = lm.describe();
    expect(lm.currentPreset).toBe('studio');
    expect(lights.some((l) => l.type === 'ambient')).toBe(true);
    expect(lights.some((l) => l.id === 'key')).toBe(true);
    expect(lights.length).toBeGreaterThanOrEqual(3);
  });

  it('switches to the soft preset (hemisphere based)', () => {
    const lm = new LightingManager();
    lm.setPreset('soft');
    const lights = lm.describe();
    expect(lights.some((l) => l.type === 'hemisphere')).toBe(true);
  });

  it('switches to the dramatic preset (low ambient, point key)', () => {
    const lm = new LightingManager();
    lm.setPreset('dramatic');
    const lights = lm.describe();
    const ambient = lights.find((l) => l.type === 'ambient');
    expect(ambient?.intensity ?? 1).toBeLessThan(0.2);
    expect(lights.some((l) => l.type === 'point')).toBe(true);
  });

  it('emits at least one shadow-casting key light per preset', () => {
    for (const preset of ['studio', 'soft', 'dramatic'] as const) {
      const lm = new LightingManager(preset);
      expect(lm.describe().some((l) => l.castShadow === true)).toBe(true);
    }
  });
});
