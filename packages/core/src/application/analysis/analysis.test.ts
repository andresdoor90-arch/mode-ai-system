import { describe, expect, it } from 'vitest';

import { BaselineVisionProvider } from './BaselineVisionProvider';
import { nameForHex } from './colorNaming';
import { GarmentAnalysisService } from './GarmentAnalysisService';
import { HintRefiner } from './HintRefiner';
import {
  countPopulatedFields,
  type GarmentAnalysis,
  type IVisionProvider,
  manualFieldsOnly,
  mergeAnalyses,
  overallConfidence,
  type VisionAnalysisInput,
} from './visionPorts';

const NAVY = { r: 25, g: 40, b: 80 };

describe('nameForHex', () => {
  it('names common colours and rejects malformed input', () => {
    expect(nameForHex('#000000')).toBe('Negro');
    expect(nameForHex('#ffffff')).toBe('Blanco');
    expect(nameForHex('not-a-color')).toBeNull();
  });
});

describe('BaselineVisionProvider', () => {
  it('extracts primary colour from samples and nothing it cannot know', async () => {
    const provider = new BaselineVisionProvider();
    const result = await provider.analyze({
      colorSamples: [
        { ...NAVY, weight: 10 },
        { ...NAVY, weight: 8 },
      ],
    });
    expect(result.primaryColor?.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.primaryColor?.source).toBe('baseline');
    // It must never fabricate non-colour attributes.
    expect(result.material).toBeUndefined();
    expect(result.garmentType).toBeUndefined();
  });

  it('returns an empty analysis when there are no samples', async () => {
    const provider = new BaselineVisionProvider();
    expect(await provider.analyze({})).toEqual({});
  });
});

describe('HintRefiner', () => {
  const refiner = new HintRefiner();

  it('parses material, sleeve, fit, neckline and colour from Spanish notes', () => {
    const a = refiner.refine(
      'Esta camisa es de lino, azul petróleo, manga larga, cuello mao y es oversize.',
    );
    expect(a.garmentType?.value).toBe('Camisa');
    expect(a.category?.value).toBe('tops');
    expect(a.material?.value).toBe('Lino');
    expect(a.sleeve?.value).toBe('Manga larga');
    expect(a.neckline?.value).toBe('Cuello mao');
    expect(a.fit?.value).toBe('Oversize');
    expect(a.primaryColorName?.value).toBe('Azul petróleo');
    // All user corrections.
    expect(a.material?.source).toBe('user');
  });

  it('maps occasion phrases to occasions + a formality cue', () => {
    const a = refiner.refine('La uso únicamente para la iglesia y eventos elegantes.');
    expect(a.occasions?.value).toContain('formal');
    expect(a.formality?.value).toBeGreaterThanOrEqual(8);
  });

  it('returns nothing for empty or unrecognised text', () => {
    expect(refiner.refine('')).toEqual({});
    expect(countPopulatedFields(refiner.refine('xyzzy qwerty'))).toBe(0);
  });
});

describe('mergeAnalyses precedence', () => {
  it('lets user override vision override baseline', () => {
    const baseline: GarmentAnalysis = {
      material: { value: 'Algodón', confidence: 0.4, source: 'baseline' },
    };
    const vision: GarmentAnalysis = {
      material: { value: 'Poliéster', confidence: 0.7, source: 'vision' },
    };
    const user: GarmentAnalysis = {
      material: { value: 'Lino', confidence: 0.95, source: 'user' },
    };
    expect(mergeAnalyses([baseline, vision, user]).material?.value).toBe('Lino');
    expect(mergeAnalyses([baseline, vision]).material?.value).toBe('Poliéster');
  });

  it('manualFieldsOnly keeps only user fields', () => {
    const a: GarmentAnalysis = {
      material: { value: 'Lino', confidence: 0.95, source: 'user' },
      primaryColor: { value: '#19284f', confidence: 0.6, source: 'baseline' },
    };
    const manual = manualFieldsOnly(a);
    expect(manual.material).toBeDefined();
    expect(manual.primaryColor).toBeUndefined();
  });
});

describe('GarmentAnalysisService', () => {
  it('merges baseline colour with free-text hints and derives a name', async () => {
    const service = new GarmentAnalysisService();
    const input: VisionAnalysisInput = {
      colorSamples: [
        { ...NAVY, weight: 12 },
        { ...NAVY, weight: 9 },
      ],
      freeText: 'Es una camisa de lino.',
    };
    const result = await service.analyze(input);
    expect(result.providers).toContain('baseline-color');
    expect(result.visionAvailable).toBe(false);
    expect(result.analysis.material?.value).toBe('Lino');
    expect(result.analysis.primaryColor?.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.analysis.suggestedName?.value.toLowerCase()).toContain('camisa');
    expect(result.analysis.suggestedName?.value.toLowerCase()).toContain('lino');
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.populatedFields).toBe(countPopulatedFields(result.analysis));
  });

  it('layers a real vision provider above the baseline', async () => {
    const fakeVision: IVisionProvider = {
      id: 'fake-vision',
      isAvailable: async () => true,
      analyze: async () => ({
        garmentType: { value: 'Chaqueta', confidence: 0.8, source: 'vision' },
        material: { value: 'Lana', confidence: 0.75, source: 'vision' },
      }),
    };
    const service = new GarmentAnalysisService([new BaselineVisionProvider(), fakeVision]);
    const result = await service.analyze({
      colorSamples: [{ ...NAVY, weight: 5 }],
    });
    expect(result.visionAvailable).toBe(true);
    expect(result.analysis.garmentType?.value).toBe('Chaqueta');
    expect(result.analysis.material?.value).toBe('Lana');
    expect(result.analysis.primaryColor?.source).toBe('baseline');
  });

  it('preserves compatible manual edits when re-analysing a replaced photo', async () => {
    const service = new GarmentAnalysisService();
    const previous: GarmentAnalysis = {
      material: { value: 'Lino', confidence: 0.95, source: 'user' },
      primaryColor: { value: '#19284f', confidence: 0.6, source: 'baseline' },
    };
    const result = await service.reanalyze(
      { colorSamples: [{ r: 200, g: 30, b: 30, weight: 5 }] },
      previous,
    );
    // Manual material survives; colour is refreshed from the new photo.
    expect(result.analysis.material?.value).toBe('Lino');
    expect(result.analysis.material?.source).toBe('user');
    expect(result.analysis.primaryColor?.value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('new hints override prior manual edits on re-analysis', async () => {
    const service = new GarmentAnalysisService();
    const previous: GarmentAnalysis = {
      material: { value: 'Lino', confidence: 0.95, source: 'user' },
    };
    const result = await service.reanalyze(
      { colorSamples: [{ ...NAVY, weight: 3 }], freeText: 'en realidad es de lana' },
      previous,
    );
    expect(result.analysis.material?.value).toBe('Lana');
  });
});

describe('overallConfidence', () => {
  it('is zero for an empty analysis', () => {
    expect(overallConfidence({})).toBe(0);
  });
});
