/**
 * Lighting Manager.
 *
 * Produces engine-agnostic {@link LightDescriptor} sets for a few named studio
 * presets. Pure data — the engine adapter instantiates real lights from these
 * descriptors. No business rules, no engine import.
 */
import { colorFromHex } from '../abstraction/color';
import { vec3 } from '../abstraction/math';
import { type LightDescriptor, type LightingPreset } from '../abstraction/types';

export class LightingManager {
  private preset: LightingPreset;

  public constructor(preset: LightingPreset = 'studio') {
    this.preset = preset;
  }

  public setPreset(preset: LightingPreset): this {
    this.preset = preset;
    return this;
  }

  public get currentPreset(): LightingPreset {
    return this.preset;
  }

  /** Build the list of lights for the current preset. */
  public describe(): readonly LightDescriptor[] {
    switch (this.preset) {
      case 'soft':
        return this.softSetup();
      case 'dramatic':
        return this.dramaticSetup();
      case 'studio':
      default:
        return this.studioSetup();
    }
  }

  private studioSetup(): readonly LightDescriptor[] {
    return [
      {
        id: 'ambient',
        type: 'ambient',
        intensity: 0.4,
        color: colorFromHex('#ffffff'),
      },
      {
        id: 'key',
        type: 'directional',
        intensity: 1.1,
        color: colorFromHex('#fff4e6'),
        position: vec3(3, 4, 5),
        castShadow: true,
      },
      {
        id: 'fill',
        type: 'directional',
        intensity: 0.5,
        color: colorFromHex('#e6f0ff'),
        position: vec3(-4, 2, 3),
        castShadow: false,
      },
      {
        id: 'rim',
        type: 'directional',
        intensity: 0.7,
        color: colorFromHex('#ffffff'),
        position: vec3(0, 3, -5),
        castShadow: false,
      },
    ];
  }

  private softSetup(): readonly LightDescriptor[] {
    return [
      {
        id: 'hemisphere',
        type: 'hemisphere',
        intensity: 0.9,
        color: colorFromHex('#ffffff'),
        position: vec3(0, 6, 0),
      },
      {
        id: 'key',
        type: 'directional',
        intensity: 0.6,
        color: colorFromHex('#fff8f0'),
        position: vec3(2, 4, 4),
        castShadow: true,
      },
    ];
  }

  private dramaticSetup(): readonly LightDescriptor[] {
    return [
      {
        id: 'ambient',
        type: 'ambient',
        intensity: 0.12,
        color: colorFromHex('#20242e'),
      },
      {
        id: 'key',
        type: 'point',
        intensity: 1.6,
        color: colorFromHex('#ffffff'),
        position: vec3(4, 5, 3),
        castShadow: true,
      },
      {
        id: 'rim',
        type: 'directional',
        intensity: 0.9,
        color: colorFromHex('#6ea8ff'),
        position: vec3(-3, 2, -4),
        castShadow: false,
      },
    ];
  }
}
