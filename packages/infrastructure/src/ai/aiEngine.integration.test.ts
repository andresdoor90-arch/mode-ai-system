import { describe, expect, it } from 'vitest';

import {
  AIOrchestrator,
  AIProviderRouter,
  Color,
  EmbeddingManager,
  Garment,
  GarmentCategory,
  GarmentStatus,
  MemoryEngine,
  Occasion,
  Season,
  TopSubcategory,
  BottomSubcategory,
  ShoeSubcategory,
  OuterwearSubcategory,
  unwrap,
  type CreateGarmentInput,
  type GarmentId,
  type IGarmentRepository,
  type IOutfitRepository,
  type IUserProfileRepository,
  type Outfit,
  type UserProfile,
} from '@mas/core';

import { HashingEmbeddingProvider } from './BaseAIProvider';
import { StaticTextProvider } from './StaticTextProvider';
import { InMemoryVectorStore } from '../vector/InMemoryVectorStore';
import { InMemoryPreferenceMemoryStore } from '../memory/PreferenceMemoryStore';

/* --- minimal in-memory repositories (port-compatible, offline) ------------ */
class MemGarments implements IGarmentRepository {
  private readonly m = new Map<string, Garment>();
  public async save(g: Garment): Promise<void> {
    this.m.set(g.id, g);
  }
  public async findById(id: GarmentId): Promise<Garment | null> {
    return this.m.get(id) ?? null;
  }
  public async findAll(): Promise<readonly Garment[]> {
    return [...this.m.values()];
  }
  public async query(): Promise<readonly Garment[]> {
    return [...this.m.values()];
  }
  public async findByCategory(category: GarmentCategory): Promise<readonly Garment[]> {
    return [...this.m.values()].filter((g) => g.category === category);
  }
  public async delete(id: GarmentId): Promise<void> {
    this.m.delete(id);
  }
  public async count(): Promise<number> {
    return this.m.size;
  }
}
class MemOutfits implements IOutfitRepository {
  public async save(): Promise<void> {}
  public async findById(): Promise<Outfit | null> {
    return null;
  }
  public async findAll(): Promise<readonly Outfit[]> {
    return [];
  }
  public async query(): Promise<readonly Outfit[]> {
    return [];
  }
  public async findByOccasion(): Promise<readonly Outfit[]> {
    return [];
  }
  public async delete(): Promise<void> {}
}
class MemProfiles implements IUserProfileRepository {
  public async save(): Promise<void> {}
  public async findById(): Promise<UserProfile | null> {
    return null;
  }
  public async getCurrent(): Promise<UserProfile | null> {
    return null;
  }
  public async delete(): Promise<void> {}
}

const garment = (
  id: string,
  name: string,
  category: GarmentCategory,
  subcategory: string,
  hex: string,
  colorName: string,
): Garment => {
  const input: CreateGarmentInput = {
    name,
    category,
    subcategory,
    color: unwrap(Color.fromHex(hex, colorName)),
    seasons: [Season.AllSeason],
    status: GarmentStatus.Available,
  };
  return unwrap(Garment.create(id as GarmentId, input));
};

const seedRepo = async (): Promise<MemGarments> => {
  const repo = new MemGarments();
  await repo.save(
    garment('t1', 'Camisa', GarmentCategory.Tops, TopSubcategory.Shirt, '#4d4d4d', 'charcoal'),
  );
  await repo.save(
    garment('t2', 'Camiseta', GarmentCategory.Tops, TopSubcategory.TShirt, '#b3b3b3', 'silver'),
  );
  await repo.save(
    garment(
      'b1',
      'Pantalón',
      GarmentCategory.Bottoms,
      BottomSubcategory.Trousers,
      '#1a1a1a',
      'black',
    ),
  );
  await repo.save(
    garment('b2', 'Vaqueros', GarmentCategory.Bottoms, BottomSubcategory.Jeans, '#2e2e2e', 'onyx'),
  );
  await repo.save(
    garment('s1', 'Zapatos', GarmentCategory.Shoes, ShoeSubcategory.DressShoes, '#1a1a1a', 'black'),
  );
  await repo.save(
    garment(
      's2',
      'Zapatillas',
      GarmentCategory.Shoes,
      ShoeSubcategory.Sneakers,
      '#e6e6e6',
      'white',
    ),
  );
  await repo.save(
    garment(
      'o1',
      'Americana',
      GarmentCategory.Outerwear,
      OuterwearSubcategory.Blazer,
      '#2e2e2e',
      'onyx',
    ),
  );
  return repo;
};

describe('StaticTextProvider', () => {
  it('is always available and rephrases the prompt deterministically', async () => {
    const provider = new StaticTextProvider();
    expect(await provider.isAvailable()).toBe(true);
    const a = await provider.complete([{ role: 'user', content: 'hola mundo' }]);
    const b = await provider.complete([{ role: 'user', content: 'hola mundo' }]);
    expect(a.text).toBe(b.text);
    expect(a.text).toContain('hola mundo');
  });
});

describe('AI engine integration — infrastructure adapters satisfy core ports', () => {
  it('runs the orchestrator OFFLINE (no provider) using domain rules only', async () => {
    const garments = await seedRepo();
    const orchestrator = new AIOrchestrator({
      garments,
      outfits: new MemOutfits(),
      profiles: new MemProfiles(),
      clock: () => '2026-07-02T09:00:00.000Z',
    });
    const set = await orchestrator.recommend({
      message: 'reunión de oficina',
      occasion: Occasion.Business,
    });

    expect(set.degraded).toBe(true);
    expect(set.providerId).toBeNull();
    expect(set.recommendations.length).toBeGreaterThan(0);
    expect(set.recommendations.every((r) => !r.breakdown.disqualified)).toBe(true);
  });

  it('wires HashingEmbeddingProvider + InMemoryVectorStore + StaticTextProvider for enrichment', async () => {
    const garments = await seedRepo();
    const embeddings = new EmbeddingManager(
      new HashingEmbeddingProvider(64),
      new InMemoryVectorStore(64),
    );
    const orchestrator = new AIOrchestrator({
      garments,
      outfits: new MemOutfits(),
      profiles: new MemProfiles(),
      router: new AIProviderRouter([new StaticTextProvider()]),
      embeddings,
      memory: new MemoryEngine(
        new InMemoryPreferenceMemoryStore(),
        () => '2026-07-02T00:00:00.000Z',
      ),
      clock: () => '2026-07-02T09:00:00.000Z',
    });

    const set = await orchestrator.recommend({
      message: 'algo para la oficina',
      occasion: Occasion.Business,
    });

    expect(set.degraded).toBe(false);
    expect(set.providerId).toBe('static-local');
    expect(set.recommendations.map((r) => r.kind)).toContain('principal');
    expect(set.recommendations.every((r) => !r.breakdown.disqualified)).toBe(true);
    // The static provider rephrases the explanation.
    expect(set.recommendations.some((r) => r.explanation.includes('En resumen:'))).toBe(true);
  });
});
