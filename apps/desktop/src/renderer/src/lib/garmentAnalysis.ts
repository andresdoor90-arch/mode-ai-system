/**
 * Pure helpers for the photo-first add-garment flow.
 *
 * These translate a {@link GarmentAnalysisDTO} (produced by the main process
 * vision analysis) into: (a) an editable draft the user can review/correct,
 * (b) human-readable attribute rows for the preview card, and (c) a flat string
 * metadata bag persisted on the garment. They are framework-free and fully unit
 * tested, so the analysis→UI→persistence contract is verified offline.
 *
 * Guiding rule: never invent. Unknown fields simply do not appear; only
 * category/subcategory/colour carry safe UI defaults (the user always reviews
 * before saving), and those defaults are NOT written as analysis facts.
 */
import type { AnalyzedFieldDTO, GarmentAnalysisDTO } from '@shared/ipc';

import { SUBCATEGORY_OPTIONS } from '../data/wardrobeOptions';

/** Editable values backing the preview/confirm form. */
export interface GarmentDraft {
  name: string;
  category: string;
  subcategory: string;
  colorHex: string;
  colorName: string;
  material: string;
  season: string;
  tags: string[];
}

/** A single attribute shown on the preview card. */
export interface AttributeRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly source: AnalyzedFieldDTO<unknown>['source'];
  readonly confidence: number;
}

const SEASON_LABELS: Readonly<Record<string, string>> = {
  spring: 'Primavera',
  summer: 'Verano',
  autumn: 'Otoño',
  winter: 'Invierno',
  'all-season': 'Todo el año',
};

const GENDER_LABELS: Readonly<Record<string, string>> = {
  male: 'Hombre',
  female: 'Mujer',
  unisex: 'Unisex',
};

const OCCASION_LABELS: Readonly<Record<string, string>> = {
  casual: 'Casual',
  business: 'Trabajo',
  formal: 'Formal',
  sport: 'Deporte',
  party: 'Fiesta',
  date: 'Cita',
  travel: 'Viaje',
  home: 'Casa',
};

const seasonLabel = (slug: string): string => SEASON_LABELS[slug] ?? slug;
const genderLabel = (slug: string): string => GENDER_LABELS[slug] ?? slug;
const occasionLabel = (slug: string): string => OCCASION_LABELS[slug] ?? slug;

/** Format a confidence (0–1) as a rounded percentage string. */
export const confidencePercent = (confidence: number): string =>
  `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;

/** Friendly Spanish label for an analysis source. */
export const sourceLabel = (source: AnalyzedFieldDTO<unknown>['source']): string => {
  switch (source) {
    case 'user':
      return 'Tú';
    case 'vision':
      return 'IA';
    case 'baseline':
      return 'Color';
    default:
      return '';
  }
};

const firstSubcategory = (category: string): string =>
  SUBCATEGORY_OPTIONS[category]?.[0]?.value ?? '';

/**
 * Build the editable draft from an analysis. Category/subcategory/colour fall
 * back to safe UI defaults (reviewed before save); everything else is left
 * blank when the analysis did not determine it.
 */
export const analysisToDraft = (analysis: GarmentAnalysisDTO): GarmentDraft => {
  const category = analysis.category?.value ?? 'tops';
  const subcategory = analysis.subcategory?.value ?? firstSubcategory(category);
  return {
    name: analysis.suggestedName?.value ?? analysis.garmentType?.value ?? '',
    category,
    subcategory,
    colorHex: analysis.primaryColor?.value ?? '#9aa0a6',
    colorName: analysis.primaryColorName?.value ?? '',
    material: analysis.material?.value ?? '',
    season: analysis.season?.value ?? 'all-season',
    tags: [...(analysis.suggestedTags?.value ?? [])],
  };
};

/** The detected attributes to display, in a stable order (only populated). */
export const describeAnalysis = (analysis: GarmentAnalysisDTO): AttributeRow[] => {
  const rows: AttributeRow[] = [];
  const add = (
    key: string,
    label: string,
    field: AnalyzedFieldDTO<string | number> | undefined,
    format: (v: string | number) => string = String,
  ): void => {
    if (field !== undefined && String(field.value).length > 0) {
      rows.push({
        key,
        label,
        value: format(field.value),
        source: field.source,
        confidence: field.confidence,
      });
    }
  };

  add('garmentType', 'Tipo', analysis.garmentType);
  add('material', 'Material', analysis.material);
  add('pattern', 'Patrón', analysis.pattern);
  add('texture', 'Textura', analysis.texture);
  add('sleeve', 'Manga', analysis.sleeve);
  add('length', 'Largo', analysis.length);
  add('neckline', 'Cuello', analysis.neckline);
  add('fit', 'Corte', analysis.fit);
  add('style', 'Estilo', analysis.style);
  add('formality', 'Formalidad', analysis.formality, (v) => `${v}/10`);
  add('season', 'Temporada', analysis.season, (v) => seasonLabel(String(v)));
  add('gender', 'Género', analysis.gender, (v) => genderLabel(String(v)));

  if (analysis.occasions !== undefined && analysis.occasions.value.length > 0) {
    rows.push({
      key: 'occasions',
      label: 'Ocasiones',
      value: analysis.occasions.value.map(occasionLabel).join(', '),
      source: analysis.occasions.source,
      confidence: analysis.occasions.confidence,
    });
  }
  return rows;
};

/**
 * Flatten the rich analysis into a string metadata bag persisted on the garment
 * (only fields that have no first-class column). Secondary colours and the
 * overall confidence are recorded too. Skips anything not determined.
 */
export const buildGarmentMetadata = (
  analysis: GarmentAnalysisDTO,
  overallConfidence: number,
): Record<string, string> => {
  const meta: Record<string, string> = {};
  const put = (key: string, field: AnalyzedFieldDTO<string | number> | undefined): void => {
    if (field !== undefined && String(field.value).length > 0) {
      meta[key] = String(field.value);
    }
  };
  put('garmentType', analysis.garmentType);
  put('pattern', analysis.pattern);
  put('texture', analysis.texture);
  put('sleeve', analysis.sleeve);
  put('length', analysis.length);
  put('neckline', analysis.neckline);
  put('fit', analysis.fit);
  put('style', analysis.style);
  put('formality', analysis.formality);
  put('gender', analysis.gender);
  if (analysis.occasions !== undefined && analysis.occasions.value.length > 0) {
    meta['occasions'] = analysis.occasions.value.join(',');
  }
  if (analysis.secondaryColors !== undefined && analysis.secondaryColors.value.length > 0) {
    meta['secondaryColors'] = analysis.secondaryColors.value.join(',');
  }
  meta['analysisConfidence'] = overallConfidence.toFixed(2);
  return meta;
};

/** Secondary colour hexes from the analysis (empty when none detected). */
export const secondaryColorHexes = (analysis: GarmentAnalysisDTO): string[] =>
  analysis.secondaryColors !== undefined ? [...analysis.secondaryColors.value] : [];

/** Split/normalise a comma-separated tag string into a clean list. */
export const parseTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

/** A label/value row for the garment detail view. */
export interface DetailRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

const META_LABELS: ReadonlyArray<readonly [key: string, label: string]> = [
  ['garmentType', 'Tipo'],
  ['pattern', 'Patrón'],
  ['texture', 'Textura'],
  ['sleeve', 'Manga'],
  ['length', 'Largo'],
  ['neckline', 'Cuello'],
  ['fit', 'Corte'],
  ['style', 'Estilo'],
  ['gender', 'Género'],
];

/**
 * Build the attribute rows shown in the detail view from a stored garment's
 * first-class fields plus its rich metadata bag. Only populated values appear.
 */
export const garmentDetailAttributes = (garment: {
  material: string | null;
  color: { name: string };
  formality: number;
  seasons: readonly string[];
  metadata?: Readonly<Record<string, string>>;
}): DetailRow[] => {
  const rows: DetailRow[] = [];
  const meta = garment.metadata ?? {};

  if (meta.garmentType !== undefined && meta.garmentType.length > 0) {
    rows.push({ key: 'garmentType', label: 'Tipo', value: meta.garmentType });
  }
  rows.push({ key: 'color', label: 'Color', value: garment.color.name });
  if (garment.material !== null && garment.material.length > 0) {
    rows.push({ key: 'material', label: 'Material', value: garment.material });
  }
  for (const [key, label] of META_LABELS) {
    if (key === 'garmentType') {
      continue;
    }
    const value = meta[key];
    if (value !== undefined && value.length > 0) {
      rows.push({ key, label, value: key === 'gender' ? genderLabel(value) : value });
    }
  }
  if (meta.formality !== undefined && meta.formality.length > 0) {
    rows.push({ key: 'formality', label: 'Formalidad', value: `${meta.formality}/10` });
  } else {
    rows.push({ key: 'formality', label: 'Formalidad', value: `${garment.formality}/10` });
  }
  if (meta.occasions !== undefined && meta.occasions.length > 0) {
    rows.push({
      key: 'occasions',
      label: 'Ocasiones',
      value: meta.occasions
        .split(',')
        .map((o) => occasionLabel(o.trim()))
        .join(', '),
    });
  }
  if (garment.seasons.length > 0) {
    rows.push({
      key: 'seasons',
      label: 'Temporada',
      value: garment.seasons.map(seasonLabel).join(', '),
    });
  }
  return rows;
};
