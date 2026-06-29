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

/** Normalise a key/value token for tolerant matching. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Flatten a JSON object into a normalised-key → value map, descending one level
 * into nested objects (so `{ "garment": { "type": … } }` and `{ "tipo": … }`
 * resolve the same). Top-level keys take precedence over nested ones.
 */
const flattenKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
  const map: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const nk = norm(k);
    if (!(nk in map)) {
      map[nk] = v;
    }
  }
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        const nk = norm(k2);
        if (!(nk in map)) {
          map[nk] = v2;
        }
      }
    }
  }
  return map;
};

/** First present, non-empty value among the (normalised) alias keys. */
const pick = (map: Record<string, unknown>, aliases: readonly string[]): unknown => {
  for (const alias of aliases) {
    const v = map[alias];
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim().length === 0)) {
      return v;
    }
  }
  return undefined;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0
    ? v.trim()
    : typeof v === 'number'
      ? String(v)
      : undefined;

const hex = (v: unknown): string | undefined => {
  const s = str(v);
  if (s === undefined) {
    return undefined;
  }
  const m = /#?([0-9a-fA-F]{6})\b/.exec(s);
  const group = m?.[1];
  return group === undefined ? undefined : `#${group.toLowerCase()}`;
};

const strArray = (v: unknown): string[] | undefined => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]/) : [];
  const items = raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
  return items.length > 0 ? items : undefined;
};

const hexArray = (v: unknown): string[] | undefined => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]/) : [];
  const items = raw.map(hex).filter((x): x is string => x !== undefined);
  return items.length > 0 ? items : undefined;
};

const num0to10 = (v: unknown): number | undefined => {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? Number(v.replace(/[^0-9.]/g, ''))
        : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : undefined;
};

const CATEGORY_SYNONYMS: ReadonlyArray<readonly [match: RegExp, slug: string]> = [
  [/dress|vestido/, 'dresses'],
  [
    /(out|abrigo|chaqueta|jacket|blazer|saco|coat|parka|cardigan|chaleco|vest|gabardina)/,
    'outerwear',
  ],
  [/(shoe|zapat|tenis|zapatill|sneaker|bota|boot|mocasin|sandal)/, 'shoes'],
  [
    /(accessor|accesori|corbata|tie|cinturon|belt|gorra|hat|cap|sombrero|reloj|watch|bufanda|scarf|bolso|bag|gafa|lente|glass)/,
    'accessories',
  ],
  [/(bottom|pantalon|pant|trouser|jean|short|falda|skirt|chino|legging)/, 'bottoms'],
  [/(top|camis|shirt|tshirt|polo|blus|sueter|sweater|hoodie|sudadera|tank)/, 'tops'],
];

/** Map a free category/type value to one of the domain category slugs. */
const toCategorySlug = (v: unknown): string | undefined => {
  const s = str(v);
  if (s === undefined) {
    return undefined;
  }
  const n = norm(s);
  if (['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses'].includes(n)) {
    return n;
  }
  return CATEGORY_SYNONYMS.find(([re]) => re.test(n))?.[1];
};

const SEASON_SYNONYMS: ReadonlyArray<readonly [match: RegExp, slug: string]> = [
  [/(allseason|alltime|todoelano|todaslasestaciones|cualquier)/, 'all-season'],
  [/(summer|verano|calor)/, 'summer'],
  [/(winter|invierno|frio)/, 'winter'],
  [/(spring|primavera)/, 'spring'],
  [/(autumn|fall|otono)/, 'autumn'],
];

const toSeasonSlug = (v: unknown): string | undefined => {
  const s = str(v);
  return s === undefined ? undefined : SEASON_SYNONYMS.find(([re]) => re.test(norm(s)))?.[1];
};

/**
 * Map a model's JSON object to a (vision-sourced) GarmentAnalysis, tolerant of
 * the key/value variations real models emit (Spanish/English keys, snake_case,
 * camelCase, one level of nesting, colour names vs hex, category/season
 * synonyms). Only fields with a real value are emitted — never fabricated.
 */
export const parseGarmentVisionResponse = (content: string): GarmentAnalysis => {
  const json = extractJson(content);
  if (json === null) {
    return {};
  }
  const map = flattenKeys(json);
  const out: Record<string, AnalyzedField<unknown>> = {};
  const put = (key: string, value: unknown): void => {
    if (value !== undefined) {
      out[key] = field(value);
    }
  };

  put(
    'suggestedName',
    str(pick(map, ['suggestedname', 'name', 'nombre', 'nombresugerido', 'titulo'])),
  );
  const typeValue = pick(map, [
    'garmenttype',
    'type',
    'tipo',
    'tipodeprenda',
    'tipoprenda',
    'prenda',
    'clothingtype',
  ]);
  put('garmentType', str(typeValue));
  put(
    'category',
    toCategorySlug(pick(map, ['category', 'categoria'])) ?? toCategorySlug(typeValue),
  );
  put('subcategory', str(pick(map, ['subcategory', 'subcategoria'])));

  const colorValue = pick(map, [
    'primarycolor',
    'color',
    'colorhex',
    'hex',
    'colorprincipal',
    'maincolor',
  ]);
  put('primaryColor', hex(colorValue));
  const explicitName = str(
    pick(map, [
      'primarycolorname',
      'colorname',
      'nombrecolor',
      'nombredelcolor',
      'colorprincipalnombre',
    ]),
  );
  put(
    'primaryColorName',
    explicitName ?? (hex(colorValue) === undefined ? str(colorValue) : undefined),
  );

  put(
    'secondaryColors',
    hexArray(
      pick(map, ['secondarycolors', 'secondarycolours', 'coloressecundarios', 'colorssecundarios']),
    ),
  );
  put('material', str(pick(map, ['material', 'materialaproximado', 'fabric', 'tela'])));
  put('pattern', str(pick(map, ['pattern', 'patron', 'estampado', 'print'])));
  put('texture', str(pick(map, ['texture', 'textura'])));
  put(
    'sleeve',
    str(pick(map, ['sleeve', 'sleeves', 'manga', 'mangas', 'sleevelength', 'tipodemanga'])),
  );
  put('length', str(pick(map, ['length', 'largo', 'longitud'])));
  put('neckline', str(pick(map, ['neckline', 'cuello', 'collar', 'tipodecuello', 'escote'])));
  put('fit', str(pick(map, ['fit', 'corte', 'ajuste', 'silueta'])));
  put('style', str(pick(map, ['style', 'estilo'])));
  put(
    'formality',
    num0to10(pick(map, ['formality', 'formalidad', 'niveldeformalidad', 'formalitylevel'])),
  );
  put('season', toSeasonSlug(pick(map, ['season', 'temporada', 'estacion'])));
  put('gender', str(pick(map, ['gender', 'genero', 'sexo'])));
  put(
    'occasions',
    strArray(pick(map, ['occasions', 'ocasiones', 'ocasionesrecomendadas', 'occasion', 'eventos'])),
  );
  put(
    'suggestedTags',
    strArray(pick(map, ['tags', 'etiquetas', 'etiquetassugeridas', 'keywords', 'labels'])),
  );
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
  /** The exact installed model name resolved from the server (tag-tolerant). */
  private resolvedModel: string | null = null;

  public constructor(config: OllamaVisionProviderConfig) {
    this.client = config.client;
    this.model = config.model;
  }

  /**
   * Pick the installed model that best matches the configured one: an exact
   * match wins, otherwise any model sharing the same base name (so a configured
   * `qwen2.5vl:7b` still resolves to an installed `qwen2.5vl:latest`, etc.).
   */
  private pickInstalledModel(installed: readonly string[]): string | null {
    const exact = installed.find((m) => m === this.model || m.startsWith(`${this.model}:`));
    if (exact !== undefined) {
      return exact;
    }
    const base = this.model.split(':')[0] ?? this.model;
    return installed.find((m) => (m.split(':')[0] ?? m) === base) ?? null;
  }

  /** Available when the server is reachable and a matching model is installed. */
  public async isAvailable(): Promise<boolean> {
    const models = await this.client.listModels();
    this.resolvedModel = this.pickInstalledModel(models);
    return this.resolvedModel !== null;
  }

  public async analyze(input: VisionAnalysisInput): Promise<GarmentAnalysis> {
    const base64 = input.image?.base64;
    if (base64 === undefined || base64.length === 0) {
      return {};
    }
    try {
      const result = await this.client.chat({
        model: this.resolvedModel ?? this.model,
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
