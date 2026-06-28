/**
 * Memory Engine — persistent preference memory that improves future
 * recommendations.
 *
 * When the user accepts or rejects a recommendation, the engine nudges the
 * affinity it has learned for that outfit's colours and subcategories. Those
 * affinities are later applied by the {@link PreferenceEngine} to bias ranking,
 * so the system genuinely gets better over time.
 *
 * The *learning* logic is pure and deterministic; durability is delegated to an
 * injected {@link IPreferenceMemoryStore} port, so the same engine works with a
 * JSON file, the config store, a repository or nothing at all (in-process).
 */
import { type Garment } from '../../domain/entities/Garment';
import {
  EMPTY_PREFERENCE_MEMORY,
  type IPreferenceMemoryStore,
  type PreferenceMemorySnapshot,
} from './ports';

/** How strongly a single accept/reject moves an affinity. */
const ACCEPT_DELTA = 0.15;
const REJECT_DELTA = 0.2;
/** Affinities are clamped to this symmetric range. */
const AFFINITY_BOUND = 1;

const clamp = (n: number, bound = AFFINITY_BOUND): number => Math.min(bound, Math.max(-bound, n));

/** Pure helper: bump one key of an affinity map by delta, clamped. */
const bump = (
  map: Readonly<Record<string, number>>,
  key: string,
  delta: number,
): Record<string, number> => {
  const next = { ...map };
  next[key] = clamp((next[key] ?? 0) + delta);
  return next;
};

/**
 * Apply one feedback event to a snapshot, returning a NEW snapshot (the input
 * is never mutated). Exposed as a static pure function so it can be unit-tested
 * in isolation and reused without an engine instance.
 */
export const applyFeedback = (
  snapshot: PreferenceMemorySnapshot,
  garments: readonly Garment[],
  accepted: boolean,
  isoTimestamp: string,
): PreferenceMemorySnapshot => {
  const delta = accepted ? ACCEPT_DELTA : -REJECT_DELTA;
  let colorAffinity: Record<string, number> = { ...snapshot.colorAffinity };
  let subcategoryAffinity: Record<string, number> = { ...snapshot.subcategoryAffinity };

  for (const garment of garments) {
    const colorName = garment.color.name?.toLowerCase();
    if (colorName !== undefined && colorName.length > 0) {
      colorAffinity = bump(colorAffinity, colorName, delta);
    }
    subcategoryAffinity = bump(subcategoryAffinity, garment.subcategory, delta);
  }

  return {
    version: snapshot.version,
    colorAffinity,
    subcategoryAffinity,
    acceptCount: snapshot.acceptCount + (accepted ? 1 : 0),
    rejectCount: snapshot.rejectCount + (accepted ? 0 : 1),
    updatedAt: isoTimestamp,
  };
};

/** Stateful façade over the pure learning logic + persistence. */
export class MemoryEngine {
  private snapshot: PreferenceMemorySnapshot = EMPTY_PREFERENCE_MEMORY;
  private loaded = false;

  public constructor(
    private readonly store?: IPreferenceMemoryStore,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** Load persisted memory once; subsequent calls return the cached snapshot. */
  public async load(): Promise<PreferenceMemorySnapshot> {
    if (this.loaded) {
      return this.snapshot;
    }
    if (this.store !== undefined) {
      const persisted = await this.store.load();
      if (persisted !== null) {
        this.snapshot = persisted;
      }
    }
    this.loaded = true;
    return this.snapshot;
  }

  /** The current in-memory snapshot (call {@link load} first for durability). */
  public current(): PreferenceMemorySnapshot {
    return this.snapshot;
  }

  /** Record that the user wore/accepted a recommended outfit. */
  public async recordAcceptance(garments: readonly Garment[]): Promise<PreferenceMemorySnapshot> {
    return this.record(garments, true);
  }

  /** Record that the user dismissed/rejected a recommended outfit. */
  public async recordRejection(garments: readonly Garment[]): Promise<PreferenceMemorySnapshot> {
    return this.record(garments, false);
  }

  private async record(
    garments: readonly Garment[],
    accepted: boolean,
  ): Promise<PreferenceMemorySnapshot> {
    await this.load();
    this.snapshot = applyFeedback(this.snapshot, garments, accepted, this.clock());
    if (this.store !== undefined) {
      await this.store.save(this.snapshot);
    }
    return this.snapshot;
  }
}
