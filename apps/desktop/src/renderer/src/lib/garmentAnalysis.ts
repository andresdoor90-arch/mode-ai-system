/**
 * Pure helpers for the photo-first add-garment flow.
 *
 * These translate a {@link GarmentAnalysisDTO} (produced by the main process
 * vision analysis) into: (a) an editable draft the user can review/correct,
 * (b) human-readable attribute rows for the preview card, and (c) a flat string
 * metadata bag persisted on the garment. They are framework-free and fully unit
 * tested, so the analysis→UI→persistence contract is verified offline.
 *
 * Guiding rule: never invent. Unknown fields simply do not appear and are left
 * empty in the form; only the colour-picker widget keeps a neutral placeholder
 * (the native control cannot be value-less), which is NOT recorded as a fact.
 */
import type { AnalyzedFieldDTO, GarmentAnalysisDTO } from '@shared/ipc';

/**
 * Editable values backing the preview/confirm form. Every attribute Qwen2.5-VL
 * can detect has a first-class, EDITABLE field here; the dialog renders one
 * control per field and pre-fills it from the analysis. Category/subcategory are
 * NOT part of the draft — they are chosen from the user's SQLite taxonomy in the
 * dialog itself.
 */
export interface GarmentDraft {
  /** Suggested name (from the model, or derived from type + colour). */
  name: string;
  /** Kind of garment ("camisa", "pantalón", …). */
  garmentType: string;
  /** Primary colour hex (the colour baseline almost always supplies one). */
  colorHex: string;
  /** Human name for the primary colour. */
  colorName: string;
  /** Secondary colour hexes (editable swatch list). */
  secondaryColors: string[];
  material: string;
  /** Sleeve type. */
  sleeve: string;
  /** Neckline / collar type. */
  neckline: string;
  /** Pattern or print. */
  pattern: string;
  /** Style descriptor. */
  style: string;
  /** Formality on the 0–10 domain scale, as a string ('' when undetermined). */
  formality: string;
  /** Season slug ('' when undetermined). */
  season: string;
  /** Recommended occasions, comma-separated free text. */
  occasions: string;
  /** Brand (optional, model rarely detects it reliably). */
  brand: string;
  /** Free observations (optional). */
  notes: string;
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

/** A safe neutral grey used ONLY so the `<input type="color">` widget always has
 * a valid value. The colour baseline almost always provides a real hex, so this
 * fallback is essentially never shown; it is not recorded as a detected fact. */
const COLOR_WIDGET_FALLBACK = '#cccccc';

/**
 * Build the editable draft from an analysis. NOTHING is invented: every field
 * the analysis did not determine is left empty so the user sees a blank control
 * (only the colour-picker widget keeps a neutral placeholder, since the native
 * control cannot be value-less). The user reviews/edits before saving.
 */
export const analysisToDraft = (analysis: GarmentAnalysisDTO): GarmentDraft => ({
  name: analysis.suggestedName?.value ?? analysis.garmentType?.value ?? '',
  garmentType: analysis.garmentType?.value ?? '',
  colorHex: analysis.primaryColor?.value ?? COLOR_WIDGET_FALLBACK,
  colorName: analysis.primaryColorName?.value ?? '',
  secondaryColors: [...(analysis.secondaryColors?.value ?? [])],
  material: analysis.material?.value ?? '',
  sleeve: analysis.sleeve?.value ?? '',
  neckline: analysis.neckline?.value ?? '',
  pattern: analysis.pattern?.value ?? '',
  style: analysis.style?.value ?? '',
  formality: analysis.formality?.value !== undefined ? String(analysis.formality.value) : '',
  season: analysis.season?.value ?? '',
  occasions: (analysis.occasions?.value ?? []).join(', '),
  brand: '',
  notes: '',
  tags: [...(analysis.suggestedTags?.value ?? [])],
});

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
 * Flatten the EDITED draft into the string metadata bag persisted on the
 * garment (only fields that have no first-class column). This is what saves the
 * user's corrections — values come from the draft, not the raw analysis. Empty
 * fields are skipped, so an undetermined/cleared attribute is simply absent.
 */
export const draftToMetadata = (
  draft: GarmentDraft,
  overallConfidence: number,
): Record<string, string> => {
  const meta: Record<string, string> = {};
  const put = (key: string, value: string): void => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      meta[key] = trimmed;
    }
  };
  put('garmentType', draft.garmentType);
  put('pattern', draft.pattern);
  put('sleeve', draft.sleeve);
  put('neckline', draft.neckline);
  put('style', draft.style);
  put('formality', draft.formality);
  const occasions = parseTags(draft.occasions);
  if (occasions.length > 0) {
    meta['occasions'] = occasions.join(',');
  }
  if (draft.secondaryColors.length > 0) {
    meta['secondaryColors'] = draft.secondaryColors.join(',');
  }
  meta['analysisConfidence'] = overallConfidence.toFixed(2);
  return meta;
};

/**
 * Detected attributes Qwen can return that have no dedicated editable control
 * (texture, length, fit, gender). They are preserved verbatim from the analysis
 * so no detected information is lost; the detail view surfaces them. Skipped
 * when not determined.
 */
export const analysisPassthroughMetadata = (
  analysis: GarmentAnalysisDTO,
): Record<string, string> => {
  const meta: Record<string, string> = {};
  const put = (key: string, field: AnalyzedFieldDTO<string | number> | undefined): void => {
    if (field !== undefined && String(field.value).trim().length > 0) {
      meta[key] = String(field.value).trim();
    }
  };
  put('texture', analysis.texture);
  put('length', analysis.length);
  put('fit', analysis.fit);
  put('gender', analysis.gender);
  return meta;
};

/** Split/normalise a comma-separated string into a clean, trimmed list. */
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
