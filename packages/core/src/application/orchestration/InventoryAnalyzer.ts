/**
 * Inventory Analyzer (step 5 of the flow).
 *
 * Queries the wardrobe through the {@link IGarmentRepository} port and filters
 * it down to the garments that are actually eligible for the current context:
 * only wearable items (not damaged / in the laundry / archived) that suit the
 * target season. Heavy outerwear is dropped in hot weather up-front so the
 * candidate generator never wastes effort on combinations the smart rules would
 * later disqualify.
 */
import { type Garment } from '../../domain/entities/Garment';
import { GarmentCategory } from '../../domain/value-objects/GarmentCategory';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type RecommendationContext } from './types';

/** Garments grouped by the layer they occupy, ready for candidate assembly. */
export interface Inventory {
  readonly all: readonly Garment[];
  readonly tops: readonly Garment[];
  readonly bottoms: readonly Garment[];
  readonly dresses: readonly Garment[];
  readonly shoes: readonly Garment[];
  readonly outerwear: readonly Garment[];
  readonly accessories: readonly Garment[];
}

export class InventoryAnalyzer {
  public constructor(private readonly garments: IGarmentRepository) {}

  /** Resolve the eligible, grouped inventory for a recommendation context. */
  public async forContext(context: RecommendationContext): Promise<Inventory> {
    const all = await this.garments.findAll();
    const isHot = context.weather?.isHot === true;

    const eligible = all.filter((garment) => {
      if (!garment.isWearable) {
        return false;
      }
      if (!garment.supportsSeason(context.season)) {
        return false;
      }
      if (isHot && garment.isHeavyOuterwear) {
        return false;
      }
      return true;
    });

    const byCategory = (category: GarmentCategory): readonly Garment[] =>
      eligible.filter((g) => g.category === category);

    return {
      all: eligible,
      tops: byCategory(GarmentCategory.Tops),
      bottoms: byCategory(GarmentCategory.Bottoms),
      dresses: byCategory(GarmentCategory.Dresses),
      shoes: byCategory(GarmentCategory.Shoes),
      outerwear: byCategory(GarmentCategory.Outerwear),
      accessories: byCategory(GarmentCategory.Accessories),
    };
  }
}
