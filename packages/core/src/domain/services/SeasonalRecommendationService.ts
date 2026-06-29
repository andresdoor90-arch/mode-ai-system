import { type Garment } from '../entities/Garment';
import { Season } from '../value-objects/Season';
import { type WeatherCondition, TEMPERATURE_THRESHOLDS } from '../value-objects/WeatherCondition';

/**
 * Pure service for season- and weather-aware reasoning. Scores how appropriate
 * garments are for a season, filters a wardrobe to a season, and evaluates
 * thermal adequacy against concrete weather.
 */
export class SeasonalRecommendationService {
  /** 1 if the garment supports the season, a soft 0.4 otherwise. */
  public seasonalScore(garment: Garment, season: Season): number {
    if (garment.supportsSeason(season)) {
      return 1;
    }
    // Adjacent seasons (spring/autumn) are a mild mismatch, not a hard fail.
    return 0.4;
  }

  /** Filter garments to those suitable for the season. */
  public forSeason(garments: readonly Garment[], season: Season): readonly Garment[] {
    return garments.filter((g) => g.supportsSeason(season));
  }

  /**
   * Thermal adequacy of a set of garments for the given weather, 0–1.
   *
   * Penalises heavy outerwear in hot weather and a lack of warm layers in cold
   * weather — the core of the "no heavy coat when it is hot" smart-rule, scored
   * as a gradient rather than a hard block here (the hard block lives in the
   * scoring service's rule violations).
   */
  public thermalAdequacy(garments: readonly Garment[], weather: WeatherCondition): number {
    const hasHeavyOuterwear = garments.some((g) => g.isHeavyOuterwear);
    const layerCount = garments.filter(
      (g) => g.supportsSeason(Season.Winter) || g.isHeavyOuterwear,
    ).length;

    if (weather.temperatureC >= TEMPERATURE_THRESHOLDS.hot) {
      return hasHeavyOuterwear ? 0.1 : 1;
    }
    if (weather.temperatureC <= TEMPERATURE_THRESHOLDS.cold) {
      if (hasHeavyOuterwear) {
        return 1;
      }
      return layerCount >= 1 ? 0.6 : 0.2;
    }
    // Mild weather: heavy coats are slightly too much but not wrong.
    return hasHeavyOuterwear ? 0.7 : 1;
  }

  /** The season that best matches concrete weather conditions. */
  public seasonForWeather(weather: WeatherCondition): Season {
    return weather.inferSeason();
  }
}
