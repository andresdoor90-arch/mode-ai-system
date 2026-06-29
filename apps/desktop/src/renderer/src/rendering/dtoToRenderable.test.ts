import { describe, it, expect } from 'vitest';

import type { GarmentDTO, OutfitRecommendationDTO } from '@shared/ipc';

import { garmentsToRenderable, recommendationToRenderable } from './dtoToRenderable';

const garment = (id: string, category: string, subcategory: string, hex: string): GarmentDTO => ({
  id,
  name: `${id}-name`,
  category,
  subcategory,
  color: { hex, name: 'X', category: 'cool', isNeutral: false },
  brand: null,
  seasons: ['all-season'],
  images: [],
  tags: ['t'],
  status: 'available',
  wearCount: 0,
  lastWornAt: null,
});

describe('recommendationToRenderable', () => {
  it('maps a recommendation DTO to a renderable outfit (kind as id)', () => {
    const rec: OutfitRecommendationDTO = {
      kind: 'mas-elegante',
      label: 'Más elegante',
      score: 91,
      explanation: 'why',
      garments: [garment('g1', 'tops', 'shirt', '#112233')],
    };
    const outfit = recommendationToRenderable(rec);
    expect(outfit.id).toBe('mas-elegante');
    expect(outfit.label).toBe('Más elegante');
    expect(outfit.garments).toHaveLength(1);
    expect(outfit.garments[0]?.colorHex).toBe('#112233');
    // AI-only fields are NOT present on the renderable outfit.
    expect((outfit as unknown as { score?: number }).score).toBeUndefined();
  });
});

describe('garmentsToRenderable', () => {
  it('maps a loose garment list with an explicit id/label', () => {
    const outfit = garmentsToRenderable(
      'saved-1',
      [garment('a', 'shoes', 'sneakers', '#ffffff')],
      'Guardado',
    );
    expect(outfit.id).toBe('saved-1');
    expect(outfit.label).toBe('Guardado');
    expect(outfit.garments[0]?.category).toBe('shoes');
  });
});
