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

/**
 * System instruction: act like a fashion cataloguer and emit STRICT JSON only.
 * Kept short on purpose — vision models attend better to the instruction that
 * travels in the same user turn as the image (see {@link buildGarmentVisionMessages}).
 */
export const VISION_SYSTEM_PROMPT =
  'Eres un catalogador de moda experto. Observa ÚNICAMENTE la prenda principal ' +
  'de la fotografía e ignora por completo el fondo, la piel, el cuerpo y otros ' +
  'objetos. Responde solo con un objeto JSON válido, sin markdown ni texto extra. ' +
  'No inventes: si no puedes determinar un dato con seguridad, omite esa clave.';

/**
 * The per-image instruction. It lists exactly the attributes the product wants
 * filled and asks the model to (a) CHOOSE the best-matching USER category from
 * the list we pass in (contextual classification — no fixed taxonomy), (b)
 * report which attributes are RELEVANT for this garment so the form can show
 * only those, and (c) fill a generic `subtipo`. Keys are Spanish to match the
 * model's vocabulary; the parser also accepts English/snake_case variants.
 *
 * It deliberately does NOT invent a garment "type" of its own — the type is the
 * user category it selects from {@link categoryNames}.
 */
export const buildVisionUserPrompt = (categoryNames: readonly string[] = []): string => {
  const categoriesBlock =
    categoryNames.length > 0
      ? 'Estas son las categorías del usuario: [' +
        categoryNames.map((n) => `"${n}"`).join(', ') +
        ']. En "categoria" elige EXACTAMENTE una de esa lista, la que mejor ' +
        'corresponda a la prenda de la foto. Si ninguna corresponde, omite "categoria".\n'
      : '';
  return (
    'Analiza la prenda y devuelve un JSON con estas claves (en español). Omite ' +
    'cualquier clave que no puedas determinar con seguridad; NO adivines:\n' +
    categoriesBlock +
    '- nombre: nombre corto y útil, p.ej. "Camisa azul oscuro manga larga".\n' +
    '- subtipo: tipo específico de la prenda (p.ej. "analógico" para un reloj, ' +
    '"Oxford" para zapatos, "chino" para un pantalón).\n' +
    '- colorPrincipal: color dominante de la PRENDA en hex #rrggbb.\n' +
    '- colorPrincipalNombre: nombre del color principal.\n' +
    '- coloresSecundarios: arreglo de hex de los colores secundarios de la prenda.\n' +
    '- material: tejido aproximado (algodón, lino, mezclilla, lana, cuero, …).\n' +
    '- manga: tipo de manga (manga larga, manga corta, sin mangas, …).\n' +
    '- cuello: tipo de cuello o escote (redondo, en V, mao, polo, …).\n' +
    '- patron: liso, rayas, cuadros, lunares o estampado.\n' +
    '- estilo: casual, formal, deportivo, urbano, elegante, …\n' +
    '- formalidad: número entero de 0 (muy informal) a 10 (muy formal).\n' +
    '- temporada: spring, summer, autumn, winter o all-season.\n' +
    '- ocasiones: arreglo de ocasiones recomendadas (trabajo, formal, fiesta, …).\n' +
    '- marca: SOLO si hay un logotipo o etiqueta claramente legible; si no, omítela.\n' +
    '- observaciones: una frase breve y útil sobre la prenda.\n' +
    '- atributosRelevantes: arreglo con los nombres de los atributos que TIENEN ' +
    'SENTIDO para esta prenda, elegidos de: coloresSecundarios, material, ' +
    'subtipo, manga, cuello, patron, estilo, formalidad, temporada, ocasiones. ' +
    '(Ej.: una correa no tiene manga ni cuello; un reloj no tiene patrón.)\n' +
    'Responde únicamente con el JSON.'
  );
};

/** Build the chat messages for analysing a garment image. */
export const buildGarmentVisionMessages = (
  base64: string,
  categoryNames: readonly string[] = [],
): OllamaChatMessage[] => [
  { role: 'system', content: VISION_SYSTEM_PROMPT },
  {
    role: 'user',
    content: buildVisionUserPrompt(categoryNames),
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
 * Flatten a JSON object into a normalised-key → value map, descending into
 * nested objects at ANY depth (so `{ "analisis": { "prenda": { "tipo": … } } }`
 * and a flat `{ "tipo": … }` resolve the same). Shallower keys win over deeper
 * ones, and earlier branches win over later ones, so a top-level value always
 * takes precedence. Arrays are left intact (handled by the array coercers).
 */
const flattenKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
  const map: Record<string, unknown> = {};
  const visit = (node: Record<string, unknown>, depth: number): void => {
    if (depth > 5) {
      return;
    }
    // Record this level's scalar/array values first (shallower wins).
    for (const [k, v] of Object.entries(node)) {
      const nk = norm(k);
      const isPlainObject = v !== null && typeof v === 'object' && !Array.isArray(v);
      if (!isPlainObject && !(nk in map)) {
        map[nk] = v;
      }
    }
    // Then descend into nested objects.
    for (const v of Object.values(node)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        visit(v as Record<string, unknown>, depth + 1);
      }
    }
  };
  visit(obj, 0);
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

/**
 * Normalised tokens that some models emit to mean "I don't know". Treated as
 * "not determined" so the field stays empty instead of showing junk like
 * "desconocido" or "no visible" — especially important for brand.
 */
const UNKNOWN_TOKENS: ReadonlySet<string> = new Set([
  'desconocido',
  'desconocida',
  'noidentificado',
  'noidentificada',
  'nodisponible',
  'ninguno',
  'ninguna',
  'sinmarca',
  'sininformacion',
  'sindatos',
  'noespecificado',
  'noespecificada',
  'indeterminado',
  'indeterminada',
  'noaplica',
  'novisible',
  'nodefinido',
  'unknown',
  'none',
  'na',
  'null',
  'undefined',
  'notvisible',
  'notapplicable',
  'notspecified',
]);

const isUnknownToken = (s: string): boolean => UNKNOWN_TOKENS.has(norm(s));

/** A descriptive string that rejects "unknown" sentinels (e.g. for brand). */
const descr = (v: unknown): string | undefined => {
  const s = str(v);
  return s !== undefined && !isUnknownToken(s) ? s : undefined;
};

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
 * Match the model's chosen category string against the USER's category names
 * (case/accent-insensitive, tolerant of partial containment). Returns the
 * ORIGINAL user name so the UI can select it exactly. Never invents a name.
 */
const matchUserCategory = (
  value: unknown,
  categoryNames: readonly string[],
): string | undefined => {
  const s = str(value);
  if (s === undefined || categoryNames.length === 0) {
    return undefined;
  }
  const target = norm(s);
  const exact = categoryNames.find((name) => norm(name) === target);
  if (exact !== undefined) {
    return exact;
  }
  // Tolerate "camisa" vs "Camisas", or a phrase that contains the name.
  return categoryNames.find((name) => {
    const n = norm(name);
    return n.length > 0 && (target.includes(n) || n.includes(target));
  });
};

/**
 * Map a model's JSON object to a (vision-sourced) GarmentAnalysis, tolerant of
 * the key/value variations real models emit (Spanish/English keys, snake_case,
 * camelCase, nesting, colour names vs hex, category/season synonyms). Only
 * fields with a real value are emitted — never fabricated.
 *
 * When `categoryNames` is provided, the model's chosen category is matched
 * against the user's own categories and surfaced as `detectedCategory`.
 */
export const parseGarmentVisionResponse = (
  content: string,
  categoryNames: readonly string[] = [],
): GarmentAnalysis => {
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
  const categoryValue = pick(map, [
    'category',
    'categoria',
    'categoriausuario',
    'usercategory',
    'categoriaelegida',
  ]);
  put('category', toCategorySlug(categoryValue) ?? toCategorySlug(typeValue));
  put('subcategory', str(pick(map, ['subcategory', 'subcategoria'])));
  // Contextual classification against the user's own categories.
  put('detectedCategory', matchUserCategory(categoryValue ?? typeValue, categoryNames));
  put(
    'subtype',
    descr(
      pick(map, [
        'subtipo',
        'subtype',
        'tipoespecifico',
        'tipodereloj',
        'tipodezapato',
        'specifictype',
        'variante',
      ]),
    ),
  );
  put(
    'applicableAttributes',
    strArray(
      pick(map, [
        'atributosrelevantes',
        'applicableattributes',
        'atributos',
        'relevantattributes',
        'camposrelevantes',
      ]),
    ),
  );

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
  put('material', descr(pick(map, ['material', 'materialaproximado', 'fabric', 'tela'])));
  put('pattern', descr(pick(map, ['pattern', 'patron', 'estampado', 'print'])));
  put('texture', descr(pick(map, ['texture', 'textura'])));
  put(
    'sleeve',
    descr(pick(map, ['sleeve', 'sleeves', 'manga', 'mangas', 'sleevelength', 'tipodemanga'])),
  );
  put('length', descr(pick(map, ['length', 'largo', 'longitud'])));
  put('neckline', descr(pick(map, ['neckline', 'cuello', 'collar', 'tipodecuello', 'escote'])));
  put('fit', descr(pick(map, ['fit', 'corte', 'ajuste', 'silueta'])));
  put('style', descr(pick(map, ['style', 'estilo'])));
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
  put('brand', descr(pick(map, ['brand', 'marca', 'fabricante', 'label'])));
  put(
    'notes',
    descr(
      pick(map, [
        'notes',
        'observaciones',
        'observacion',
        'notas',
        'comentarios',
        'descripcion',
        'observations',
        'comments',
      ]),
    ),
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
        messages: buildGarmentVisionMessages(base64, input.categoryNames ?? []),
      });
      return parseGarmentVisionResponse(result.content, input.categoryNames ?? []);
    } catch {
      // Transport/model failure → defer entirely to the colour baseline.
      return {};
    }
  }
}
