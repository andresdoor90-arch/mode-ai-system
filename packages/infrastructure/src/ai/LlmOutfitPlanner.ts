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
  'Eres un asesor de imagen masculina experto. A partir del contexto del usuario ' +
  'y de su guardarropa, eliges las prendas que mejor combinan para la ocasión. ' +
  'Respondes SOLO con JSON válido, sin markdown ni texto extra. Usa EXCLUSIVAMENTE ' +
  'los id de prenda de la lista; nunca inventes un id ni recomiendes prendas que no ' +
  'estén en el guardarropa.';

/** One catalog line per garment, compact but information-rich for the model. */
const catalogLine = (g: PlannerGarment): string => {
  const colour = g.colorName.trim().length > 0 ? `${g.colorName} (${g.colorHex})` : g.colorHex;
  const seasons = g.seasons.length > 0 ? g.seasons.join('/') : 'todo el año';
  return `- ${g.id} · ${g.name} · ${g.category}/${g.subcategory} · color ${colour} · formalidad ${g.formality}/10 · zona ${g.layerSlot} · temporadas ${seasons}`;
};

/** Build the chat messages asking the model to assemble outfits. */
export const buildPlannerMessages = (
  context: PlannerContext,
  catalog: readonly PlannerGarment[],
): OllamaChatMessage[] => {
  const contextLines = [
    `- Mensaje: "${context.message}"`,
    `- Ocasión: ${context.occasion}`,
    `- Temporada: ${context.season}`,
    `- Formalidad objetivo: ${context.targetFormality}/10`,
    ...(context.weather !== undefined ? [`- Clima: ${context.weather}`] : []),
    ...(context.timeOfDay !== undefined ? [`- Momento del día: ${context.timeOfDay}`] : []),
    ...(context.activity !== undefined ? [`- Actividad: ${context.activity}`] : []),
  ].join('\n');

  const user =
    'Contexto:\n' +
    contextLines +
    '\n\nGuardarropa disponible (elige únicamente por id):\n' +
    catalog.map(catalogLine).join('\n') +
    '\n\nArma hasta 3 outfits completos y combinables para este contexto:\n' +
    '- "principal": la mejor opción global.\n' +
    '- "mas-elegante": una alternativa más formal.\n' +
    '- "mas-comoda": una alternativa más cómoda.\n' +
    'Cada outfit debe incluir, si existen, una parte superior + una parte inferior ' +
    '(o una prenda de cuerpo completo), calzado, y abrigo o accesorios cuando aporten. ' +
    'Combina los colores y respeta la formalidad, la ocasión y el clima.\n\n' +
    'Responde SOLO con este JSON (sin texto adicional):\n' +
    '{"outfits":[{"kind":"principal","garmentIds":["<id>","<id>"],"explicacion":"<por qué, en español>"}]}\n' +
    'Si el guardarropa no permite armar un outfit, responde {"outfits":[]}.';

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
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
