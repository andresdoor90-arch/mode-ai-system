import { type Garment } from '../entities/Garment';
import { AccessorySubcategory } from '../value-objects/GarmentSubcategory';
import { Occasion, occasionFormality, isInformalOccasion } from '../value-objects/Occasion';
import { garmentFormality } from './formality';

/**
 * Pure service evaluating how well garments/outfits fit an occasion. The core
 * idea: each occasion implies a target formality, and the outfit's average
 * formality should sit close to it.
 */
export class OccasionMatchingService {
  /** Target formality (0–10) implied by an occasion. */
  public targetFormality(occasion: Occasion): number {
    return occasionFormality(occasion);
  }

  /** Average formality (0–10) of a set of garments. */
  public averageFormality(garments: readonly Garment[]): number {
    if (garments.length === 0) {
      return 0;
    }
    const total = garments.reduce((sum, g) => sum + garmentFormality(g.subcategory), 0);
    return total / garments.length;
  }

  /**
   * 0–1 score for how well the garments match the occasion's formality. A
   * perfect match scores 1; the score decays linearly with the gap.
   */
  public matchScore(garments: readonly Garment[], occasion: Occasion): number {
    if (garments.length === 0) {
      return 0;
    }
    const gap = Math.abs(this.averageFormality(garments) - this.targetFormality(occasion));
    return Math.max(0, 1 - gap / 10);
  }

  /**
   * The "no tie for informal events" smart-rule: returns true when a formal
   * accessory (a tie) is present for an explicitly informal occasion.
   */
  public hasTieOnInformalOccasion(garments: readonly Garment[], occasion: Occasion): boolean {
    if (!isInformalOccasion(occasion)) {
      return false;
    }
    return garments.some((g) => g.subcategory === AccessorySubcategory.Tie);
  }

  /** Whether the occasion calls for formal tailoring (blazer/tie/dress shoes). */
  public expectsFormalwear(occasion: Occasion): boolean {
    return this.targetFormality(occasion) >= 7;
  }
}
