import { describe, expect, it } from 'vitest';

import { OllamaClient, type OllamaFetch, type OllamaHttpResponse } from './OllamaClient';
import { buildPlannerMessages, LlmOutfitPlanner, parsePlannerResponse } from './LlmOutfitPlanner';
import type { PlannerContext, PlannerGarment } from '@mas/core';

const response = (ok: boolean, status: number, json: unknown): OllamaHttpResponse => ({
  ok,
  status,
  json: async () => json,
  text: async () => JSON.stringify(json),
});

const fakeFetch = (
  handler: (url: string) => OllamaHttpResponse,
): { fetchImpl: OllamaFetch; calls: string[] } => {
  const calls: string[] = [];
  const fetchImpl: OllamaFetch = async (url) => {
    calls.push(url);
    return handler(url);
  };
  return { fetchImpl, calls };
};

const CONTEXT: PlannerContext = {
  message: 'reunión importante por la mañana',
  occasion: 'business',
  season: 'all-season',
  targetFormality: 7,
};

const CATALOG: readonly PlannerGarment[] = [
  {
    id: 'g1',
    name: 'Camisa Oxford',
    category: 'tops',
    subcategory: 'shirt',
    colorName: 'azul',
    colorHex: '#23527a',
    formality: 7,
    layerSlot: 'upper-body',
    seasons: ['all-season'],
  },
  {
    id: 'g2',
    name: 'Pantalón de vestir',
    category: 'bottoms',
    subcategory: 'trousers',
    colorName: 'negro',
    colorHex: '#1a1a1a',
    formality: 8,
    layerSlot: 'lower-body',
    seasons: ['all-season'],
  },
];

describe('parsePlannerResponse', () => {
  it('parses an outfits wrapper with garment ids and explanation', () => {
    const outfits = parsePlannerResponse(
      JSON.stringify({
        outfits: [
          {
            kind: 'principal',
            garmentIds: ['g1', 'g2'],
            explicacion: 'Camisa azul con pantalón negro: elegante y sobrio.',
          },
        ],
      }),
    );
    expect(outfits).toHaveLength(1);
    expect(outfits[0]?.kind).toBe('principal');
    expect(outfits[0]?.garmentIds).toEqual(['g1', 'g2']);
    expect(outfits[0]?.explanation).toContain('elegante');
  });

  it('tolerates a bare array, Spanish keys and code fences', () => {
    const outfits = parsePlannerResponse(
      '```json\n[{"tipo":"mas-comoda","prendas":["g1"],"motivo":"cómodo"}]\n```',
    );
    expect(outfits).toHaveLength(1);
    expect(outfits[0]?.kind).toBe('mas-comoda');
    expect(outfits[0]?.garmentIds).toEqual(['g1']);
    expect(outfits[0]?.explanation).toBe('cómodo');
  });

  it('drops outfits with no garment ids and survives garbage', () => {
    expect(parsePlannerResponse(JSON.stringify({ outfits: [{ kind: 'principal' }] }))).toEqual([]);
    expect(parsePlannerResponse('no soy json')).toEqual([]);
    expect(parsePlannerResponse('')).toEqual([]);
  });
});

describe('buildPlannerMessages', () => {
  it('embeds the wardrobe ids, the context and the three roles', () => {
    const [system, user] = buildPlannerMessages(CONTEXT, CATALOG);
    expect(system?.role).toBe('system');
    expect(user?.content).toContain('g1');
    expect(user?.content).toContain('g2');
    expect(user?.content).toContain('reunión importante');
    expect(user?.content).toContain('principal');
    expect(user?.content).toContain('mas-elegante');
    expect(user?.content).toContain('mas-comoda');
  });

  it('is text-only (no images) when no garment has a photo', () => {
    const [, user] = buildPlannerMessages(CONTEXT, CATALOG);
    expect(user?.images).toBeUndefined();
  });

  it('builds a MULTIMODAL request: thumbnails attached in the numbered order', () => {
    const withPhoto: PlannerGarment[] = [
      { ...CATALOG[0]!, imageBase64: 'IMG_G1' },
      { ...CATALOG[1]! }, // no photo → listed as text, still selectable
    ];
    const [, user] = buildPlannerMessages(CONTEXT, withPhoto);
    // The image bytes ride on the user turn, in catalog order.
    expect(user?.images).toEqual(['IMG_G1']);
    // The text maps image #1 to g1 and lists the photo-less g2 separately.
    expect(user?.content).toContain('CON FOTO');
    expect(user?.content).toContain('1. g1');
    expect(user?.content).toContain('sin foto');
    expect(user?.content).toContain('g2');
    expect(user?.content).toContain('Fíjate en las FOTOS');
  });
});

describe('LlmOutfitPlanner', () => {
  it('is available when a tag-tolerant model match is installed', async () => {
    const { fetchImpl } = fakeFetch(() =>
      response(true, 200, { models: [{ name: 'qwen2.5vl:latest' }] }),
    );
    const planner = new LlmOutfitPlanner({
      client: new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl }),
      model: 'qwen2.5vl:7b',
    });
    expect(await planner.isAvailable()).toBe(true);
  });

  it('is unavailable when no matching model is installed', async () => {
    const { fetchImpl } = fakeFetch(() => response(true, 200, { models: [{ name: 'llama3.1' }] }));
    const planner = new LlmOutfitPlanner({
      client: new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl }),
      model: 'qwen2.5vl:7b',
    });
    expect(await planner.isAvailable()).toBe(false);
  });

  it('returns an empty plan without calling the model for an empty catalog', async () => {
    const { fetchImpl, calls } = fakeFetch(() => response(true, 200, {}));
    const planner = new LlmOutfitPlanner({
      client: new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl }),
      model: 'qwen2.5vl:7b',
    });
    expect(await planner.plan(CONTEXT, [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('asks the model and parses its chosen outfits', async () => {
    const { fetchImpl } = fakeFetch((url) =>
      url.endsWith('/api/chat')
        ? response(true, 200, {
            model: 'qwen2.5vl:7b',
            message: {
              content: JSON.stringify({
                outfits: [{ kind: 'principal', garmentIds: ['g1', 'g2'], explicacion: 'listo' }],
              }),
            },
          })
        : response(true, 200, { models: [{ name: 'qwen2.5vl:7b' }] }),
    );
    const planner = new LlmOutfitPlanner({
      client: new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl }),
      model: 'qwen2.5vl:7b',
    });
    const outfits = await planner.plan(CONTEXT, CATALOG);
    expect(outfits).toHaveLength(1);
    expect(outfits[0]?.garmentIds).toEqual(['g1', 'g2']);
    expect(outfits[0]?.explanation).toBe('listo');
  });
});
