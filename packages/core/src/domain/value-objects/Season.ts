/**
 * The seasons a garment, outfit or colour is suited to.
 *
 * `AllSeason` is a wildcard that matches every concrete season.
 */
export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
  AllSeason = 'all-season',
}

/** The four concrete seasons (excludes the `AllSeason` wildcard). */
export const CONCRETE_SEASONS: readonly Season[] = [
  Season.Spring,
  Season.Summer,
  Season.Autumn,
  Season.Winter,
];

/**
 * Whether two seasons are compatible. `AllSeason` is compatible with anything;
 * otherwise the seasons must be identical.
 */
export const seasonsMatch = (a: Season, b: Season): boolean => {
  if (a === Season.AllSeason || b === Season.AllSeason) {
    return true;
  }
  return a === b;
};

/** Rough average temperature (°C) associated with a season for thermal logic. */
export const seasonAverageTemperatureC = (season: Season): number => {
  switch (season) {
    case Season.Summer:
      return 28;
    case Season.Spring:
      return 16;
    case Season.Autumn:
      return 13;
    case Season.Winter:
      return 3;
    case Season.AllSeason:
      return 18;
    default:
      return 18;
  }
};
