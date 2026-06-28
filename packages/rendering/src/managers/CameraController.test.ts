import { describe, it, expect } from 'vitest';

import { CameraController, PRESET_AZIMUTH } from './CameraController';

describe('CameraController', () => {
  it('starts facing the front at the default distance', () => {
    const c = new CameraController();
    const s = c.describe();
    expect(s.azimuthDeg).toBe(0);
    expect(s.position.z).toBeGreaterThan(0); // in front (+Z)
  });

  it('rotates a full 360 degrees back to the origin', () => {
    const c = new CameraController();
    for (let i = 0; i < 8; i += 1) {
      c.rotateBy(45);
    }
    expect(c.currentAzimuth).toBe(0);
  });

  it('wraps negative rotation', () => {
    const c = new CameraController();
    c.rotateBy(-90);
    expect(c.currentAzimuth).toBe(270);
  });

  it('zooms in and out within clamped bounds', () => {
    const c = new CameraController({ distance: 4, minDistance: 2, maxDistance: 8 });
    c.zoomBy(0.5);
    expect(c.currentDistance).toBe(2); // clamped at min
    c.zoomBy(100);
    expect(c.currentDistance).toBe(8); // clamped at max
  });

  it('ignores non-positive zoom factors', () => {
    const c = new CameraController({ distance: 4 });
    c.zoomBy(0);
    expect(c.currentDistance).toBe(4);
  });

  it('applies view presets by azimuth', () => {
    const c = new CameraController();
    c.applyPreset('back');
    expect(c.currentAzimuth).toBe(PRESET_AZIMUTH.back);
    c.applyPreset('left');
    expect(c.currentAzimuth).toBe(90);
    c.applyPreset('right');
    expect(c.currentAzimuth).toBe(270);
  });

  it('resets to the default front framing', () => {
    const c = new CameraController({ distance: 4, maxDistance: 8 });
    c.rotateBy(123).zoomBy(2).tiltBy(30).reset();
    const s = c.describe();
    expect(s.azimuthDeg).toBe(0);
    expect(s.polarDeg).toBe(0);
    expect(s.distance).toBe(4);
  });

  it('keeps the eye position in sync with the orbit params', () => {
    const c = new CameraController({ distance: 5 });
    c.applyPreset('right'); // azimuth 270 -> eye on the -X side
    const s = c.describe();
    expect(s.position.x).toBeCloseTo(-5, 2);
  });
});
