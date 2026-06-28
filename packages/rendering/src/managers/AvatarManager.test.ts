import { describe, it, expect } from 'vitest';

import { AvatarManager } from './AvatarManager';

describe('AvatarManager', () => {
  it('produces a default standing neutral mannequin descriptor', () => {
    const am = new AvatarManager();
    const d = am.describe();
    expect(d.modelId).toBe('mannequin-v1');
    expect(d.bodyType).toBe('neutral');
    expect(d.pose).toBe('standing');
    expect(d.meshKey).toBe('mesh:avatar/mannequin-v1/neutral');
    expect(d.attachmentPoints.length).toBeGreaterThan(0);
  });

  it('switches body type and reflects it in the mesh key', () => {
    const am = new AvatarManager();
    am.setBodyType('athletic');
    expect(am.describe().meshKey).toBe('mesh:avatar/mannequin-v1/athletic');
  });

  it('ignores an unknown base model (keeps the current one)', () => {
    const am = new AvatarManager();
    am.setBaseModel('not-a-model');
    expect(am.currentModelId).toBe('mannequin-v1');
  });

  it('changes pose and skin tone without business logic', () => {
    const am = new AvatarManager();
    am.setPose('t-pose').setSkinTone('#000000');
    const d = am.describe();
    expect(d.pose).toBe('t-pose');
    expect(d.skinTone.hex).toBe('#000000');
  });

  it('produces a signature that changes with identity but is stable otherwise', () => {
    const am = new AvatarManager();
    const s1 = am.signature();
    const s2 = am.signature();
    expect(s1).toBe(s2);
    am.setBodyType('plus');
    expect(am.signature()).not.toBe(s1);
  });

  it('exposes a chest-height focus point that scales', () => {
    const am = new AvatarManager(undefined, { scale: 2 });
    expect(am.focusPoint().y).toBeCloseTo(2.2, 5);
  });
});
