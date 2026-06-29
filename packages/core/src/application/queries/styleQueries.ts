import { type Result, ok, unwrap } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { type Garment } from '../../domain/entities/Garment';
import { Color, ColorCategory } from '../../domain/value-objects/Color';
import { ColorPalette } from '../../domain/value-objects/ColorPalette';
import { ColorHarmonyService } from '../../domain/services/ColorHarmonyService';
import { garmentFormality } from '../../domain/services/formality';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { type IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { type Query, type RequestHandler } from '../bus/types';

/* -------------------------------------------------------------------------- */
/* GetStyleAnalysis                                                           */
/* -------------------------------------------------------------------------- */

export const GET_STYLE_ANALYSIS = 'style.analysis';

/** A descriptive summary of a wardrobe's character. */
export interface StyleAnalysis {
  readonly totalGarments: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly averageFormality: number;
  readonly colorTemperature: { readonly warm: number; readonly cool: number; readonly neutral: number };
  readonly paletteHarmony: number;
  readonly dominantSubcategory: string | null;
}

/** Analyse the wardrobe's composition, formality and colour character. */
export class GetStyleAnalysisQuery implements Query<StyleAnalysis> {
  public readonly type = GET_STYLE_ANALYSIS;
}

export class GetStyleAnalysisHandler
  implements RequestHandler<GetStyleAnalysisQuery, StyleAnalysis>
{
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly colorHarmony = new ColorHarmonyService(),
  ) {}

  public async handle(): Promise<Result<StyleAnalysis>> {
    const all = await this.garments.findAll();
    const byCategory: Record<string, number> = {};
    const bySubcategory: Record<string, number> = {};
    const temperature = { warm: 0, cool: 0, neutral: 0 };
    let formalitySum = 0;

    for (const garment of all) {
      byCategory[garment.category] = (byCategory[garment.category] ?? 0) + 1;
      bySubcategory[garment.subcategory] = (bySubcategory[garment.subcategory] ?? 0) + 1;
      formalitySum += garmentFormality(garment.subcategory);
      switch (garment.color.category) {
        case ColorCategory.Warm:
          temperature.warm += 1;
          break;
        case ColorCategory.Cool:
          temperature.cool += 1;
          break;
        default:
          temperature.neutral += 1;
      }
    }

    const distinctColors = this.distinctColors(all);
    const dominantSubcategory = Object.entries(bySubcategory).sort((a, b) => b[1] - a[1])[0];

    return ok({
      totalGarments: all.length,
      byCategory,
      averageFormality: all.length === 0 ? 0 : formalitySum / all.length,
      colorTemperature: temperature,
      paletteHarmony: this.colorHarmony.harmonyScore(distinctColors),
      dominantSubcategory: dominantSubcategory ? dominantSubcategory[0] : null,
    });
  }

  private distinctColors(garments: readonly Garment[]): readonly Color[] {
    const seen = new Map<string, Color>();
    for (const garment of garments) {
      if (!seen.has(garment.color.hex)) {
        seen.set(garment.color.hex, garment.color);
      }
    }
    return [...seen.values()];
  }
}

/* -------------------------------------------------------------------------- */
/* GetColorPalette                                                            */
/* -------------------------------------------------------------------------- */

export const GET_COLOR_PALETTE = 'style.color-palette';

/** Return the user's signature palette, or derive one from their wardrobe. */
export class GetColorPaletteQuery implements Query<ColorPalette> {
  public readonly type = GET_COLOR_PALETTE;
}

export class GetColorPaletteHandler implements RequestHandler<GetColorPaletteQuery, ColorPalette> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly profiles: IUserProfileRepository,
  ) {}

  public async handle(): Promise<Result<ColorPalette>> {
    const profile = await this.profiles.getCurrent();
    if (profile?.colorPalette !== undefined) {
      return ok(profile.colorPalette);
    }
    return this.derivePalette();
  }

  private async derivePalette(): Promise<Result<ColorPalette>> {
    const all = await this.garments.findAll();
    if (all.length === 0) {
      return { ok: false, error: new ValidationError('Cannot derive a palette from an empty wardrobe.') };
    }

    const frequency = new Map<string, { color: Color; count: number }>();
    for (const garment of all) {
      const entry = frequency.get(garment.color.hex);
      if (entry) {
        entry.count += 1;
      } else {
        frequency.set(garment.color.hex, { color: garment.color, count: 1 });
      }
    }
    const ranked = [...frequency.values()].sort((a, b) => b.count - a.count).map((e) => e.color);
    const nonNeutral = ranked.filter((c) => !c.isNeutral);
    const neutrals = ranked.filter((c) => c.isNeutral);

    const primary = nonNeutral[0] ?? ranked[0] as Color;
    const secondary = nonNeutral[1] ?? primary;
    const accent =
      nonNeutral
        .slice(1)
        .sort((a, b) => primary.hueDistance(b) - primary.hueDistance(a))[0] ?? secondary;
    const neutral = neutrals[0] ?? unwrap(Color.fromHex('#1a1a1a', 'black'));

    return ColorPalette.create({ primary, secondary, accent, neutral });
  }
}
