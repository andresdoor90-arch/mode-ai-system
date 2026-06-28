import { describe, expect, it } from 'vitest';

import { VectorStoreError } from '../errors/InfrastructureError';
import { GARMENT_COLLECTION, buildGarmentVectorMetadata } from './GarmentEmbeddingSchema';
import { InMemoryVectorStore } from './InMemoryVectorStore';
import { cosineSimilarity } from './VectorStore';

describe('cosineSimilarity', () => {
  it('is 1 for identical directions and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('handles degenerate inputs safely', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});

describe('InMemoryVectorStore', () => {
  it('upserts, counts and queries by similarity', async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { id: 'a', vector: [1, 0, 0] },
      { id: 'b', vector: [0, 1, 0] },
      { id: 'c', vector: [0.9, 0.1, 0] },
    ]);
    expect(await store.count()).toBe(3);

    const hits = await store.query([1, 0, 0], { topK: 2 });
    expect(hits.map((h) => h.id)).toEqual(['a', 'c']);
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 1);
  });

  it('applies metadata filters', async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { id: 'top', vector: [1, 0], metadata: { category: 'tops' } },
      { id: 'shoe', vector: [1, 0], metadata: { category: 'shoes' } },
    ]);
    const hits = await store.query([1, 0], { filter: { category: 'shoes' } });
    expect(hits.map((h) => h.id)).toEqual(['shoe']);
  });

  it('replaces a record on re-upsert and deletes by id', async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([{ id: 'a', vector: [1, 0] }]);
    await store.upsert([{ id: 'a', vector: [0, 1] }]);
    expect(await store.count()).toBe(1);
    await store.delete(['a']);
    expect(await store.count()).toBe(0);
  });

  it('enforces a fixed dimension when configured', async () => {
    const store = new InMemoryVectorStore(3);
    await expect(store.upsert([{ id: 'x', vector: [1, 2] }])).rejects.toBeInstanceOf(
      VectorStoreError,
    );
  });
});

describe('GarmentEmbeddingSchema', () => {
  it('describes the garment collection', () => {
    expect(GARMENT_COLLECTION.name).toBe('garment_embeddings');
    expect(GARMENT_COLLECTION.metadataKeys).toContain('category');
  });

  it('builds metadata records', () => {
    const meta = buildGarmentVectorMetadata({
      category: 'tops',
      subcategory: 't-shirt',
      season: 'summer',
      colorCategory: 'cool',
      status: 'available',
    });
    expect(meta.category).toBe('tops');
    expect(meta.status).toBe('available');
  });
});
