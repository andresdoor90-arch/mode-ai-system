/**
 * Pure, in-memory test doubles and builders.
 *
 * These are NOT production code: they implement the repository *ports* purely
 * in memory (no I/O) so the application layer can be exercised in tests without
 * any infrastructure. The directory is excluded from the package build.
 */
import { type GarmentId } from '../shared/Identifier';
import { type IdGenerator } from '../shared/IdGenerator';
import { unwrap } from '../shared/Result';
import {
  Garment,
  GarmentStatus,
  type CreateGarmentInput,
} from '../domain/entities/Garment';
import { type Outfit } from '../domain/entities/Outfit';
import { type UserProfile } from '../domain/entities/UserProfile';
import { type StyleRule } from '../domain/entities/StyleRule';
import { type WardrobeCollection } from '../domain/entities/WardrobeCollection';
import { type CalendarEvent } from '../domain/entities/CalendarEvent';
import { Color } from '../domain/value-objects/Color';
import { GarmentCategory } from '../domain/value-objects/GarmentCategory';
import { TopSubcategory } from '../domain/value-objects/GarmentSubcategory';
import { Occasion } from '../domain/value-objects/Occasion';
import { Season } from '../domain/value-objects/Season';
import {
  type IGarmentRepository,
  type GarmentQuery,
} from '../domain/repositories/IGarmentRepository';
import {
  type IOutfitRepository,
  type OutfitQuery,
} from '../domain/repositories/IOutfitRepository';
import { type IUserProfileRepository } from '../domain/repositories/IUserProfileRepository';
import { type IStyleRuleRepository } from '../domain/repositories/IStyleRuleRepository';
import { type ICollectionRepository } from '../domain/repositories/ICollectionRepository';
import { type ICalendarEventRepository } from '../domain/repositories/ICalendarEventRepository';

/** Convenience: build a {@link Color} from hex, throwing on invalid input. */
export const color = (hex: string, name?: string): Color => unwrap(Color.fromHex(hex, name));

let counter = 0;

/** Build a valid {@link Garment} with sensible defaults for tests. */
export const makeGarment = (overrides: Partial<CreateGarmentInput> & { id?: string } = {}): Garment => {
  counter += 1;
  const id = (overrides.id ?? `g-${counter}`) as GarmentId;
  const input: CreateGarmentInput = {
    name: overrides.name ?? `Garment ${counter}`,
    category: overrides.category ?? GarmentCategory.Tops,
    subcategory: overrides.subcategory ?? TopSubcategory.TShirt,
    color: overrides.color ?? color('#3366cc', 'blue'),
    seasons: overrides.seasons ?? [Season.AllSeason],
    ...(overrides.brand !== undefined ? { brand: overrides.brand } : {}),
    ...(overrides.size !== undefined ? { size: overrides.size } : {}),
    ...(overrides.images !== undefined ? { images: overrides.images } : {}),
    ...(overrides.tags !== undefined ? { tags: overrides.tags } : {}),
    status: overrides.status ?? GarmentStatus.Available,
    ...(overrides.wearCount !== undefined ? { wearCount: overrides.wearCount } : {}),
    ...(overrides.lastWornAt !== undefined ? { lastWornAt: overrides.lastWornAt } : {}),
    ...(overrides.metadata !== undefined ? { metadata: overrides.metadata } : {}),
  };
  return unwrap(Garment.create(id, input));
};

/** A deterministic id generator for tests. */
export class FakeIdGenerator implements IdGenerator {
  private n = 0;
  public constructor(private readonly prefix = 'fake') {}
  public next<TBrand extends string>(): import('../shared/Identifier').Id<TBrand> {
    this.n += 1;
    return `${this.prefix}-${this.n}` as import('../shared/Identifier').Id<TBrand>;
  }
}

export class InMemoryGarmentRepository implements IGarmentRepository {
  private readonly store = new Map<string, Garment>();

  public async save(garment: Garment): Promise<void> {
    this.store.set(garment.id, garment);
  }
  public async findById(id: GarmentId): Promise<Garment | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly Garment[]> {
    return [...this.store.values()];
  }
  public async query(criteria: GarmentQuery): Promise<readonly Garment[]> {
    return [...this.store.values()].filter((g) => {
      if (criteria.category !== undefined && g.category !== criteria.category) return false;
      if (criteria.subcategory !== undefined && g.subcategory !== criteria.subcategory) return false;
      if (criteria.status !== undefined && g.status !== criteria.status) return false;
      if (criteria.season !== undefined && !g.supportsSeason(criteria.season)) return false;
      if (criteria.tags !== undefined && !criteria.tags.every((t) => g.tags.includes(t))) return false;
      return true;
    });
  }
  public async findByCategory(category: GarmentCategory): Promise<readonly Garment[]> {
    return [...this.store.values()].filter((g) => g.category === category);
  }
  public async delete(id: GarmentId): Promise<void> {
    this.store.delete(id);
  }
  public async count(): Promise<number> {
    return this.store.size;
  }
}

export class InMemoryOutfitRepository implements IOutfitRepository {
  private readonly store = new Map<string, Outfit>();

  public async save(outfit: Outfit): Promise<void> {
    this.store.set(outfit.id, outfit);
  }
  public async findById(id: string): Promise<Outfit | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly Outfit[]> {
    return [...this.store.values()];
  }
  public async query(criteria: OutfitQuery): Promise<readonly Outfit[]> {
    return [...this.store.values()].filter((o) => {
      if (criteria.occasion !== undefined && o.occasion !== criteria.occasion) return false;
      if (criteria.season !== undefined && o.season !== criteria.season) return false;
      if (criteria.minRating !== undefined && (o.rating ?? -1) < criteria.minRating) return false;
      return true;
    });
  }
  public async findByOccasion(occasion: Occasion): Promise<readonly Outfit[]> {
    return [...this.store.values()].filter((o) => o.occasion === occasion);
  }
  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryUserProfileRepository implements IUserProfileRepository {
  private readonly store = new Map<string, UserProfile>();
  private currentId: string | undefined;

  public async save(profile: UserProfile): Promise<void> {
    this.store.set(profile.id, profile);
    this.currentId ??= profile.id;
  }
  public async findById(id: string): Promise<UserProfile | null> {
    return this.store.get(id) ?? null;
  }
  public async getCurrent(): Promise<UserProfile | null> {
    return this.currentId !== undefined ? (this.store.get(this.currentId) ?? null) : null;
  }
  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryStyleRuleRepository implements IStyleRuleRepository {
  private readonly store = new Map<string, StyleRule>();

  public async save(rule: StyleRule): Promise<void> {
    this.store.set(rule.id, rule);
  }
  public async findById(id: string): Promise<StyleRule | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly StyleRule[]> {
    return [...this.store.values()];
  }
  public async findEnabledByPriority(): Promise<readonly StyleRule[]> {
    return [...this.store.values()].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
  }
  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryCollectionRepository implements ICollectionRepository {
  private readonly store = new Map<string, WardrobeCollection>();

  public async save(collection: WardrobeCollection): Promise<void> {
    this.store.set(collection.id, collection);
  }
  public async findById(id: string): Promise<WardrobeCollection | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly WardrobeCollection[]> {
    return [...this.store.values()];
  }
  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryCalendarEventRepository implements ICalendarEventRepository {
  private readonly store = new Map<string, CalendarEvent>();

  public async save(event: CalendarEvent): Promise<void> {
    this.store.set(event.id, event);
  }
  public async findById(id: string): Promise<CalendarEvent | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly CalendarEvent[]> {
    return [...this.store.values()];
  }
  public async findBetween(from: string, to: string): Promise<readonly CalendarEvent[]> {
    return [...this.store.values()].filter((e) => e.date >= from && e.date <= to);
  }
  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}



/* -------------------------------------------------------------------------- */
/* AI orchestration test doubles (pure, no infrastructure)                    */
/* -------------------------------------------------------------------------- */

import {
  type EmbeddingVectorResult,
  type IEmbedder,
  type IPreferenceMemoryStore,
  type ITextProvider,
  type IVectorIndex,
  type IndexedVector,
  type OrchestratorChatMessage,
  type PreferenceMemorySnapshot,
  type TextGenerationOptions,
  type TextGenerationResult,
  type VectorHit,
  type VectorSearchOptions,
} from '../application/orchestration/ports';

/**
 * A deterministic, offline text provider for tests. It echoes a marked,
 * provider-flavoured rephrasing of the prompt so assertions can detect that
 * enrichment happened — without any network call. Availability is toggleable to
 * exercise the router's fallback behaviour.
 */
export class FakeTextProvider implements ITextProvider {
  public calls = 0;
  public constructor(
    public readonly id = 'fake-llm',
    private available = true,
  ) {}

  public setAvailable(value: boolean): void {
    this.available = value;
  }

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public async complete(
    messages: readonly OrchestratorChatMessage[],
    _options?: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    this.calls += 1;
    const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    return {
      text: `[IA] ${user}`,
      model: `${this.id}-model`,
      tokensUsed: user.length,
    };
  }
}

/** A text provider whose model call always throws, to test graceful fallback. */
export class ThrowingTextProvider implements ITextProvider {
  public constructor(public readonly id = 'broken-llm') {}
  public async isAvailable(): Promise<boolean> {
    return true;
  }
  public async complete(): Promise<TextGenerationResult> {
    throw new Error('provider exploded');
  }
}

/** Deterministic hashing embedder mirroring the infrastructure stub. */
export class FakeEmbedder implements IEmbedder {
  public readonly id = 'fake-embedder';
  public constructor(public readonly dimension = 32) {}

  public async embed(inputs: readonly string[]): Promise<EmbeddingVectorResult> {
    return {
      vectors: inputs.map((text) => this.hash(text)),
      model: this.id,
      dimension: this.dimension,
    };
  }

  private hash(text: string): number[] {
    const v = new Array<number>(this.dimension).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const slot = (code * 31 + i) % this.dimension;
      v[slot] = (v[slot] ?? 0) + ((code % 13) - 6) / 6;
    }
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return mag === 0 ? v : v.map((x) => x / mag);
  }
}

/** Brute-force in-memory vector index (cosine), pure and dependency-free. */
export class InMemoryVectorIndex implements IVectorIndex {
  private readonly records = new Map<string, IndexedVector>();

  public async upsert(records: readonly IndexedVector[]): Promise<void> {
    for (const r of records) {
      this.records.set(r.id, { id: r.id, vector: [...r.vector], ...(r.metadata ? { metadata: { ...r.metadata } } : {}) });
    }
  }

  public async query(
    vector: readonly number[],
    options: VectorSearchOptions = {},
  ): Promise<readonly VectorHit[]> {
    const topK = options.topK ?? 10;
    const hits: VectorHit[] = [];
    for (const r of this.records.values()) {
      hits.push({ id: r.id, score: (cosine(vector, r.vector) + 1) / 2, ...(r.metadata ? { metadata: r.metadata } : {}) });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  public async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.records.delete(id);
    }
  }

  public async count(): Promise<number> {
    return this.records.size;
  }
}

const cosine = (a: readonly number[], b: readonly number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    ma += x * x;
    mb += y * y;
  }
  return ma === 0 || mb === 0 ? 0 : dot / (Math.sqrt(ma) * Math.sqrt(mb));
};

/** In-memory preference-memory store for testing the Memory Engine. */
export class InMemoryPreferenceMemoryStore implements IPreferenceMemoryStore {
  private snapshot: PreferenceMemorySnapshot | null = null;
  public saves = 0;

  public async load(): Promise<PreferenceMemorySnapshot | null> {
    return this.snapshot;
  }

  public async save(snapshot: PreferenceMemorySnapshot): Promise<void> {
    this.snapshot = snapshot;
    this.saves += 1;
  }
}
