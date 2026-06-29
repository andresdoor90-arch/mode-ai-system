import { describe, expect, it } from 'vitest';

import { type OllamaFetch, type OllamaHttpResponse } from '../OllamaClient';
import { OllamaProvider } from './OllamaProvider';

const response = (ok: boolean, json: unknown): OllamaHttpResponse => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => json,
  text: async () => JSON.stringify(json),
});

const route =
  (map: Record<string, unknown>): OllamaFetch =>
  async (url) => {
    const path = Object.keys(map).find((p) => url.endsWith(p));
    return path === undefined ? response(false, {}) : response(true, map[path]);
  };

describe('OllamaProvider', () => {
  it('completes chat through /api/chat', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      fetchImpl: route({ '/api/chat': { model: 'llama3.1', message: { content: 'Hola' } } }),
    });
    const result = await provider.complete([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('Hola');
    expect(result.model).toBe('llama3.1');
  });

  it('embeds through /api/embeddings and derives the dimension', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      fetchImpl: route({ '/api/embeddings': { embedding: [0.1, 0.2, 0.3, 0.4] } }),
    });
    const result = await provider.embed(['a']);
    expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(result.dimension).toBe(4);
  });

  it('reports availability via the server probe', async () => {
    const up = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      fetchImpl: route({ '/api/tags': { models: [] } }),
    });
    expect(await up.isAvailable()).toBe(true);

    const down = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      fetchImpl: async () => {
        throw new Error('refused');
      },
    });
    expect(await down.isAvailable()).toBe(false);
  });
});
