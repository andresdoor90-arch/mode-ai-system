import { describe, it, expect } from 'vitest';

import { unwrap } from '../../shared/Result';
import { GarmentStatus } from '../entities/Garment';
import { GarmentCategory } from '../value-objects/GarmentCategory';
import {
  TopSubcategory,
  BottomSubcategory,
  ShoeSubcategory,
  OuterwearSubcategory,
  AccessorySubcategory,
} from '../value-objects/GarmentSubcategory';
import { Occasion } from '../value-objects/Occasion';
import { Season } from '../value-objects/Season';
import { WeatherCondition } from '../value-objects/WeatherCondition';
import { ColorHarmonyService, ColorHarmonyType } from './ColorHarmonyService';
import { StyleCompatibilityService } from './StyleCompatibilityService';
import { SeasonalRecommendationService } from './SeasonalRecommendationService';
import { OccasionMatchingService } from './OccasionMatchingService';
import {
  OutfitScoringService,
  DEFAULT_SCORING_WEIGHTS,
} from './OutfitScoringService';
import { makeGarment, color } from '../../__fixtures__/testSupport';

const C = {
  red: color('#ff0000', 'red'),
  cyan: color('#00ffff', 'cyan'),
  orange: color('#ff8000', 'orange'),
  chartreuse: color('#bfff00', 'chartreuse'),
  green: color('#00ff00', 'green'),
  gray: color('#808080', 'gray'),
  navy: color('#1d3f72', 'navy'),
};

describe('ColorHarmonyService', () => {
  const svc = new ColorHarmonyService();

  it('computes wheel relationships', () => {
    expect(svc.complementaryHue(C.red)).toBe(180);
    expect(svc.analogousHues(C.red)).toEqual([330, 30]);
    expect(svc.triadicHues(C.red)).toEqual([120, 240]);
  });

  it('classifies pairs', () => {
    expect(svc.relationship(C.red, C.cyan)).toBe(ColorHarmonyType.Complementary);
    expect(svc.relationship(C.red, C.orange)).toBe(ColorHarmonyType.Analogous);
    expect(svc.relationship(C.red, C.green)).toBe(ColorHarmonyType.Triadic);
    expect(svc.relationship(C.red, C.chartreuse)).toBe(ColorHarmonyType.Clash);
    expect(svc.relationship(C.red, C.gray)).toBe(ColorHarmonyType.Neutral);
  });

  it('scores harmony and detects clashes', () => {
    expect(svc.harmonyScore([C.red, C.cyan])).toBeGreaterThan(0.7);
    expect(svc.harmonyScore([C.red, C.chartreuse])).toBeLessThan(0.5);
    expect(svc.hasClash([C.red, C.chartreuse])).toBe(true);
    expect(svc.hasClash([C.red, C.gray])).toBe(false);
    expect(svc.harmonyScore([C.navy])).toBe(1);
  });
});

describe('StyleCompatibilityService', () => {
  const svc = new StyleCompatibilityService();

  it('flags a large formality gap as incompatible', () => {
    const dressShoes = makeGarment({
      category: GarmentCategory.Shoes,
      subcategory: ShoeSubcategory.DressShoes,
      color: C.gray,
    });
    const tank = makeGarment({
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.TankTop,
      color: C.gray,
    });
    const result = svc.evaluatePair(dressShoes, tank);
    expect(result.compatible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('treats a close pairing with safe colours as compatible', () => {
    const shirt = makeGarment({ subcategory: TopSubcategory.Shirt, color: C.navy });
    const trousers = makeGarment({
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Trousers,
      color: C.gray,
    });
    expect(svc.evaluatePair(shirt, trousers).compatible).toBe(true);
  });
});

describe('SeasonalRecommendationService', () => {
  const svc = new SeasonalRecommendationService();

  it('scores season suitability', () => {
    const winter = makeGarment({ seasons: [Season.Winter] });
    expect(svc.seasonalScore(winter, Season.Winter)).toBe(1);
    expect(svc.seasonalScore(winter, Season.Summer)).toBeCloseTo(0.4);
  });

  it('penalises heavy coats when hot and rewards them when cold', () => {
    const coat = makeGarment({
      category: GarmentCategory.Outerwear,
      subcategory: OuterwearSubcategory.Coat,
      seasons: [Season.Winter],
    });
    const hot = unwrap(WeatherCondition.create({ temperatureC: 32 }));
    const cold = unwrap(WeatherCondition.create({ temperatureC: 0 }));
    expect(svc.thermalAdequacy([coat], hot)).toBeLessThan(0.3);
    expect(svc.thermalAdequacy([coat], cold)).toBe(1);
  });
});

describe('OccasionMatchingService', () => {
  const svc = new OccasionMatchingService();

  it('scores how well formality matches the occasion', () => {
    const formalwear = [
      makeGarment({ subcategory: TopSubcategory.Shirt }),
      makeGarment({ category: GarmentCategory.Bottoms, subcategory: BottomSubcategory.Trousers }),
    ];
    const business = svc.matchScore(formalwear, Occasion.Business);
    const sport = svc.matchScore(formalwear, Occasion.Sport);
    expect(business).toBeGreaterThan(sport);
  });

  it('detects a tie at an informal occasion', () => {
    const tie = makeGarment({
      category: GarmentCategory.Accessories,
      subcategory: AccessorySubcategory.Tie,
    });
    expect(svc.hasTieOnInformalOccasion([tie], Occasion.Casual)).toBe(true);
    expect(svc.hasTieOnInformalOccasion([tie], Occasion.Formal)).toBe(false);
  });
});

describe('OutfitScoringService', () => {
  const svc = new OutfitScoringService();

  const shirt = () => makeGarment({ subcategory: TopSubcategory.Shirt, color: C.navy });
  const trousers = () =>
    makeGarment({ category: GarmentCategory.Bottoms, subcategory: BottomSubcategory.Trousers, color: C.gray });
  const loafers = () =>
    makeGarment({ category: GarmentCategory.Shoes, subcategory: ShoeSubcategory.Loafers, color: color('#222222') });

  it('weights sum to exactly 1', () => {
    const total = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('scores a coherent business outfit highly without disqualifying it', () => {
    const result = svc.scoreCombination(
      [shirt(), trousers(), loafers()],
      Occasion.Business,
      Season.AllSeason,
    );
    expect(result.disqualified).toBe(false);
    expect(result.score).toBeGreaterThan(60);
    expect(result.factors).toHaveLength(10);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('SMART RULE: never recommends a damaged/in-laundry garment', () => {
    const damaged = makeGarment({ subcategory: TopSubcategory.Shirt, color: C.navy, status: GarmentStatus.Damaged });
    const result = svc.scoreCombination([damaged, trousers(), loafers()], Occasion.Casual, Season.AllSeason);
    expect(result.disqualified).toBe(true);
    expect(result.score).toBe(0);
    expect(result.violations.join(' ')).toContain('damaged');
  });

  it('SMART RULE: no heavy coat when it is hot', () => {
    const coat = makeGarment({
      category: GarmentCategory.Outerwear,
      subcategory: OuterwearSubcategory.Coat,
      color: C.gray,
    });
    const hot = unwrap(WeatherCondition.create({ temperatureC: 30 }));
    const result = svc.scoreCombination(
      [shirt(), trousers(), loafers(), coat],
      Occasion.Casual,
      Season.Summer,
      { weather: hot },
    );
    expect(result.disqualified).toBe(true);
  });

  it('SMART RULE: no tie for informal events', () => {
    const tie = makeGarment({
      category: GarmentCategory.Accessories,
      subcategory: AccessorySubcategory.Tie,
      color: C.gray,
    });
    const result = svc.scoreCombination([shirt(), trousers(), loafers(), tie], Occasion.Casual, Season.AllSeason);
    expect(result.disqualified).toBe(true);
  });

  it('SMART RULE: no clashing colours', () => {
    const redShirt = makeGarment({ subcategory: TopSubcategory.Shirt, color: C.red });
    const clashBottom = makeGarment({
      category: GarmentCategory.Bottoms,
      subcategory: BottomSubcategory.Trousers,
      color: C.chartreuse,
    });
    const result = svc.scoreCombination([redShirt, clashBottom, loafers()], Occasion.Casual, Season.AllSeason);
    expect(result.disqualified).toBe(true);
    expect(result.violations.join(' ')).toContain('clashing');
  });

  it('SMART RULE: no recently-repeated combinations', () => {
    const combo = [shirt(), trousers(), loafers()];
    const signature = OutfitScoringService.signatureOf(combo);
    const result = svc.scoreCombination(combo, Occasion.Casual, Season.AllSeason, {
      recentSignatures: [signature],
    });
    expect(result.disqualified).toBe(true);
  });

  it('produces an order-independent signature', () => {
    const a = shirt();
    const b = trousers();
    expect(OutfitScoringService.signatureOf([a, b])).toBe(OutfitScoringService.signatureOf([b, a]));
  });

  it('rewards fresher garments over heavily-worn ones', () => {
    const fresh = svc.scoreCombination(
      [shirt(), trousers(), loafers()],
      Occasion.Casual,
      Season.AllSeason,
    );
    const wornTop = makeGarment({ subcategory: TopSubcategory.Shirt, color: C.navy, wearCount: 30 });
    const worn = svc.scoreCombination([wornTop, trousers(), loafers()], Occasion.Casual, Season.AllSeason);
    const freshFreshness = fresh.factors.find((f) => f.name === 'freshness')?.value ?? 0;
    const wornFreshness = worn.factors.find((f) => f.name === 'freshness')?.value ?? 0;
    expect(freshFreshness).toBeGreaterThan(wornFreshness);
  });
});
