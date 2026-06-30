import { describe, expect, it } from 'vitest';

import { parseGarmentVisionResponse } from '@mas/infrastructure/ai/OllamaVisionProvider';
import type { GarmentAnalysisDTO } from '@shared/ipc';

import {
  analysisToDraft,
  applicableAttributes,
  confidencePercent,
  describeAnalysis,
  draftToMetadata,
  garmentDetailAttributes,
  parseTags,
  sourceLabel,
} from './garmentAnalysis';

const ANALYSIS: GarmentAnalysisDTO = {
  suggestedName: { value: 'Camisa de lino azul petróleo', confidence: 0.7, source: 'user' },
  garmentType: { value: 'Camisa', confidence: 0.9, source: 'user' },
  category: { value: 'tops', confidence: 0.9, source: 'user' },
  subcategory: { value: 'shirt', confidence: 0.9, source: 'user' },
  subtype: { value: 'Oxford', confidence: 0.7, source: 'vision' },
  primaryColor: { value: '#235a6e', confidence: 0.6, source: 'baseline' },
  primaryColorName: { value: 'Azul petróleo', confidence: 0.9, source: 'user' },
  secondaryColors: { value: ['#1a1a1a'], confidence: 0.5, source: 'baseline' },
  material: { value: 'Lino', confidence: 0.95, source: 'user' },
  sleeve: { value: 'Manga larga', confidence: 0.95, source: 'user' },
  neckline: { value: 'Cuello mao', confidence: 0.95, source: 'user' },
  formality: { value: 9, confidence: 0.85, source: 'user' },
  occasions: { value: ['formal'], confidence: 0.9, source: 'user' },
  brand: { value: 'Uniqlo', confidence: 0.7, source: 'vision' },
  notes: { value: 'Ideal para clima templado', confidence: 0.6, source: 'vision' },
  suggestedTags: { value: ['Lino', 'formal'], confidence: 0.85, source: 'user' },
};

describe('analysisToDraft', () => {
  it('fills the draft from the analysis', () => {
    const draft = analysisToDraft(ANALYSIS);
    expect(draft.name).toBe('Camisa de lino azul petróleo');
    expect(draft.colorHex).toBe('#235a6e');
    expect(draft.colorName).toBe('Azul petróleo');
    expect(draft.material).toBe('Lino');
    expect(draft.subtype).toBe('Oxford');
    expect(draft.sleeve).toBe('Manga larga');
    expect(draft.neckline).toBe('Cuello mao');
    expect(draft.formality).toBe('9');
    expect(draft.occasions).toBe('formal');
    expect(draft.secondaryColors).toEqual(['#1a1a1a']);
    expect(draft.brand).toBe('Uniqlo');
    expect(draft.notes).toBe('Ideal para clima templado');
    expect(draft.tags).toEqual(['Lino', 'formal']);
  });

  it('leaves undetermined fields empty (never invents a value)', () => {
    const draft = analysisToDraft({});
    expect(draft.name).toBe('');
    expect(draft.colorName).toBe('');
    expect(draft.secondaryColors).toEqual([]);
    expect(draft.material).toBe('');
    expect(draft.subtype).toBe('');
    expect(draft.sleeve).toBe('');
    expect(draft.neckline).toBe('');
    expect(draft.pattern).toBe('');
    expect(draft.style).toBe('');
    expect(draft.formality).toBe('');
    expect(draft.season).toBe('');
    expect(draft.occasions).toBe('');
    expect(draft.brand).toBe('');
    expect(draft.notes).toBe('');
    expect(draft.tags).toEqual([]);
  });
});

describe('applicableAttributes (dynamic form fields)', () => {
  it('prefers the model\u2019s relevant-attribute list (Spanish tokens)', () => {
    // A belt: the model says only colours/material/style/formality matter.
    const set = applicableAttributes('accessory', [
      'coloresSecundarios',
      'material',
      'estilo',
      'formalidad',
    ]);
    expect(set.has('secondaryColors')).toBe(true);
    // sleeve/neckline/pattern are NOT relevant for a belt → hidden.
    expect(set.has('sleeve')).toBe(false);
    expect(set.has('neckline')).toBe(false);
    expect(set.has('pattern')).toBe(false);
  });

  it('falls back to the category zone when the model gives no list', () => {
    const shirt = applicableAttributes('upper-body', undefined);
    expect(shirt.has('sleeve')).toBe(true);
    expect(shirt.has('neckline')).toBe(true);
    expect(shirt.has('pattern')).toBe(true);

    const shoes = applicableAttributes('feet', undefined);
    expect(shoes.has('subtype')).toBe(true);
    expect(shoes.has('sleeve')).toBe(false);
    expect(shoes.has('neckline')).toBe(false);
  });

  it('shows all optional fields when neither signal is available', () => {
    const set = applicableAttributes(undefined, undefined);
    expect(set.has('sleeve')).toBe(true);
    expect(set.has('subtype')).toBe(true);
    expect(set.has('occasions')).toBe(true);
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

describe('draftToMetadata', () => {
  it('persists the EDITED draft values into the metadata bag, skipping empties', () => {
    const draft = analysisToDraft(ANALYSIS);
    draft.style = 'Clásico'; // a user edit
    draft.pattern = ''; // a cleared field
    const meta = draftToMetadata(draft, 0.82);
    expect(meta.sleeve).toBe('Manga larga');
    expect(meta.neckline).toBe('Cuello mao');
    expect(meta.style).toBe('Clásico');
    expect(meta.formality).toBe('9');
    expect(meta.occasions).toBe('formal');
    expect(meta.secondaryColors).toBe('#1a1a1a');
    expect(meta.analysisConfidence).toBe('0.82');
    // Cleared/undetermined fields are simply absent.
    expect(meta.pattern).toBeUndefined();
    // The garment type is owned by the user's categories — never AI-persisted.
    expect(meta.garmentType).toBeUndefined();
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

  it('parses comma-separated lists', () => {
    expect(parseTags(' work , , classic ')).toEqual(['work', 'classic']);
  });
});

describe('end-to-end: Qwen2.5-VL response → auto-filled form', () => {
  it('parses a realistic vision JSON and fills every detectable field', () => {
    const raw = JSON.stringify({
      suggestedName: 'Camisa azul oscuro manga larga',
      garmentType: 'Camisa',
      category: 'tops',
      primaryColor: '#1b2a4a',
      primaryColorName: 'Azul oscuro',
      secondaryColors: ['#ffffff'],
      material: 'Algodón',
      sleeve: 'Manga larga',
      neckline: 'Cuello clásico',
      pattern: 'Liso',
      style: 'Formal',
      formality: 7,
      season: 'all-season',
      occasions: ['trabajo', 'formal'],
      marca: 'Zara',
      observaciones: 'Combina bien con pantalón beige',
      tags: ['oficina', 'clásico'],
    });
    const analysis = parseGarmentVisionResponse(raw) as unknown as GarmentAnalysisDTO;
    const draft = analysisToDraft(analysis);
    expect(draft.name).toBe('Camisa azul oscuro manga larga');
    expect(draft.colorHex).toBe('#1b2a4a');
    expect(draft.colorName).toBe('Azul oscuro');
    expect(draft.secondaryColors).toEqual(['#ffffff']);
    expect(draft.material).toBe('Algodón');
    expect(draft.sleeve).toBe('Manga larga');
    expect(draft.neckline).toBe('Cuello clásico');
    expect(draft.pattern).toBe('Liso');
    expect(draft.style).toBe('Formal');
    expect(draft.formality).toBe('7');
    expect(draft.season).toBe('all-season');
    expect(draft.occasions).toBe('trabajo, formal');
    expect(draft.brand).toBe('Zara');
    expect(draft.notes).toBe('Combina bien con pantalón beige');
    expect(draft.tags).toEqual(['oficina', 'clásico']);
  });

  it('fills what it detects (Spanish keys) and leaves the rest empty', () => {
    const raw = JSON.stringify({
      tipo: 'Pantalón',
      color_principal: 'Beige',
      material: 'Lino',
      marca: 'desconocida',
    });
    const analysis = parseGarmentVisionResponse(raw) as unknown as GarmentAnalysisDTO;
    const draft = analysisToDraft(analysis);
    expect(draft.colorName).toBe('Beige');
    expect(draft.material).toBe('Lino');
    // Undetected attributes stay empty — never guessed.
    expect(draft.sleeve).toBe('');
    expect(draft.neckline).toBe('');
    expect(draft.pattern).toBe('');
    expect(draft.season).toBe('');
    expect(draft.formality).toBe('');
    // "desconocida" is an unknown sentinel → brand stays empty, never shown.
    expect(draft.brand).toBe('');
  });
});
