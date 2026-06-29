import { describe, expect, it } from 'vitest';

import { OllamaClient, type OllamaFetch, type OllamaHttpResponse } from './OllamaClient';

const response = (ok: boolean, status: number, json: unknown): OllamaHttpResponse => ({
  ok,
  status,
  json: async () => json,
  text: async () => JSON.stringify(json),
});

/** A fake fetch that records calls and replies from a queue/handler. */
const fakeFetch = (
  handler: (url: string, init: { method: string; body?: string }) => OllamaHttpResponse,
): { fetchImpl: OllamaFetch; calls: { url: string; method: string; body?: string }[] } => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl: OllamaFetch = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      ...(init.body !== undefined ? { body: init.body } : {}),
    });
    return handler(url, init);
  };
  return { fetchImpl, calls };
};

describe('OllamaClient', () => {
  it('lists installed model names and strips trailing slash from baseUrl', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      response(true, 200, { models: [{ name: 'llava' }, { name: 'llama3.1' }, {}] }),
    );
    const client = new OllamaClient({ baseUrl: 'http://localhost:11434/', fetchImpl });
    expect(await client.listModels()).toEqual(['llava', 'llama3.1']);
    expect(calls[0]?.url).toBe('http://localhost:11434/api/tags');
  });

  it('reports unreachable (never throws) when fetch rejects', async () => {
    const client = new OllamaClient({
      baseUrl: 'http://localhost:11434',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(await client.isReachable()).toBe(false);
    expect(await client.listModels()).toEqual([]);
  });

  it('sends chat with inline images and returns the message content', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      response(true, 200, { model: 'llava', message: { content: '{"garmentType":"shirt"}' } }),
    );
    const client = new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl });
    const result = await client.chat({
      model: 'llava',
      format: 'json',
      messages: [{ role: 'user', content: 'describe', images: ['BASE64DATA'] }],
    });
    expect(result.content).toBe('{"garmentType":"shirt"}');
    const sent = JSON.parse(calls[0]?.body ?? '{}') as {
      stream: boolean;
      format: string;
      messages: { images?: string[] }[];
    };
    expect(sent.stream).toBe(false);
    expect(sent.format).toBe('json');
    expect(sent.messages[0]?.images).toEqual(['BASE64DATA']);
  });

  it('throws on a non-OK chat response so callers can fall back', async () => {
    const { fetchImpl } = fakeFetch(() => response(false, 500, {}));
    const client = new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl });
    await expect(
      client.chat({ model: 'llava', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it('embeds each input via /api/embeddings', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      response(true, 200, { embedding: [0.1, 0.2, 0.3] }),
    );
    const client = new OllamaClient({ baseUrl: 'http://localhost:11434', fetchImpl });
    const vectors = await client.embed('nomic-embed-text', ['a', 'b']);
    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.1, 0.2, 0.3],
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('http://localhost:11434/api/embeddings');
  });
});
