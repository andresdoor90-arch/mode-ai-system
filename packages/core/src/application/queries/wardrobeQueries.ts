import { type Result, ok } from '../../shared/Result';
import { type Garment } from '../../domain/entities/Garment';
import { type WardrobeCollection } from '../../domain/entities/WardrobeCollection';
import { type GarmentCategory } from '../../domain/value-objects/GarmentCategory';
import { type Season } from '../../domain/value-objects/Season';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type ICollectionRepository } from '../../domain/repositories/ICollectionRepository';
import { type Query, type RequestHandler } from '../bus/types';

/* -------------------------------------------------------------------------- */
/* GetWardrobe                                                                */
/* -------------------------------------------------------------------------- */

export const GET_WARDROBE = 'wardrobe.get';

export interface WardrobeView {
  readonly garments: readonly Garment[];
  readonly collections: readonly WardrobeCollection[];
}

/** Fetch the entire wardrobe: every garment plus every collection. */
export class GetWardrobeQuery implements Query<WardrobeView> {
  public readonly type = GET_WARDROBE;
}

export class GetWardrobeHandler implements RequestHandler<GetWardrobeQuery, WardrobeView> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly collections: ICollectionRepository,
  ) {}

  public async handle(): Promise<Result<WardrobeView>> {
    const [garments, collections] = await Promise.all([
      this.garments.findAll(),
      this.collections.findAll(),
    ]);
    return ok({ garments, collections });
  }
}

/* -------------------------------------------------------------------------- */
/* GetGarmentsByCategory                                                      */
/* -------------------------------------------------------------------------- */

export const GET_GARMENTS_BY_CATEGORY = 'wardrobe.garments-by-category';

/** Fetch all garments in a given category. */
export class GetGarmentsByCategoryQuery implements Query<readonly Garment[]> {
  public readonly type = GET_GARMENTS_BY_CATEGORY;
  public constructor(public readonly category: GarmentCategory) {}
}

export class GetGarmentsByCategoryHandler
  implements RequestHandler<GetGarmentsByCategoryQuery, readonly Garment[]>
{
  public constructor(private readonly garments: IGarmentRepository) {}

  public async handle(
    query: GetGarmentsByCategoryQuery,
  ): Promise<Result<readonly Garment[]>> {
    const result = await this.garments.findByCategory(query.category);
    return ok(result);
  }
}

/* -------------------------------------------------------------------------- */
/* GetSeasonalWardrobe                                                        */
/* -------------------------------------------------------------------------- */

export const GET_SEASONAL_WARDROBE = 'wardrobe.seasonal';

/** Fetch the garments suitable for a particular season. */
export class GetSeasonalWardrobeQuery implements Query<readonly Garment[]> {
  public readonly type = GET_SEASONAL_WARDROBE;
  public constructor(public readonly season: Season) {}
}

export class GetSeasonalWardrobeHandler
  implements RequestHandler<GetSeasonalWardrobeQuery, readonly Garment[]>
{
  public constructor(private readonly garments: IGarmentRepository) {}

  public async handle(
    query: GetSeasonalWardrobeQuery,
  ): Promise<Result<readonly Garment[]>> {
    const all = await this.garments.findAll();
    return ok(all.filter((g) => g.supportsSeason(query.season)));
  }
}
