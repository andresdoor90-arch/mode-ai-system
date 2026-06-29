import { describe, expect, it } from 'vitest';

import type { GarmentAnalysisDTO } from '@shared/ipc';

import {
  analysisToDraft,
  buildGarmentMetadata,
  confidencePercent,
  describeAnalysis,
  garmentDetailAttributes,
  parseTags,
  secondaryColorHexes,
  sourceLabel,
} from './garmentAnalysis';

const ANALYSIS: GarmentAnalysisDTO = {
  suggestedName: { value: 'Camisa de lino azul petróleo', confidence: 0.7, source: 'user' },
  garmentType: { value: 'Camisa', confidence: 0.9, source: 'user' },
  category: { value: 'tops', confidence: 0.9, source: 'user' },
  subcategory: { value: 'shirt', confidence: 0.9, source: 'user' },
  primaryColor: { value: '#235a6e', confidence: 0.6, source: 'baseline' },
  primaryColorName: { value: 'Azul petróleo', confidence: 0.9, source: 'user' },
  secondaryColors: { value: ['#1a1a1a'], confidence: 0.5, source: 'baseline' },
  material: { value: 'Lino', confidence: 0.95, source: 'user' },
  sleeve: { value: 'Manga larga', confidence: 0.95, source: 'user' },
  neckline: { value: 'Cuello mao', confidence: 0.95, source: 'user' },
  formality: { value: 9, confidence: 0.85, source: 'user' },
  occasions: { value: ['formal'], confidence: 0.9, source: 'user' },
  suggestedTags: { value: ['Lino', 'formal'], confidence: 0.85, source: 'user' },
};

describe('analysisToDraft', () => {
  it('fills the draft from the analysis', () => {
    const draft = analysisToDraft(ANALYSIS);
    expect(draft.name).toBe('Camisa de lino azul petróleo');
    expect(draft.category).toBe('tops');
    expect(draft.subcategory).toBe('shirt');
    expect(draft.colorHex).toBe('#235a6e');
    expect(draft.material).toBe('Lino');
    expect(draft.tags).toEqual(['Lino', 'formal']);
  });

  it('uses safe UI defaults when fields are unknown (without inventing facts)', () => {
    const draft = analysisToDraft({});
    expect(draft.name).toBe('');
    expect(draft.category).toBe('tops');
    expect(draft.subcategory).toBe('t-shirt');
    expect(draft.material).toBe('');
    expect(draft.season).toBe('all-season');
    expect(draft.tags).toEqual([]);
  });
});

describe('describeAnalysis', () => {
  it('lists only populated attributes with localised values', () => {
    const rows = describeAnalysis(ANALYSIS);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.material).toBe('Lino');
    expect(byKey.sleeve).toBe('Manga larga');
    expect(byKey.formality).toBe('9/10');
    expect(byKey.occasions).toBe('Formal');
    // Unknowns are absent.
    expect(byKey.texture).toBeUndefined();
  });

  it('is empty for an empty analysis', () => {
    expect(describeAnalysis({})).toEqual([]);
  });
});

describe('buildGarmentMetadata', () => {
  it('flattens rich fields + confidence, skipping unknowns', () => {
    const meta = buildGarmentMetadata(ANALYSIS, 0.82);
    expect(meta.sleeve).toBe('Manga larga');
    expect(meta.neckline).toBe('Cuello mao');
    expect(meta.formality).toBe('9');
    expect(meta.occasions).toBe('formal');
    expect(meta.secondaryColors).toBe('#1a1a1a');
    expect(meta.analysisConfidence).toBe('0.82');
    expect(meta.texture).toBeUndefined();
  });
});

describe('garmentDetailAttributes', () => {
  it('builds rows from first-class fields + metadata, localising occasions', () => {
    const rows = garmentDetailAttributes({
      material: 'Lino',
      color: { name: 'Azul petróleo' },
      formality: 6,
      seasons: ['summer', 'all-season'],
      metadata: {
        garmentType: 'Camisa',
        sleeve: 'Manga larga',
        occasions: 'formal,business',
        formality: '9',
      },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.garmentType).toBe('Camisa');
    expect(byKey.color).toBe('Azul petróleo');
    expect(byKey.material).toBe('Lino');
    expect(byKey.sleeve).toBe('Manga larga');
    expect(byKey.formality).toBe('9/10');
    expect(byKey.occasions).toBe('Formal, Trabajo');
    expect(byKey.seasons).toBe('Verano, Todo el año');
  });

  it('falls back to the field formality when metadata has none', () => {
    const rows = garmentDetailAttributes({
      material: null,
      color: { name: 'Negro' },
      formality: 4,
      seasons: [],
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.formality).toBe('4/10');
    expect(byKey.material).toBeUndefined();
  });
});

describe('misc helpers', () => {
  it('formats confidence and source labels', () => {
    expect(confidencePercent(0.823)).toBe('82%');
    expect(confidencePercent(2)).toBe('100%');
    expect(sourceLabel('user')).toBe('Tú');
    expect(sourceLabel('vision')).toBe('IA');
  });

  it('extracts secondary colours and parses tags', () => {
    expect(secondaryColorHexes(ANALYSIS)).toEqual(['#1a1a1a']);
    expect(secondaryColorHexes({})).toEqual([]);
    expect(parseTags(' work , , classic ')).toEqual(['work', 'classic']);
  });
});
