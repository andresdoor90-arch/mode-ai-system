/**
 * History Analyzer (step 3 of the flow).
 *
 * Looks at the user's recent outfits to enforce freshness and surface patterns:
 *  - the signatures of recently-worn combinations (so the scorer's hard
 *    "no recent repeats" rule can fire), and
 *  - per-garment recent-wear counts used to detect over-reliance on a few
 *    pieces.
 *
 * Pure logic over the {@link IOutfitRepository} port — no I/O specifics leak in.
 */
import { type Garment } from '../../domain/entities/Garment';
import { type Outfit } from '../../domain/entities/Outfit';
import { type OutfitHistoryEntry } from '../../domain/entities/OutfitHistoryEntry';
import { type IOutfitHistoryRepository } from '../../domain/repositories/IOutfitHistoryRepository';
import { type IOutfitRepository } from '../../domain/repositories/IOutfitRepository';
import { OutfitScoringService } from '../../domain/services/OutfitScoringService';

export interface HistoryInsights {
  /** Order-independent signatures of recently-worn garment combinations. */
  readonly recentSignatures: readonly string[];
  /** Garment id → number of times it appears across recent outfits. */
  readonly wearFrequency: Readonly<Record<string, number>>;
  /** Total recent outfits considered. */
  readonly recentCount: number;
  /** True when the same combination repeats within the window. */
  readonly hasRepetition: boolean;
}

/** How many of the most-recent outfits define the "recent" window. */
const DEFAULT_WINDOW = 10;

export class HistoryAnalyzer {
  public constructor(
    private readonly outfits: IOutfitRepository,
    /**
     * Optional persisted usage history. When provided, recorded usages become a
     * FIRST-CLASS source of freshness/repetition signals — exactly the same
     * mechanism (combination signatures) as worn {@link Outfit}s, so the
     * recommendation engine improves as the user records real usage, with NO
     * duplicated freshness rule.
     */
    private readonly history?: IOutfitHistoryRepository,
  ) {}

  /** Build {@link HistoryInsights} from the most-recent outfits + usage history. */
  public async analyze(window = DEFAULT_WINDOW): Promise<HistoryInsights> {
    const all = await this.outfits.findAll();
    const recent = [...all]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(0, window));
    const base = this.fromOutfits(recent);

    if (this.history === undefined) {
      return base;
    }

    const entries = await this.history.findAll();
    const recentEntries = [...entries]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(0, window));
    return this.merge(base, recentEntries);
  }

  /** Pure projection over an explicit list of outfits (handy for tests). */
  public fromOutfits(recent: readonly Outfit[]): HistoryInsights {
    const signatures: string[] = [];
    const wearFrequency: Record<string, number> = {};

    for (const outfit of recent) {
      const garments: readonly Garment[] = outfit.garments;
      signatures.push(OutfitScoringService.signatureOf(garments));
      for (const garment of garments) {
        wearFrequency[garment.id] = (wearFrequency[garment.id] ?? 0) + 1;
      }
    }

    const uniqueSignatures = new Set(signatures);
    return {
      recentSignatures: [...uniqueSignatures],
      wearFrequency,
      recentCount: recent.length,
      hasRepetition: uniqueSignatures.size < signatures.length,
    };
  }

  /**
   * Merge persisted usage-history insights into the outfit-derived ones. Reuses
   * the entries' own {@link OutfitHistoryEntry.signature} (the same canonical
   * definition the scorer uses), so the freshness rule is never duplicated.
   */
  private merge(
    base: HistoryInsights,
    entries: readonly OutfitHistoryEntry[],
  ): HistoryInsights {
    const signatures = new Set(base.recentSignatures);
    const wearFrequency: Record<string, number> = { ...base.wearFrequency };
    const seen = new Set(base.recentSignatures);
    let repeated = base.hasRepetition;

    for (const entry of entries) {
      if (seen.has(entry.signature)) {
        repeated = true;
      }
      seen.add(entry.signature);
      signatures.add(entry.signature);
      for (const id of entry.garmentIds) {
        wearFrequency[id] = (wearFrequency[id] ?? 0) + 1;
      }
    }

    return {
      recentSignatures: [...signatures],
      wearFrequency,
      recentCount: base.recentCount + entries.length,
      hasRepetition: repeated,
    };
  }
}
