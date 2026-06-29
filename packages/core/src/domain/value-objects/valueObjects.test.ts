import { describe, it, expect } from 'vitest';

import { unwrap } from '../../shared/Result';
import { Season, seasonsMatch, seasonAverageTemperatureC } from './Season';
import { Occasion, occasionFormality, isFormalOccasion, isInformalOccasion } from './Occasion';
import { GarmentCategory } from './GarmentCategory';
import {
  isSubcategoryOf,
  HEAVY_OUTERWEAR,
  TopSubcategory,
  OuterwearSubcategory,
} from './GarmentSubcategory';
import { Size, SizeSystem } from './Size';
import { BodyMeasurements, BodyShape } from './BodyMeasurements';
import { StylePreference, StyleAesthetic } from './StylePreference';
import { WeatherCondition, Precipitation } from './WeatherCondition';
import { ColorPalette } from './ColorPalette';
import { Color } from './Color';

describe('Season helpers', () => {
  it('treats AllSeason as a wildcard', () => {
    expect(seasonsMatch(Season.AllSeason, Season.Winter)).toBe(true);
    expect(seasonsMatch(Season.Summer, Season.Summer)).toBe(true);
    expect(seasonsMatch(Season.Summer, Season.Winter)).toBe(false);
  });

  it('exposes average temperatures ordered by warmth', () => {
    expect(seasonAverageTemperatureC(Season.Summer)).toBeGreaterThan(
      seasonAverageTemperatureC(Season.Winter),
    );
  });
});

describe('Occasion helpers', () => {
  it('ranks formality from sport up to formal', () => {
    expect(occasionFormality(Occasion.Formal)).toBeGreaterThan(occasionFormality(Occasion.Casual));
    expect(isFormalOccasion(Occasion.Business)).toBe(true);
    expect(isInformalOccasion(Occasion.Sport)).toBe(true);
    expect(isFormalOccasion(Occasion.Casual)).toBe(false);
  });
});

describe('GarmentSubcategory', () => {
  it('validates subcategory membership per category', () => {
    expect(isSubcategoryOf(GarmentCategory.Tops, TopSubcategory.Shirt)).toBe(true);
    expect(isSubcategoryOf(GarmentCategory.Tops, OuterwearSubcategory.Coat)).toBe(false);
  });

  it('lists heavy outerwear', () => {
    expect(HEAVY_OUTERWEAR).toContain(OuterwearSubcategory.Coat);
    expect(HEAVY_OUTERWEAR).not.toContain(OuterwearSubcategory.Cardigan);
  });
});

describe('Size', () => {
  it('accepts a valid alpha size and uppercases it', () => {
    const size = unwrap(Size.create({ system: SizeSystem.AlphaNumeric, value: 'm' }));
    expect(size.value).toBe('M');
  });

  it('rejects an invalid alpha size', () => {
    expect(Size.create({ system: SizeSystem.AlphaNumeric, value: 'Q' }).ok).toBe(false);
  });

  it('rejects non-positive measurements', () => {
    const r = Size.create({ system: SizeSystem.EU, value: '40', measurements: { waist: -1 } });
    expect(r.ok).toBe(false);
  });
});

describe('BodyMeasurements', () => {
  it('requires a plausible height', () => {
    expect(BodyMeasurements.create({ heightCm: 10 }).ok).toBe(false);
    expect(BodyMeasurements.create({ heightCm: 175 }).ok).toBe(true);
  });

  it('validates optional fields and defaults shape', () => {
    expect(BodyMeasurements.create({ heightCm: 175, waistCm: 5 }).ok).toBe(false);
    const m = unwrap(BodyMeasurements.create({ heightCm: 175, waistCm: 80 }));
    expect(m.shape).toBe(BodyShape.Unspecified);
    expect(m.waistCm).toBe(80);
  });
});

describe('StylePreference', () => {
  it('normalises colours and defaults affinities', () => {
    const p = unwrap(
      StylePreference.create({
        aesthetics: [StyleAesthetic.Minimalist],
        preferredColors: ['Navy', 'WHITE'],
        avoidedColors: ['Neon'],
      }),
    );
    expect(p.preferredColors).toEqual(['navy', 'white']);
    expect(p.avoidedColors).toEqual(['neon']);
    expect(p.boldnessAffinity).toBe(0.5);
  });

  it('rejects out-of-range affinities', () => {
    expect(StylePreference.create({ boldnessAffinity: 2 }).ok).toBe(false);
  });
});

describe('WeatherCondition', () => {
  it('flags hot and cold and infers a season', () => {
    const hot = unwrap(WeatherCondition.create({ temperatureC: 30 }));
    const cold = unwrap(
      WeatherCondition.create({ temperatureC: 2, precipitation: Precipitation.Snow }),
    );
    expect(hot.isHot).toBe(true);
    expect(hot.inferSeason()).toBe(Season.Summer);
    expect(cold.isCold).toBe(true);
    expect(cold.inferSeason()).toBe(Season.Winter);
  });

  it('validates ranges', () => {
    expect(WeatherCondition.create({ temperatureC: 999 }).ok).toBe(false);
    expect(WeatherCondition.create({ temperatureC: 20, humidityPct: 150 }).ok).toBe(false);
  });
});

describe('ColorPalette', () => {
  const make = (): ColorPalette =>
    unwrap(
      ColorPalette.create({
        primary: unwrap(Color.fromHex('#1d3f72')),
        secondary: unwrap(Color.fromHex('#6f9ceb')),
        accent: unwrap(Color.fromHex('#e0a458')),
        neutral: unwrap(Color.fromHex('#2b2b2b')),
      }),
    );

  it('exposes all four roles', () => {
    expect(make().colors).toHaveLength(4);
  });

  it('detects whether a colour belongs to the palette', () => {
    const palette = make();
    expect(palette.includes(unwrap(Color.fromHex('#1d3f72')))).toBe(true);
    expect(palette.includes(unwrap(Color.fromHex('#00ff00')))).toBe(false);
  });
});
