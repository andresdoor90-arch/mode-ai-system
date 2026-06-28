import { describe, expect, it } from 'vitest';

import { InMemoryVectorStore } from '../vector/InMemoryVectorStore';
import { AIProviderError } from '../errors/InfrastructureError';
import { HashingEmbeddingProvider } from './BaseAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

describe('AI provider scaffolding', () => {
  it('OllamaProvider is available when a base URL is set', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    expect(provider.id).toBe('ollama');
    expect(await provider.isAvailable()).toBe(true);
  });

  it('OpenAIProvider exposes its embedding dimension and id', () => {
    const provider = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(provider.id).toBe('openai');
    expect(provider.dimension).toBe(1536);
  });

  it('AnthropicProvider defaults are set', () => {
    const provider = new AnthropicProvider({ apiKey: 'a-test' });
    expect(provider.id).toBe('anthropic');
  });

  it('base adapters throw "not implemented" for model calls', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    await expect(provider.complete([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      AIProviderError,
    );
    await expect(provider.embed(['hi'])).rejects.toBeInstanceOf(AIProviderError);
  });
});

describe('HashingEmbeddingProvider', () => {
  it('produces deterministic, normalised vectors of the right size', async () => {
    const provider = new HashingEmbeddingProvider(16);
    const a = await provider.embed(['red shirt']);
    const b = await provider.embed(['red shirt']);
    expect(a.dimension).toBe(16);
    expect(a.vectors[0]).toHaveLength(16);
    expect(a.vectors[0]).toEqual(b.vectors[0]);
  });

  it('feeds the vector store plumbing end-to-end', async () => {
    const provider = new HashingEmbeddingProvider(32);
    const store = new InMemoryVectorStore(32);
    const { vectors } = await provider.embed(['navy blazer', 'white sneakers']);
    await store.upsert([
      { id: 'g1', vector: vectors[0] ?? [], metadata: { category: 'outerwear' } },
      { id: 'g2', vector: vectors[1] ?? [], metadata: { category: 'shoes' } },
    ]);
    const query = (await provider.embed(['navy blazer'])).vectors[0] ?? [];
    const hits = await store.query(query, { topK: 1 });
    expect(hits[0]?.id).toBe('g1');
  });
});
