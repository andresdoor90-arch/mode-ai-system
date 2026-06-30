import { describe, it, expect } from 'vitest';

import { GarmentCategory } from '../../domain/value-objects/GarmentCategory';
import {
  TopSubcategory,
  BottomSubcategory,
  ShoeSubcategory,
  OuterwearSubcategory,
  DressSubcategory,
} from '../../domain/value-objects/GarmentSubcategory';
import { Occasion } from '../../domain/value-objects/Occasion';
import { Season } from '../../domain/value-objects/Season';
import { unwrap } from '../../shared/Result';
import { EMPTY_PREFERENCE_MEMORY } from './ports';
import { applyFeedback, MemoryEngine } from './MemoryEngine';
import { PreferenceEngine } from './PreferenceEngine';
import { ContextAnalyzer } from './ContextAnalyzer';
import { AIProviderRouter } from './AIProviderRouter';
import { EmbeddingManager } from './EmbeddingManager';
import { OutfitRankingEngine } from './OutfitRankingEngine';
import { AIOrchestrator } from './AIOrchestrator';
import { RecommendOutfitsQuery, RecommendOutfitsHandler } from '../queries/recommendationQueries';

import {
  makeGarment,
  color,
  FakeEmbedder,
  FakeTextProvider,
  ThrowingTextProvider,
  InMemoryVectorIndex,
  InMemoryGarmentRepository,
  InMemoryOutfitRepository,
  InMemoryUserProfileRepository,
  InMemoryPreferenceMemoryStore,
} from '../../__fixtures__/testSupport';
import {
  type IOutfitPlanner,
  type PlannedOutfit,
  type PlannerContext,
  type PlannerGarment,
} from './ports';

/** A fake LLM planner that returns scripted outfits and records what it saw. */
class FakeOutfitPlanner implements IOutfitPlanner {
  public readonly id = 'fake-planner';
  public available = true;
  public lastContext: PlannerContext | null = null;
  public lastCatalog: readonly PlannerGarment[] = [];
  public constructor(private readonly outfits: readonly PlannedOutfit[]) {}
  public async isAvailable(): Promise<boolean> {
    return this.available;
  }
  public async plan(
    context: PlannerContext,
    catalog: readonly PlannerGarment[],
  ): Promise<readonly PlannedOutfit[]> {
    this.lastContext = context;
    this.lastCatalog = catalog;
    return this.outfits;
  }
}

/** A varied, all-neutral wardrobe (no colour clashes) with mixed formality. */
const buildWardrobe = async (): Promise<{
  garments: InMemoryGarmentRepository;
  outfits: InMemoryOutfitRepository;
  profiles: InMemoryUserProfileRepository;
}> => {
  const garments = new InMemoryGarmentRepository();
  const seasons = [Season.AllSeason];
  const items = [
    // Tops
    {
      id: 't-shirt',
      name: 'Camisa Oxford',
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.Shirt,
      color: color('#4d4d4d', 'charcoal'),
      seasons,
    },
    {
      id: 't-tee',
      name: 'Camiseta básica',
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.TShirt,
      color: color('#b3b3b3', 'silver'),
      seasons,
    },
    {
      id: 't-sweater',
      name: 'Jersey de lana',
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.Sweater,
      color: color('#808080', 'gray'),
      seasons,
    },
    // Bottoms
    {
      id: 'b-trousers',
      name: 'Pantalón de vestir',
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Trousers,
      color: color('#1a1a1a', 'black'),
      seasons,
    },
    {
      id: 'b-jeans',
      name: 'Vaqueros',
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Jeans,
      color: color('#2e2e2e', 'onyx'),
      seasons,
    },
    {
      id: 'b-chinos',
      name: 'Chinos',
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Chinos,
      color: color('#808080', 'gray'),
      seasons,
    },
    // Shoes
    {
      id: 's-dress',
      name: 'Zapatos Oxford',
      category: GarmentCategory.Shoes,
      subcategory: ShoeSubcategory.DressShoes,
      color: color('#1a1a1a', 'black'),
      seasons,
    },
    {
      id: 's-sneakers',
      name: 'Zapatillas',
      category: GarmentCategory.Shoes,
      subcategory: ShoeSubcategory.Sneakers,
      color: color('#e6e6e6', 'white'),
      seasons,
    },
    // Outerwear
    {
      id: 'o-blazer',
      name: 'Americana estructurada',
      category: GarmentCategory.Outerwear,
      subcategory: OuterwearSubcategory.Blazer,
      color: color('#2e2e2e', 'onyx'),
      seasons,
    },
    // Dress
    {
      id: 'd-casual',
      name: 'Vestido casual',
      category: GarmentCategory.Dresses,
      subcategory: DressSubcategory.Casual,
      color: color('#4d4d4d', 'charcoal'),
      seasons,
    },
  ];
  for (const item of items) {
    await garments.save(makeGarment(item));
  }
  return {
    garments,
    outfits: new InMemoryOutfitRepository(),
    profiles: new InMemoryUserProfileRepository(),
  };
};

describe('ContextAnalyzer', () => {
  const analyzer = new ContextAnalyzer();

  it('extracts occasion, time of day and cold weather from Spanish text', () => {
    const ctx = unwrap(analyzer.analyze({ message: 'Tengo una boda por la noche y hará frío' }));
    expect(ctx.occasion).toBe(Occasion.Formal);
    expect(ctx.timeOfDay).toBe('evening');
    expect(ctx.weather?.isCold).toBe(true);
    expect(ctx.season).toBe(Season.Winter);
    expect(ctx.enrichedByProvider).toBe(false);
  });

  it('detects sport + comfort/mobility cues', () => {
    const ctx = unwrap(analyzer.analyze({ message: 'voy al gimnasio, quiero algo cómodo' }));
    expect(ctx.occasion).toBe(Occasion.Sport);
    expect(ctx.comfortPriority).toBeGreaterThan(0.8);
    expect(ctx.mobilityNeed).toBeGreaterThan(0.7);
  });

  it('parses an explicit temperature in English', () => {
    const ctx = unwrap(analyzer.analyze({ message: 'office meeting at 20 degrees' }));
    expect(ctx.occasion).toBe(Occasion.Business);
    expect(ctx.weather?.temperatureC).toBe(20);
  });

  it('honours an explicit occasion override', () => {
    const ctx = unwrap(
      analyzer.analyze({ message: 'whatever', occasion: Occasion.Party, season: Season.Summer }),
    );
    expect(ctx.occasion).toBe(Occasion.Party);
    expect(ctx.season).toBe(Season.Summer);
  });
});

describe('AIProviderRouter', () => {
  it('selects the first available provider', async () => {
    const unavailable = new FakeTextProvider('local', false);
    const available = new FakeTextProvider('cloud', true);
    const selection = await new AIProviderRouter([unavailable, available]).select();
    expect(selection.provider?.id).toBe('cloud');
    expect(selection.probed).toEqual(['local', 'cloud']);
  });

  it('falls back to null when no provider is available', async () => {
    const selection = await new AIProviderRouter([new FakeTextProvider('x', false)]).select();
    expect(selection.provider).toBeNull();
  });

  it('treats an empty router as offline', async () => {
    const selection = await new AIProviderRouter().select();
    expect(selection.provider).toBeNull();
  });
});

describe('MemoryEngine + PreferenceEngine', () => {
  it('applyFeedback nudges colour and subcategory affinities', () => {
    const g = makeGarment({
      subcategory: TopSubcategory.TShirt,
      color: color('#b3b3b3', 'silver'),
    });
    const accepted = applyFeedback(EMPTY_PREFERENCE_MEMORY, [g], true, '2026-07-02T00:00:00.000Z');
    expect(accepted.colorAffinity['silver']).toBeGreaterThan(0);
    expect(accepted.subcategoryAffinity['t-shirt']).toBeGreaterThan(0);
    expect(accepted.acceptCount).toBe(1);

    const rejected = applyFeedback(accepted, [g], false, '2026-07-03T00:00:00.000Z');
    expect(rejected.subcategoryAffinity['t-shirt']!).toBeLessThan(
      accepted.subcategoryAffinity['t-shirt']!,
    );
    expect(rejected.rejectCount).toBe(1);
  });

  it('persists through the store and derives preferences', async () => {
    const store = new InMemoryPreferenceMemoryStore();
    const engine = new MemoryEngine(store, () => '2026-07-02T00:00:00.000Z');
    const g = makeGarment({ color: color('#1a1a1a', 'black') });
    await engine.recordAcceptance([g]);
    await engine.recordAcceptance([g]);
    expect(store.saves).toBe(2);

    const snapshot = await new MemoryEngine(store).load();
    expect(snapshot.colorAffinity['black']).toBeGreaterThan(0);

    const derived = new PreferenceEngine().derive(snapshot);
    expect(derived.preferredColors).toContain('black');
  });
});

describe('AIOrchestrator — offline (no provider), 10-step flow', () => {
  it('produces three explained recommendations using domain rules only', async () => {
    const repos = await buildWardrobe();
    const orchestrator = new AIOrchestrator({
      ...repos,
      clock: () => '2026-07-02T09:00:00.000Z',
    });

    const set = await orchestrator.recommend({ message: 'reunión de trabajo en la oficina' });

    expect(set.providerId).toBeNull();
    expect(set.degraded).toBe(true);
    expect(set.context.occasion).toBe(Occasion.Business);
    expect(set.candidatesEvaluated).toBeGreaterThan(0);

    const kinds = set.recommendations.map((r) => r.kind);
    expect(kinds).toEqual(['principal', 'mas-elegante', 'mas-comoda']);

    for (const rec of set.recommendations) {
      expect(rec.garments.length).toBeGreaterThan(0);
      expect(rec.breakdown.disqualified).toBe(false);
      expect(rec.score).toBeGreaterThan(0);
      expect(rec.explanation.length).toBeGreaterThan(0);
      expect(rec.explanation).not.toContain('[IA]'); // no provider enrichment offline
    }

    // The three picks are distinct outfits.
    const signatures = set.recommendations.map((r) =>
      r.garments
        .map((g) => g.id)
        .sort()
        .join('|'),
    );
    expect(new Set(signatures).size).toBe(set.recommendations.length);
  });
});

describe('AIOrchestrator — provider available adds enrichment without altering hard rules', () => {
  it('keeps the same valid candidates while adding semantic boost + NL explanations', async () => {
    const repos = await buildWardrobe();
    const request = { message: 'algo para la oficina', occasion: Occasion.Business } as const;

    const offline = await new AIOrchestrator({
      ...repos,
      clock: () => '2026-07-02T09:00:00.000Z',
    }).recommend(request);

    const provider = new FakeTextProvider('fake-llm', true);
    const withProvider = await new AIOrchestrator({
      ...repos,
      router: new AIProviderRouter([provider]),
      embeddings: new EmbeddingManager(new FakeEmbedder(), new InMemoryVectorIndex()),
      clock: () => '2026-07-02T09:00:00.000Z',
    }).recommend(request);

    // Hard-rule outcomes are unchanged: same number of valid candidates, all valid.
    expect(withProvider.candidatesEvaluated).toBe(offline.candidatesEvaluated);
    expect(withProvider.degraded).toBe(false);
    expect(withProvider.providerId).toBe('fake-llm');
    expect(offline.degraded).toBe(true);

    for (const rec of withProvider.recommendations) {
      expect(rec.breakdown.disqualified).toBe(false);
      expect(rec.explanation).toContain('[IA]'); // provider rephrased the reasoning
    }
    expect(provider.calls).toBeGreaterThan(0);
  });

  it('falls back to the offline template when the provider throws', async () => {
    const repos = await buildWardrobe();
    const set = await new AIOrchestrator({
      ...repos,
      router: new AIProviderRouter([new ThrowingTextProvider()]),
      clock: () => '2026-07-02T09:00:00.000Z',
    }).recommend({ message: 'algo casual' });

    expect(set.providerId).toBe('broken-llm');
    for (const rec of set.recommendations) {
      expect(rec.explanation).not.toContain('[IA]');
      expect(rec.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('AIOrchestrator — persistent memory improves future rankings', () => {
  it('raises the score of an accepted style on the next run', async () => {
    const repos = await buildWardrobe();
    const store = new InMemoryPreferenceMemoryStore();
    const memory = new MemoryEngine(store, () => '2026-07-02T00:00:00.000Z');
    const orchestrator = new AIOrchestrator({
      ...repos,
      memory,
      clock: () => '2026-07-02T09:00:00.000Z',
    });

    const first = await orchestrator.recommend({
      message: 'plan casual',
      occasion: Occasion.Casual,
    });
    const comfyFirst = first.recommendations.find((r) => r.kind === 'mas-comoda');
    expect(comfyFirst).toBeDefined();

    // The user wears/accepts the comfy outfit several times.
    for (let i = 0; i < 5; i += 1) {
      await memory.recordAcceptance(comfyFirst!.garments);
    }
    expect(store.saves).toBeGreaterThan(0);

    const second = await orchestrator.recommend({
      message: 'plan casual',
      occasion: Occasion.Casual,
    });
    const comfySecond = second.recommendations.find(
      (r) =>
        r.garments
          .map((g) => g.id)
          .sort()
          .join('|') ===
        comfyFirst!.garments
          .map((g) => g.id)
          .sort()
          .join('|'),
    );
    expect(comfySecond).toBeDefined();
    expect(comfySecond!.score).toBeGreaterThan(comfyFirst!.score);
  });
});

describe('OutfitRankingEngine', () => {
  it('excludes nothing extra and applies additive affinity bias deterministically', async () => {
    const repos = await buildWardrobe();
    const all = await repos.garments.findAll();
    const top = all.find((g) => g.id === 't-tee')!;
    const bottom = all.find((g) => g.id === 'b-jeans')!;
    const shoe = all.find((g) => g.id === 's-sneakers')!;
    const combo = [top, bottom, shoe];

    const engine = new OutfitRankingEngine();
    const base = engine.rank([combo], Occasion.Casual, Season.AllSeason, {});
    const boosted = engine.rank(
      [combo],
      Occasion.Casual,
      Season.AllSeason,
      {},
      {
        affinityBias: () => 0.5,
      },
    );
    expect(boosted[0]!.finalScore).toBeGreaterThan(base[0]!.finalScore);
    expect(boosted[0]!.baseScore).toBe(base[0]!.baseScore); // domain score unchanged
  });
});

describe('RecommendOutfitsHandler (application bus integration)', () => {
  it('exposes the orchestrator through a query handler', async () => {
    const repos = await buildWardrobe();
    const orchestrator = new AIOrchestrator({ ...repos, clock: () => '2026-07-02T09:00:00.000Z' });
    const handler = new RecommendOutfitsHandler(orchestrator);

    const result = await handler.handle(new RecommendOutfitsQuery({ message: 'cena elegante' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recommendations.length).toBeGreaterThan(0);
      expect(result.value.recommendations[0]!.label).toBe('Principal');
    }
  });
});

describe('AIOrchestrator — LLM outfit planner', () => {
  it('uses the planner picks + explanation, validated against the wardrobe', async () => {
    const { garments, outfits, profiles } = await buildWardrobe();
    const planner = new FakeOutfitPlanner([
      {
        kind: 'principal',
        garmentIds: ['t-shirt', 'b-trousers', 's-dress'],
        explanation: 'Camisa con pantalón de vestir: sobrio y elegante.',
      },
    ]);
    const orchestrator = new AIOrchestrator({ garments, outfits, profiles, planner });

    const set = await orchestrator.recommend({ message: 'tengo una reunión importante' });

    expect(set.providerId).toBe('fake-planner');
    expect(set.degraded).toBe(false);
    expect(set.recommendations).toHaveLength(1);
    const rec = set.recommendations[0];
    expect(rec?.kind).toBe('principal');
    expect([...(rec?.garments ?? [])].map((g) => g.id).sort()).toEqual([
      'b-trousers',
      's-dress',
      't-shirt',
    ]);
    expect(rec?.explanation).toBe('Camisa con pantalón de vestir: sobrio y elegante.');
    // The planner reasoned over a catalog of real wardrobe garments + context.
    expect(planner.lastCatalog.length).toBeGreaterThan(0);
    expect(planner.lastContext?.message).toContain('reunión');
  });

  it('drops hallucinated ids and falls back to the rule engine', async () => {
    const { garments, outfits, profiles } = await buildWardrobe();
    const planner = new FakeOutfitPlanner([
      { kind: 'principal', garmentIds: ['no-existe'], explanation: 'x' },
    ]);
    const orchestrator = new AIOrchestrator({ garments, outfits, profiles, planner });

    const set = await orchestrator.recommend({ message: 'algo casual' });

    expect(set.providerId).not.toBe('fake-planner');
    expect(set.recommendations.length).toBeGreaterThan(0);
  });

  it('falls back to rules when the planner is unavailable', async () => {
    const { garments, outfits, profiles } = await buildWardrobe();
    const planner = new FakeOutfitPlanner([
      { kind: 'principal', garmentIds: ['t-shirt'], explanation: 'x' },
    ]);
    planner.available = false;
    const orchestrator = new AIOrchestrator({ garments, outfits, profiles, planner });

    const set = await orchestrator.recommend({ message: 'algo casual' });

    expect(set.providerId).not.toBe('fake-planner');
    expect(set.recommendations.length).toBeGreaterThan(0);
  });

  it('assigns roles by order when the planner omits/duplicates the kind', async () => {
    const { garments, outfits, profiles } = await buildWardrobe();
    const planner = new FakeOutfitPlanner([
      { kind: '', garmentIds: ['t-shirt', 'b-trousers'], explanation: 'a' },
      { kind: '', garmentIds: ['t-tee', 'b-jeans'], explanation: 'b' },
    ]);
    const orchestrator = new AIOrchestrator({ garments, outfits, profiles, planner });

    const set = await orchestrator.recommend({ message: 'casual' });

    expect(set.recommendations.map((r) => r.kind)).toEqual(['principal', 'mas-elegante']);
  });
});
