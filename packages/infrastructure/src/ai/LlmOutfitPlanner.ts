/**
 * LLM-backed outfit planner (Ollama).
 *
 * Implements the core {@link IOutfitPlanner} port: given the user's context and
 * their wardrobe catalog, it asks a local Ollama model (e.g. `qwen2.5vl:7b`) to
 * CHOOSE the garments for up to three outfits and explain each pick in Spanish.
 * It is pure transport + parsing — it carries no styling rules and never
 * fabricates garments: it only returns ids the model emitted, which the
 * orchestrator validates back against the real wardrobe before showing anything.
 *
 * `isAvailable()` resolves the configured model against the installed ones
 * (tag-tolerant), so when the model/server is absent the orchestrator degrades
 * to its offline rule engine with no behaviour change.
 */
import {
  type IOutfitPlanner,
  type PlannedOutfit,
  type PlannerContext,
  type PlannerGarment,
} from '@mas/core';

import { OllamaClient, type OllamaChatMessage } from './OllamaClient';

export interface LlmOutfitPlannerConfig {
  readonly client: OllamaClient;
  /** Configured model name, e.g. `qwen2.5vl:7b`. */
  readonly model: string;
}

const SYSTEM_PROMPT =
  'Eres MAS, un asesor de imagen masculina cercano, carismático y seguro de sí ' +
  'mismo. Hablas en español, de tú, con calidez y confianza, como un estilista ' +
  'profesional que conoce bien a su cliente. Eliges del guardarropa las prendas ' +
  'que mejor combinan para el contexto y razonas como un experto: formalidad, ' +
  'ocasión, hora, clima, comodidad y armonía de colores. Respondes SOLO con un ' +
  'objeto JSON válido (sin markdown ni texto fuera del JSON). Usa EXCLUSIVAMENTE ' +
  'los id de prenda de la lista; jamás inventes un id ni recomiendes algo que no ' +
  'esté en el guardarropa.';

/** One catalog line per garment, compact but information-rich for the model. */
const catalogLine = (g: PlannerGarment): string => {
  const colour = g.colorName.trim().length > 0 ? `${g.colorName} (${g.colorHex})` : g.colorHex;
  const seasons = g.seasons.length > 0 ? g.seasons.join('/') : 'todo el año';
  return `${g.id} · ${g.name} · ${g.category}/${g.subcategory} · color ${colour} · formalidad ${g.formality}/10 · zona ${g.layerSlot} · temporadas ${seasons}`;
};

const INSTRUCTION =
  'Arma hasta 3 outfits completos y combinables para este contexto:\n' +
  '- "principal": la mejor opción global.\n' +
  '- "mas-elegante": una alternativa más formal.\n' +
  '- "mas-comoda": una alternativa más cómoda.\n' +
  'Cada outfit debe incluir, si existen, una parte superior + una parte inferior ' +
  '(o una prenda de cuerpo completo), calzado, y COMPLÉTALO con los accesorios y ' +
  'capas que aporten al look y a la ocasión: correa, corbata, reloj, chaqueta/saco ' +
  'o abrigo. Cada uno ocupa una zona distinta, así que puedes combinar varios a la ' +
  'vez (p. ej. camisa + corbata + correa + reloj + pantalón + zapatos). ' +
  'Fíjate en las FOTOS para evaluar color, patrón y combinación, y respeta la ' +
  'formalidad, la ocasión y el clima.\n\n' +
  'En "explicacion" responde como un asesor de imagen de verdad: abre con un ' +
  'saludo breve y cálido sobre su plan, di por qué elegiste ESTE conjunto para la ' +
  'ocasión, y explica prenda por prenda por qué la escogiste, por qué combinan ' +
  'entre sí (colores, formalidad) y por qué funciona para el momento. Varias ' +
  'frases, con actitud, cercanía y seguridad; nada de respuestas robóticas.\n\n' +
  'Responde SOLO con este JSON (sin texto adicional):\n' +
  '{"outfits":[{"kind":"principal","garmentIds":["<id>","<id>"],"explicacion":"<texto del asesor, en español>"}]}\n' +
  'Si el guardarropa no permite armar un outfit, responde {"outfits":[]}.';

const contextBlock = (context: PlannerContext): string =>
  [
    `- Mensaje: "${context.message}"`,
    `- Ocasión: ${context.occasion}`,
    `- Temporada: ${context.season}`,
    `- Formalidad objetivo: ${context.targetFormality}/10`,
    ...(context.weather !== undefined ? [`- Clima: ${context.weather}`] : []),
    ...(context.timeOfDay !== undefined ? [`- Momento del día: ${context.timeOfDay}`] : []),
    ...(context.activity !== undefined ? [`- Actividad: ${context.activity}`] : []),
  ].join('\n');

/**
 * Build the chat messages asking the model to assemble outfits.
 *
 * When garments carry thumbnails, the request is MULTIMODAL: the images are
 * attached to the user turn IN THE SAME ORDER as a numbered "con foto" list, so
 * the model can map each picture to its garment id and judge real colour/pattern.
 * Garments without a photo are listed as text and stay selectable by id. With no
 * images at all, this degrades to the original text-only prompt.
 */
export const buildPlannerMessages = (
  context: PlannerContext,
  catalog: readonly PlannerGarment[],
): OllamaChatMessage[] => {
  const withImages = catalog.filter(
    (g): g is PlannerGarment & { imageBase64: string } =>
      typeof g.imageBase64 === 'string' && g.imageBase64.length > 0,
  );
  const textOnly = catalog.filter((g) => withImages.every((w) => w.id !== g.id));

  const sections: string[] = ['Contexto:', contextBlock(context), ''];

  if (withImages.length > 0) {
    sections.push(
      `Guardarropa CON FOTO (hay ${withImages.length} imágenes adjuntas, en este mismo orden; ` +
        'la imagen N corresponde a la prenda N):',
      ...withImages.map((g, i) => `${i + 1}. ${catalogLine(g)}`),
      '',
    );
  }
  if (textOnly.length > 0) {
    sections.push(
      withImages.length > 0
        ? 'Otras prendas (sin foto, elige por id):'
        : 'Guardarropa disponible (elige por id):',
      ...textOnly.map((g) => `- ${catalogLine(g)}`),
      '',
    );
  }
  sections.push(INSTRUCTION);

  const userMessage: OllamaChatMessage =
    withImages.length > 0
      ? { role: 'user', content: sections.join('\n'), images: withImages.map((g) => g.imageBase64) }
      : { role: 'user', content: sections.join('\n') };

  return [{ role: 'system', content: SYSTEM_PROMPT }, userMessage];
};

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Read the first matching alias (normalised keys) from an object. */
const pick = (obj: Record<string, unknown>, aliases: readonly string[]): unknown => {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    const nk = norm(k);
    if (!map.has(nk)) {
      map.set(nk, v);
    }
  }
  for (const alias of aliases) {
    const value = map.get(norm(alias));
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''))
    .filter((v) => v.length > 0);
};

/** Best-effort JSON extraction: tolerate code fences and surrounding prose. */
const parseJsonLoose = (content: string): unknown => {
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to substring extraction.
  }
  const start = cleaned.search(/[[{]/);
  if (start === -1) {
    return null;
  }
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) {
    return null;
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Parse the model's JSON into planned outfits. Tolerates an `outfits` wrapper, a
 * bare array, Spanish/English keys and a single-object reply. Outfits with no
 * garment ids are dropped. Never throws.
 */
export const parsePlannerResponse = (content: string): PlannedOutfit[] => {
  const parsed = parseJsonLoose(content);
  if (parsed === null || typeof parsed !== 'object') {
    return [];
  }
  let entries: unknown;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else {
    const wrapped = pick(parsed as Record<string, unknown>, [
      'outfits',
      'recomendaciones',
      'recommendations',
      'conjuntos',
      'looks',
    ]);
    entries = Array.isArray(wrapped) ? wrapped : [parsed];
  }
  if (!Array.isArray(entries)) {
    return [];
  }

  const outfits: PlannedOutfit[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const obj = entry as Record<string, unknown>;
    const garmentIds = asStringArray(
      pick(obj, ['garmentIds', 'ids', 'prendas', 'garments', 'prendasIds', 'items']),
    );
    if (garmentIds.length === 0) {
      continue;
    }
    outfits.push({
      kind: asString(pick(obj, ['kind', 'tipo', 'rol', 'role', 'nombre'])),
      garmentIds,
      explanation: asString(
        pick(obj, [
          'explicacion',
          'explanation',
          'justificacion',
          'motivo',
          'razon',
          'razones',
          'descripcion',
          'porque',
        ]),
      ),
    });
  }
  return outfits;
};

export class LlmOutfitPlanner implements IOutfitPlanner {
  public readonly id = 'ollama-advisor';
  private readonly client: OllamaClient;
  private readonly model: string;
  private resolvedModel: string | null = null;

  public constructor(config: LlmOutfitPlannerConfig) {
    this.client = config.client;
    this.model = config.model;
  }

  /**
   * Pick the installed model that best matches the configured one: exact match
   * wins, otherwise any model sharing the same base name (so `qwen2.5vl:7b`
   * resolves to an installed `qwen2.5vl:latest`, etc.).
   */
  private pickInstalledModel(installed: readonly string[]): string | null {
    const exact = installed.find((m) => m === this.model || m.startsWith(`${this.model}:`));
    if (exact !== undefined) {
      return exact;
    }
    const base = this.model.split(':')[0] ?? this.model;
    return installed.find((m) => (m.split(':')[0] ?? m) === base) ?? null;
  }

  public async isAvailable(): Promise<boolean> {
    const models = await this.client.listModels();
    this.resolvedModel = this.pickInstalledModel(models);
    return this.resolvedModel !== null;
  }

  public async plan(
    context: PlannerContext,
    catalog: readonly PlannerGarment[],
  ): Promise<readonly PlannedOutfit[]> {
    if (catalog.length === 0) {
      return [];
    }
    const result = await this.client.chat({
      model: this.resolvedModel ?? this.model,
      format: 'json',
      messages: buildPlannerMessages(context, catalog),
    });
    return parsePlannerResponse(result.content);
  }
}
