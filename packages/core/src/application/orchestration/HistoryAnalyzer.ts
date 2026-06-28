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
  public constructor(private readonly outfits: IOutfitRepository) {}

  /** Build {@link HistoryInsights} from the most-recent outfits. */
  public async analyze(window = DEFAULT_WINDOW): Promise<HistoryInsights> {
    const all = await this.outfits.findAll();
    const recent = [...all]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(0, window));
    return this.fromOutfits(recent);
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
}
