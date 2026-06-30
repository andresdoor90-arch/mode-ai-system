import { describe, expect, it } from 'vitest';

import { OllamaClient, type OllamaFetch, type OllamaHttpResponse } from './OllamaClient';
import {
  buildGarmentVisionMessages,
  OllamaVisionProvider,
  parseGarmentVisionResponse,
} from './OllamaVisionProvider';

const response = (ok: boolean, status: number, json: unknown): OllamaHttpResponse => ({
  ok,
  status,
  json: async () => json,
  text: async () => JSON.stringify(json),
});

describe('parseGarmentVisionResponse', () => {
  it('maps model JSON to vision-sourced analysis fields', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({
        garmentType: 'Camisa',
        category: 'tops',
        subcategory: 'shirt',
        primaryColor: '1A2B3C',
        primaryColorName: 'Azul oscuro',
        secondaryColors: ['#ffffff', 'nope'],
        material: 'Algodón',
        pattern: 'rayas',
        sleeve: 'Manga larga',
        formality: 7,
        season: 'all-season',
        tags: ['trabajo', '  '],
        suggestedName: 'Camisa azul oscuro manga larga',
      }),
    );
    expect(a.garmentType?.value).toBe('Camisa');
    expect(a.garmentType?.source).toBe('vision');
    expect(a.primaryColor?.value).toBe('#1a2b3c');
    expect(a.secondaryColors?.value).toEqual(['#ffffff']);
    expect(a.formality?.value).toBe(7);
    expect(a.suggestedTags?.value).toEqual(['trabajo']);
    expect(a.suggestedName?.value).toContain('Camisa');
  });

  it('tolerates prose/markdown around the JSON and clamps formality', () => {
    const a = parseGarmentVisionResponse(
      'Aquí tienes:\n```json\n{"garmentType":"Pantalón","formality":99}\n```\nGracias',
    );
    expect(a.garmentType?.value).toBe('Pantalón');
    expect(a.formality?.value).toBe(10);
  });

  it('returns empty for non-JSON or empty output (never fabricates)', () => {
    expect(parseGarmentVisionResponse('no idea')).toEqual({});
    expect(parseGarmentVisionResponse('')).toEqual({});
  });

  it('tolerates Spanish keys, snake_case and a colour given as a name', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({
        tipo: 'Camisa',
        color_principal: 'Azul marino',
        material: 'Algodón',
        manga: 'Manga larga',
        cuello: 'Cuello mao',
        patron: 'Rayas',
        formalidad: '8',
        temporada: 'verano',
        ocasiones: 'iglesia, trabajo',
      }),
    );
    expect(a.garmentType?.value).toBe('Camisa');
    expect(a.category?.value).toBe('tops'); // inferred from "Camisa"
    expect(a.primaryColorName?.value).toBe('Azul marino');
    expect(a.material?.value).toBe('Algodón');
    expect(a.sleeve?.value).toBe('Manga larga');
    expect(a.neckline?.value).toBe('Cuello mao');
    expect(a.pattern?.value).toBe('Rayas');
    expect(a.formality?.value).toBe(8);
    expect(a.season?.value).toBe('summer');
    expect(a.occasions?.value).toEqual(['iglesia', 'trabajo']);
  });

  it('resolves attributes nested one level deep', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({ prenda: { tipo: 'Jean', material: 'Denim' } }),
    );
    expect(a.garmentType?.value).toBe('Jean');
    expect(a.category?.value).toBe('bottoms');
    expect(a.material?.value).toBe('Denim');
  });

  it('resolves attributes nested several levels deep', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({ resultado: { analisis: { prenda: { material: 'Lana', manga: 'corta' } } } }),
    );
    expect(a.material?.value).toBe('Lana');
    expect(a.sleeve?.value).toBe('corta');
  });

  it('parses brand and observations (Spanish keys)', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({
        marca: 'Nike',
        observaciones: 'Tela transpirable, ideal para deporte',
      }),
    );
    expect(a.brand?.value).toBe('Nike');
    expect(a.brand?.source).toBe('vision');
    expect(a.notes?.value).toBe('Tela transpirable, ideal para deporte');
  });

  it('drops "unknown" sentinel values (esp. brand) instead of showing junk', () => {
    const a = parseGarmentVisionResponse(
      JSON.stringify({ marca: 'No visible', material: 'desconocido', sleeve: 'Manga larga' }),
    );
    expect(a.brand).toBeUndefined();
    expect(a.material).toBeUndefined();
    expect(a.sleeve?.value).toBe('Manga larga');
  });

  it('maps category and season synonyms to domain slugs', () => {
    expect(
      parseGarmentVisionResponse(JSON.stringify({ category: 'zapatos' })).category?.value,
    ).toBe('shoes');
    expect(
      parseGarmentVisionResponse(JSON.stringify({ category: 'chaqueta' })).category?.value,
    ).toBe('outerwear');
    expect(parseGarmentVisionResponse(JSON.stringify({ season: 'invierno' })).season?.value).toBe(
      'winter',
    );
  });

  it('omits fields the model did not determine', () => {
    const a = parseGarmentVisionResponse(JSON.stringify({ garmentType: 'Polo' }));
    expect(a.garmentType?.value).toBe('Polo');
    expect(a.material).toBeUndefined();
    expect(a.sleeve).toBeUndefined();
  });
});

describe('buildGarmentVisionMessages', () => {
  it('puts the base64 image on the user message', () => {
    const msgs = buildGarmentVisionMessages('B64');
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[1]?.images).toEqual(['B64']);
  });
});

const fetchReturning =
  (json: unknown, ok = true): OllamaFetch =>
  async () =>
    response(ok, ok ? 200 : 500, json);

describe('OllamaVisionProvider', () => {
  it('is available only when the configured model is installed', async () => {
    const present = new OllamaVisionProvider({
      client: new OllamaClient({
        baseUrl: 'http://x',
        fetchImpl: fetchReturning({ models: [{ name: 'llava:latest' }] }),
      }),
      model: 'llava',
    });
    expect(await present.isAvailable()).toBe(true);

    const absent = new OllamaVisionProvider({
      client: new OllamaClient({
        baseUrl: 'http://x',
        fetchImpl: fetchReturning({ models: [{ name: 'llama3.1' }] }),
      }),
      model: 'llava',
    });
    expect(await absent.isAvailable()).toBe(false);
  });

  it('resolves a tag-tolerant match and uses the installed model name to chat', async () => {
    const calls: string[] = [];
    const fetchImpl: OllamaFetch = async (url, init) => {
      if (url.endsWith('/api/tags')) {
        return response(true, 200, { models: [{ name: 'qwen2.5vl:7b' }] });
      }
      calls.push(JSON.parse(init.body ?? '{}').model as string);
      return response(true, 200, { message: { content: '{"garmentType":"Camisa"}' } });
    };
    // Configured without an explicit tag; the installed ":7b" must be used.
    const provider = new OllamaVisionProvider({
      client: new OllamaClient({ baseUrl: 'http://x', fetchImpl }),
      model: 'qwen2.5vl',
    });
    expect(await provider.isAvailable()).toBe(true);
    const result = await provider.analyze({ image: { base64: 'B64' } });
    expect(result.garmentType?.value).toBe('Camisa');
    expect(calls[0]).toBe('qwen2.5vl:7b');
  });

  it('analyses an image and returns vision fields', async () => {
    const client = new OllamaClient({
      baseUrl: 'http://x',
      fetchImpl: fetchReturning({
        message: { content: '{"garmentType":"Saco","category":"outerwear"}' },
      }),
    });
    const provider = new OllamaVisionProvider({ client, model: 'llava' });
    const result = await provider.analyze({ image: { base64: 'B64', mimeType: 'image/png' } });
    expect(result.garmentType?.value).toBe('Saco');
    expect(result.category?.value).toBe('outerwear');
  });

  it('returns empty (defers to baseline) when there is no image', async () => {
    const client = new OllamaClient({ baseUrl: 'http://x', fetchImpl: fetchReturning({}) });
    const provider = new OllamaVisionProvider({ client, model: 'llava' });
    expect(await provider.analyze({ colorSamples: [] })).toEqual({});
  });

  it('returns empty when the model call fails (no crash, no guess)', async () => {
    const client = new OllamaClient({ baseUrl: 'http://x', fetchImpl: fetchReturning({}, false) });
    const provider = new OllamaVisionProvider({ client, model: 'llava' });
    expect(await provider.analyze({ image: { base64: 'B64' } })).toEqual({});
  });
});
