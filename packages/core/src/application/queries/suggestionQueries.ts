import { type Result, ok } from '../../shared/Result';
import { type Garment } from '../../domain/entities/Garment';
import { GarmentCategory } from '../../domain/value-objects/GarmentCategory';
import { type Occasion } from '../../domain/value-objects/Occasion';
import { type Season } from '../../domain/value-objects/Season';
import { type StylePreference } from '../../domain/value-objects/StylePreference';
import { type WeatherCondition } from '../../domain/value-objects/WeatherCondition';
import {
  OutfitScoringService,
  type OutfitScore,
  type ScoringContext,
} from '../../domain/services/OutfitScoringService';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { type Query, type RequestHandler } from '../bus/types';

export const GET_OUTFIT_SUGGESTIONS = 'outfit.suggestions';

export interface GetOutfitSuggestionsInput {
  readonly occasion: Occasion;
  readonly season: Season;
  readonly weather?: WeatherCondition;
  readonly stylePreference?: StylePreference;
  readonly recentSignatures?: readonly string[];
  readonly referenceDate?: string;
  /** Maximum number of suggestions to return (default 5). */
  readonly limit?: number;
}

/** A scored candidate outfit. */
export interface OutfitSuggestion {
  readonly garments: readonly Garment[];
  readonly score: number;
  readonly breakdown: OutfitScore;
}

/** How many garments per slot to consider, to keep generation bounded. */
const MAX_PER_SLOT = 6;
/** Hard cap on the number of candidate combinations evaluated. */
const MAX_CANDIDATES = 400;

/** Generate and rank outfit suggestions for an occasion/season. */
export class GetOutfitSuggestionsQuery implements Query<readonly OutfitSuggestion[]> {
  public readonly type = GET_OUTFIT_SUGGESTIONS;
  public constructor(public readonly input: GetOutfitSuggestionsInput) {}
}

export class GetOutfitSuggestionsHandler
  implements RequestHandler<GetOutfitSuggestionsQuery, readonly OutfitSuggestion[]>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly profiles: IUserProfileRepository,
    private readonly scoring = new OutfitScoringService(),
  ) {}

  public async handle(
    query: GetOutfitSuggestionsQuery,
  ): Promise<Result<readonly OutfitSuggestion[]>> {
    const { input } = query;
    const all = await this.garments.findAll();

    // Only wearable garments that suit the season are eligible.
    const eligible = all.filter((g) => g.isWearable && g.supportsSeason(input.season));

    const byCategory = (category: GarmentCategory): Garment[] =>
      eligible.filter((g) => g.category === category).slice(0, MAX_PER_SLOT);

    const tops = byCategory(GarmentCategory.Tops);
    const bottoms = byCategory(GarmentCategory.Bottoms);
    const dresses = byCategory(GarmentCategory.Dresses);
    const shoes = byCategory(GarmentCategory.Shoes);
    const outerwear = byCategory(GarmentCategory.Outerwear);

    const includeOuterwear = input.weather?.isCold === true || outerwear.length > 0;

    const combinations: Garment[][] = [];
    const pushCapped = (combo: Garment[]): void => {
      if (combinations.length < MAX_CANDIDATES) {
        combinations.push(combo);
      }
    };

    const shoeOptions: Array<Garment | null> = shoes.length > 0 ? shoes : [null];
    const outerOptions: Array<Garment | null> =
      includeOuterwear && outerwear.length > 0 ? [null, ...outerwear] : [null];

    // Top + bottom combinations.
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoe of shoeOptions) {
          for (const outer of outerOptions) {
            pushCapped(
              [top, bottom, shoe, outer].filter((g): g is Garment => g !== null),
            );
          }
        }
      }
    }
    // Dress combinations.
    for (const dress of dresses) {
      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          pushCapped([dress, shoe, outer].filter((g): g is Garment => g !== null));
        }
      }
    }

    const preference = input.stylePreference ?? (await this.resolvePreference());
    const context: ScoringContext = {
      ...(input.weather !== undefined ? { weather: input.weather } : {}),
      ...(preference !== undefined ? { stylePreference: preference } : {}),
      ...(input.recentSignatures !== undefined
        ? { recentSignatures: input.recentSignatures }
        : {}),
      ...(input.referenceDate !== undefined ? { referenceDate: input.referenceDate } : {}),
    };

    const suggestions: OutfitSuggestion[] = [];
    for (const combo of combinations) {
      if (combo.length === 0) {
        continue;
      }
      const breakdown = this.scoring.scoreCombination(combo, input.occasion, input.season, context);
      if (breakdown.disqualified) {
        continue;
      }
      suggestions.push({ garments: combo, score: breakdown.score, breakdown });
    }

    suggestions.sort((a, b) => b.score - a.score);
    const limit = input.limit ?? 5;
    return ok(suggestions.slice(0, Math.max(0, limit)));
  }

  private async resolvePreference(): Promise<StylePreference | undefined> {
    const profile = await this.profiles.getCurrent();
    return profile?.stylePreference;
  }
}
