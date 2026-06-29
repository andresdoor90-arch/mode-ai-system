import { type Garment } from '../entities/Garment';
import { ColorHarmonyService } from './ColorHarmonyService';

/** Result of evaluating how well two garments pair. */
export interface PairCompatibility {
  readonly compatible: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

/** Largest acceptable gap on the 0–10 formality scale between two garments. */
export const MAX_FORMALITY_GAP = 4;

/**
 * Pure service applying garment-pairing rules. Two garments are compatible when
 * their formality levels are reasonably close and their colours do not clash.
 * Combines those signals into a 0–1 compatibility score.
 */
export class StyleCompatibilityService {
  public constructor(private readonly colorHarmony = new ColorHarmonyService()) {}

  /** Evaluate a single pair of garments. */
  public evaluatePair(a: Garment, b: Garment): PairCompatibility {
    const reasons: string[] = [];

    const formalityGap = Math.abs(a.formality - b.formality);
    const formalityScore = Math.max(0, 1 - formalityGap / 10);
    if (formalityGap > MAX_FORMALITY_GAP) {
      reasons.push(
        `Formality mismatch between ${a.subcategory} and ${b.subcategory} (gap ${formalityGap}).`,
      );
    }

    const colorScore = this.colorHarmony.pairScore(a.color, b.color);
    if (this.colorHarmony.hasClash([a.color, b.color])) {
      reasons.push(`Colours ${a.color.hex} and ${b.color.hex} clash.`);
    }

    const score = formalityScore * 0.5 + colorScore * 0.5;
    const compatible =
      formalityGap <= MAX_FORMALITY_GAP && !this.colorHarmony.hasClash([a.color, b.color]);
    return { compatible, score, reasons };
  }

  /**
   * Mean pairwise compatibility across a set of garments (0–1). Fewer than two
   * garments is trivially compatible.
   */
  public compatibilityScore(garments: readonly Garment[]): number {
    if (garments.length <= 1) {
      return 1;
    }
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < garments.length; i += 1) {
      for (let j = i + 1; j < garments.length; j += 1) {
        total += this.evaluatePair(garments[i] as Garment, garments[j] as Garment).score;
        pairs += 1;
      }
    }
    return pairs === 0 ? 1 : total / pairs;
  }

  /** The spread between the most and least formal garment (0–10). */
  public formalitySpread(garments: readonly Garment[]): number {
    if (garments.length === 0) {
      return 0;
    }
    const levels = garments.map((g) => g.formality);
    return Math.max(...levels) - Math.min(...levels);
  }
}
