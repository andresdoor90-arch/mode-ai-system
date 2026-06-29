import { describe, it, expect } from 'vitest';

import {
  type AvatarDescriptor,
  type ClothingLayer,
  type MaterialDescriptor,
  BodyRegion,
  GarmentLayerSlot,
  colorFromHex,
} from '@mas/rendering';

import { avatarParts, layerPrimitive, materialProps } from './primitives';

const avatar: AvatarDescriptor = {
  modelId: 'mannequin-v1',
  bodyType: 'neutral',
  pose: 'standing',
  skinTone: colorFromHex('#c79a78'),
  scale: 1,
  meshKey: 'mesh:avatar/mannequin-v1/neutral',
  attachmentPoints: [],
};

const material: MaterialDescriptor = {
  color: colorFromHex('#2e5cb8'),
  roughness: 0.8,
  metalness: 0.1,
  opacity: 1,
  finish: 'matte',
};

const layer = (slot: GarmentLayerSlot, region: BodyRegion): ClothingLayer => ({
  garmentId: 'g',
  name: 'g',
  slot,
  region,
  renderOrder: 30,
  material,
  meshKey: 'mesh:garment/tops',
  visible: true,
});

describe('materialProps', () => {
  it('passes through colour/roughness/metalness and opacity', () => {
    const props = materialProps(material);
    expect(props.color).toBe('#2e5cb8');
    expect(props.roughness).toBe(0.8);
    expect(props.metalness).toBe(0.1);
    expect(props.transparent).toBe(false);
    expect(props.opacity).toBe(1);
  });

  it('flags transparency for sheer (opacity < 1) materials', () => {
    const props = materialProps({ ...material, opacity: 0.7 });
    expect(props.transparent).toBe(true);
  });
});

describe('avatarParts', () => {
  it('builds a full set of mannequin body parts', () => {
    const parts = avatarParts(avatar);
    const ids = parts.map((p) => p.id);
    expect(ids).toContain('head');
    expect(ids).toContain('torso');
    expect(ids).toContain('leg-left');
    expect(ids).toContain('arm-right');
    expect(parts.every((p) => p.colorHex === '#c79a78')).toBe(true);
  });

  it('widens the silhouette for the plus body type', () => {
    const neutralTorso = avatarParts(avatar).find((p) => p.id === 'torso');
    const plusTorso = avatarParts({ ...avatar, bodyType: 'plus' }).find((p) => p.id === 'torso');
    expect(plusTorso?.primitive.args[0] ?? 0).toBeGreaterThan(neutralTorso?.primitive.args[0] ?? 0);
  });

  it('scales body part positions with avatar scale', () => {
    const head = avatarParts({ ...avatar, scale: 2 }).find((p) => p.id === 'head');
    expect(head?.primitive.position[1]).toBeCloseTo(3.24, 2);
  });
});

describe('layerPrimitive', () => {
  it('maps torso layers to a capsule over the chest', () => {
    const p = layerPrimitive(layer(GarmentLayerSlot.UpperBody, BodyRegion.Torso));
    expect(p.kind).toBe('capsule');
    expect(p.position[1]).toBeGreaterThan(1);
  });

  it('maps feet to a box near the ground', () => {
    const p = layerPrimitive(layer(GarmentLayerSlot.Feet, BodyRegion.Feet));
    expect(p.kind).toBe('box');
    expect(p.position[1]).toBeLessThan(0.2);
  });

  it('maps a full-body dress to a tall cylinder', () => {
    const p = layerPrimitive(layer(GarmentLayerSlot.FullBody, BodyRegion.FullBody));
    expect(p.kind).toBe('cylinder');
  });

  it('inflates outer layers more than inner layers', () => {
    const outer = layerPrimitive(layer(GarmentLayerSlot.Outer, BodyRegion.Torso));
    const inner = layerPrimitive(layer(GarmentLayerSlot.UpperBody, BodyRegion.Torso));
    expect(outer.args[0]).toBeGreaterThan(inner.args[0]);
  });
});
