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
