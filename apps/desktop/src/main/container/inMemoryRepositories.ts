/**
 * In-memory repository implementations (Phase 4 bootstrap persistence).
 *
 * These implement the `@mas/core` repository *ports* with simple `Map`-backed
 * storage. They let the desktop app run end-to-end through the real
 * application layer (Command/Query buses + use cases) without requiring the
 * native SQLite driver, which cannot be installed in the offline build sandbox.
 *
 * They are deliberately port-compatible with the SQLite-backed repositories in
 * `@mas/infrastructure`: swapping these for `SqlGarmentRepository` et al. in
 * {@link AppContainer} is a one-line change once the native driver is available
 * (CI / packaged builds). No business logic lives here — only storage I/O.
 */
import type {
  CalendarEvent,
  CollectionId,
  Garment,
  GarmentCategory,
  GarmentId,
  GarmentQuery,
  ICalendarEventRepository,
  ICollectionRepository,
  IGarmentRepository,
  IOutfitRepository,
  IStyleRuleRepository,
  IUserProfileRepository,
  Occasion,
  Outfit,
  OutfitId,
  OutfitQuery,
  StyleRule,
  UserProfile,
  UserProfileId,
  WardrobeCollection,
} from '@mas/core';

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
      if (criteria.subcategory !== undefined && g.subcategory !== criteria.subcategory)
        return false;
      if (criteria.status !== undefined && g.status !== criteria.status) return false;
      if (criteria.season !== undefined && !g.supportsSeason(criteria.season)) return false;
      if (criteria.tags !== undefined && !criteria.tags.every((t) => g.tags.includes(t)))
        return false;
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
  public async findById(id: OutfitId): Promise<Outfit | null> {
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
  public async delete(id: OutfitId): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryCollectionRepository implements ICollectionRepository {
  private readonly store = new Map<string, WardrobeCollection>();

  public async save(collection: WardrobeCollection): Promise<void> {
    this.store.set(collection.id, collection);
  }
  public async findById(id: CollectionId): Promise<WardrobeCollection | null> {
    return this.store.get(id) ?? null;
  }
  public async findAll(): Promise<readonly WardrobeCollection[]> {
    return [...this.store.values()];
  }
  public async delete(id: CollectionId): Promise<void> {
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
  public async findById(id: UserProfileId): Promise<UserProfile | null> {
    return this.store.get(id) ?? null;
  }
  public async getCurrent(): Promise<UserProfile | null> {
    return this.currentId !== undefined ? (this.store.get(this.currentId) ?? null) : null;
  }
  public async delete(id: UserProfileId): Promise<void> {
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
    return [...this.store.values()]
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);
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
