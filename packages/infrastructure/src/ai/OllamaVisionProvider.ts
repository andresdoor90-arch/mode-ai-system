import {
  type AnalyzedField,
  type GarmentAnalysis,
  type IVisionProvider,
  type VisionAnalysisInput,
} from '@mas/core';

import { OllamaClient, type OllamaChatMessage } from './OllamaClient';

/**
 * Garment photo analysis backed by a local Ollama vision model (e.g. `llava`,
 * `llama3.2-vision`). Implements the core {@link IVisionProvider} port so it
 * plugs into the `GarmentAnalysisService` alongside the offline colour baseline
 * — its richer fields (type, sleeve, neckline, pattern, material, formality, …)
 * layer on top of the baseline, and the user's manual edits still win.
 *
 * It NEVER fabricates: it asks the model for strict JSON and only emits fields
 * the model actually returned with a value. Any transport/parse failure yields
 * an empty analysis so the colour baseline still applies — no crashes, no
 * guesses, full graceful degradation when Ollama is absent.
 */

const VISION_CONFIDENCE = 0.72;

/** System instruction: behave like a fashion cataloguer, output strict JSON. */
export const VISION_SYSTEM_PROMPT =
  'Eres un catalogador de moda. Analiza la prenda de la fotografía y responde ' +
  'ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown. ' +
  'Usa estas claves (omite o usa null las que no puedas determinar con seguridad; ' +
  'NO inventes): ' +
  'garmentType (string, p.ej. "camisa","pantalón","zapatos"), ' +
  'category (uno de: tops,bottoms,outerwear,shoes,accessories,dresses), ' +
  'subcategory (string), primaryColorName (string), primaryColor (hex #rrggbb), ' +
  'secondaryColors (array de hex), material (string), pattern (uno de: liso,rayas,cuadros,lunares,estampado), ' +
  'texture (string), sleeve (string), length (string), neckline (string), fit (string), ' +
  'style (string), formality (número 0-10), season (uno de: spring,summer,autumn,winter,all-season), ' +
  'gender (male,female,unisex), occasions (array), tags (array de strings), ' +
  'suggestedName (nombre corto y útil, p.ej. "Camisa azul oscuro manga larga").';

/** Build the chat messages for analysing a garment image. */
export const buildGarmentVisionMessages = (base64: string): OllamaChatMessage[] => [
  { role: 'system', content: VISION_SYSTEM_PROMPT },
  {
    role: 'user',
    content: 'Analiza esta prenda y devuelve el JSON solicitado.',
    images: [base64],
  },
];

/** Extract the first JSON object from a model response (tolerates fences/prose). */
const extractJson = (text: string): Record<string, unknown> | null => {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(s);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text.trim());
  if (direct !== null) {
    return direct;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return tryParse(text.slice(start, end + 1));
  }
  return null;
};

const field = <T>(value: T): AnalyzedField<T> => ({
  value,
  confidence: VISION_CONFIDENCE,
  source: 'vision',
});

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

const hex = (v: unknown): string | undefined => {
  const s = str(v);
  if (s === undefined) {
    return undefined;
  }
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  const group = m?.[1];
  return group === undefined ? undefined : `#${group.toLowerCase()}`;
};

const strArray = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) {
    return undefined;
  }
  const items = v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
  return items.length > 0 ? items : undefined;
};

const hexArray = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) {
    return undefined;
  }
  const items = v.map(hex).filter((x): x is string => x !== undefined);
  return items.length > 0 ? items : undefined;
};

const num0to10 = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : undefined;
};

/** Map a model's JSON object to a (vision-sourced) GarmentAnalysis. */
export const parseGarmentVisionResponse = (content: string): GarmentAnalysis => {
  const json = extractJson(content);
  if (json === null) {
    return {};
  }
  const out: Record<string, AnalyzedField<unknown>> = {};
  const put = (key: string, value: unknown): void => {
    if (value !== undefined) {
      out[key] = field(value);
    }
  };
  put('suggestedName', str(json.suggestedName));
  put('garmentType', str(json.garmentType));
  put('category', str(json.category));
  put('subcategory', str(json.subcategory));
  put('primaryColor', hex(json.primaryColor));
  put('primaryColorName', str(json.primaryColorName));
  put('secondaryColors', hexArray(json.secondaryColors));
  put('material', str(json.material));
  put('pattern', str(json.pattern));
  put('texture', str(json.texture));
  put('sleeve', str(json.sleeve));
  put('length', str(json.length));
  put('neckline', str(json.neckline));
  put('fit', str(json.fit));
  put('style', str(json.style));
  put('formality', num0to10(json.formality));
  put('season', str(json.season));
  put('gender', str(json.gender));
  put('occasions', strArray(json.occasions));
  put('suggestedTags', strArray(json.tags));
  return out as GarmentAnalysis;
};

export interface OllamaVisionProviderConfig {
  readonly client: OllamaClient;
  /** Vision-capable model name, e.g. `llava` or `llama3.2-vision`. */
  readonly model: string;
}

export class OllamaVisionProvider implements IVisionProvider {
  public readonly id = 'ollama-vision';
  private readonly client: OllamaClient;
  private readonly model: string;

  public constructor(config: OllamaVisionProviderConfig) {
    this.client = config.client;
    this.model = config.model;
  }

  /** Available when the server is reachable and the vision model is installed. */
  public async isAvailable(): Promise<boolean> {
    const models = await this.client.listModels();
    return models.some((m) => m === this.model || m.startsWith(`${this.model}:`));
  }

  public async analyze(input: VisionAnalysisInput): Promise<GarmentAnalysis> {
    const base64 = input.image?.base64;
    if (base64 === undefined || base64.length === 0) {
      return {};
    }
    try {
      const result = await this.client.chat({
        model: this.model,
        format: 'json',
        messages: buildGarmentVisionMessages(base64),
      });
      return parseGarmentVisionResponse(result.content);
    } catch {
      // Transport/model failure → defer entirely to the colour baseline.
      return {};
    }
  }
}
