/**
 * Context Analyzer (step 1–2 of the flow).
 *
 * Interprets the user's natural-language message and extracts a structured
 * {@link RecommendationContext}: occasion, season, weather, formality, comfort
 * and mobility needs, time of day and activity.
 *
 * The extraction is 100% rule-based and runs fully OFFLINE — it is M-A-S logic,
 * not the AI provider's. A provider, when available, may *enrich* the free-text
 * `activity`/`summary` and disambiguate an otherwise-defaulted occasion, but it
 * can never override the fields that feed the hard domain rules (those always
 * come from these deterministic rules or the explicit request overrides).
 */
import { ok, type Result } from '../../shared/Result';
import { Occasion, occasionFormality } from '../../domain/value-objects/Occasion';
import { Season } from '../../domain/value-objects/Season';
import { Precipitation, WeatherCondition } from '../../domain/value-objects/WeatherCondition';
import { type RecommendationContext, type RecommendationRequest } from './types';

/** Bilingual (es/en) keyword → occasion mapping, most-specific first. */
const OCCASION_KEYWORDS: ReadonlyArray<readonly [readonly string[], Occasion]> = [
  [
    ['boda', 'wedding', 'gala', 'black tie', 'etiqueta', 'ceremonia', 'graduación', 'graduation'],
    Occasion.Formal,
  ],
  [
    [
      'oficina',
      'office',
      'trabajo',
      'work',
      'reunión',
      'reunion',
      'meeting',
      'negocios',
      'business',
      'entrevista',
      'interview',
      'presentación',
      'presentation',
    ],
    Occasion.Business,
  ],
  [['cita', 'date', 'cena romántica', 'romantic'], Occasion.Date],
  [
    [
      'fiesta',
      'party',
      'cumpleaños',
      'birthday',
      'celebración',
      'celebration',
      'discoteca',
      'club',
      'noche',
      'night out',
    ],
    Occasion.Party,
  ],
  [
    [
      'gimnasio',
      'gym',
      'deporte',
      'sport',
      'correr',
      'running',
      'entrenar',
      'workout',
      'yoga',
      'pilates',
    ],
    Occasion.Sport,
  ],
  [
    [
      'viaje',
      'travel',
      'aeropuerto',
      'airport',
      'vuelo',
      'flight',
      'turismo',
      'excursión',
      'hiking',
    ],
    Occasion.Travel,
  ],
  [['casa', 'home', 'teletrabajo', 'descanso', 'relax', 'sofá', 'lounge'], Occasion.Home],
  [
    ['casual', 'informal', 'paseo', 'compras', 'shopping', 'café', 'coffee', 'brunch'],
    Occasion.Casual,
  ],
];

/** Bilingual keyword → season mapping. */
const SEASON_KEYWORDS: ReadonlyArray<readonly [readonly string[], Season]> = [
  [['verano', 'summer'], Season.Summer],
  [['invierno', 'winter'], Season.Winter],
  [['primavera', 'spring'], Season.Spring],
  [['otoño', 'otono', 'autumn', 'fall'], Season.Autumn],
];

const FORMAL_CUES = [
  'elegante',
  'elegant',
  'formal',
  'arreglado',
  'arreglada',
  'sofisticado',
  'sofisticada',
  'chic',
];
const COMFORT_CUES = [
  'cómodo',
  'comodo',
  'cómoda',
  'comoda',
  'comfortable',
  'comfy',
  'relajado',
  'relajada',
  'casual',
  'suelto',
];
const MOBILITY_CUES = [
  'caminar',
  'walk',
  'walking',
  'de pie',
  'standing',
  'mucho movimiento',
  'activo',
  'activa',
  'active',
  'andar',
  'mover',
];

const TIME_KEYWORDS: ReadonlyArray<
  readonly [readonly string[], RecommendationContext['timeOfDay']]
> = [
  [['mañana', 'manana', 'morning', 'desayuno', 'breakfast'], 'morning'],
  [['tarde', 'afternoon', 'mediodía', 'noon', 'almuerzo', 'lunch'], 'afternoon'],
  [['noche', 'evening', 'cena', 'dinner'], 'evening'],
  [['madrugada', 'late night', 'midnight'], 'night'],
];

const containsAny = (haystack: string, needles: readonly string[]): boolean =>
  needles.some((n) => haystack.includes(n));

/** Pure, offline interpreter of the user's free-text styling request. */
export class ContextAnalyzer {
  /**
   * Extract structured context from the request. Never throws; returns a
   * `Result` to stay consistent with the application layer's error style.
   */
  public analyze(request: RecommendationRequest): Result<RecommendationContext> {
    const message = (request.message ?? '').toString();
    const text = message.toLowerCase();
    const notes: string[] = [];

    const occasion = request.occasion ?? this.inferOccasion(text, notes);
    const weather = request.weather ?? this.inferWeather(text, notes);
    const season = request.season ?? this.inferSeason(text, weather, notes);
    const targetFormality = this.inferFormality(occasion, text, notes);
    const comfortPriority = this.inferComfort(occasion, text);
    const mobilityNeed = this.inferMobility(occasion, text);
    const timeOfDay = this.inferTimeOfDay(text);
    const activity = this.inferActivity(text);

    const context: RecommendationContext = {
      rawMessage: message,
      occasion,
      season,
      ...(weather !== undefined ? { weather } : {}),
      targetFormality,
      comfortPriority,
      mobilityNeed,
      ...(timeOfDay !== undefined ? { timeOfDay } : {}),
      ...(activity !== undefined ? { activity } : {}),
      notes,
      enrichedByProvider: false,
    };
    return ok(context);
  }

  private inferOccasion(text: string, notes: string[]): Occasion {
    for (const [keywords, occasion] of OCCASION_KEYWORDS) {
      if (containsAny(text, keywords)) {
        notes.push(`Occasion "${occasion}" inferred from the message.`);
        return occasion;
      }
    }
    notes.push('No explicit occasion detected; defaulting to casual.');
    return Occasion.Casual;
  }

  private inferWeather(text: string, notes: string[]): WeatherCondition | undefined {
    // Explicit temperature like "18°", "18 grados", "5 degrees", "-2c".
    const tempMatch = text.match(/(-?\d{1,2})\s*(?:°|º|grados|grado|degrees|degree|c\b)/);
    let temperatureC: number | undefined;
    if (tempMatch?.[1] !== undefined) {
      const parsed = Number.parseInt(tempMatch[1], 10);
      if (Number.isFinite(parsed)) {
        temperatureC = parsed;
        notes.push(`Temperature ${parsed}°C parsed from the message.`);
      }
    }

    let precipitation: Precipitation = Precipitation.None;
    if (containsAny(text, ['lluvia', 'lloviendo', 'rain', 'rainy', 'llueve'])) {
      precipitation = Precipitation.Rain;
      notes.push('Rain detected in the message.');
    } else if (containsAny(text, ['nieve', 'nevando', 'snow', 'snowy'])) {
      precipitation = Precipitation.Snow;
      notes.push('Snow detected in the message.');
    }

    if (temperatureC === undefined) {
      if (containsAny(text, ['frío', 'frio', 'cold', 'helado', 'gélido'])) {
        temperatureC = 3;
        notes.push('Cold weather inferred from the message.');
      } else if (containsAny(text, ['calor', 'caluroso', 'hot', 'bochorno'])) {
        temperatureC = 30;
        notes.push('Hot weather inferred from the message.');
      } else if (containsAny(text, ['templado', 'fresco', 'mild', 'cool'])) {
        temperatureC = 14;
        notes.push('Mild weather inferred from the message.');
      }
    }

    if (temperatureC === undefined && precipitation === Precipitation.None) {
      return undefined;
    }
    const result = WeatherCondition.create({
      temperatureC: temperatureC ?? 16,
      precipitation,
    });
    return result.ok ? result.value : undefined;
  }

  private inferSeason(
    text: string,
    weather: WeatherCondition | undefined,
    notes: string[],
  ): Season {
    for (const [keywords, season] of SEASON_KEYWORDS) {
      if (containsAny(text, keywords)) {
        notes.push(`Season "${season}" inferred from the message.`);
        return season;
      }
    }
    if (weather !== undefined) {
      const season = weather.inferSeason();
      notes.push(`Season "${season}" inferred from the weather.`);
      return season;
    }
    notes.push('No season cue found; treating as all-season.');
    return Season.AllSeason;
  }

  private inferFormality(occasion: Occasion, text: string, notes: string[]): number {
    let formality = occasionFormality(occasion);
    if (containsAny(text, FORMAL_CUES)) {
      formality = Math.min(10, formality + 2);
      notes.push('Explicit "dress up" cue raised the target formality.');
    }
    if (containsAny(text, COMFORT_CUES)) {
      formality = Math.max(0, formality - 1);
    }
    return formality;
  }

  private inferComfort(occasion: Occasion, text: string): number {
    let comfort = occasion === Occasion.Sport || occasion === Occasion.Home ? 0.85 : 0.5;
    if (containsAny(text, COMFORT_CUES)) {
      comfort = Math.min(1, comfort + 0.3);
    }
    if (containsAny(text, FORMAL_CUES)) {
      comfort = Math.max(0, comfort - 0.2);
    }
    return Math.min(1, Math.max(0, comfort));
  }

  private inferMobility(occasion: Occasion, text: string): number {
    let mobility = occasion === Occasion.Sport || occasion === Occasion.Travel ? 0.8 : 0.3;
    if (containsAny(text, MOBILITY_CUES)) {
      mobility = Math.min(1, mobility + 0.4);
    }
    return Math.min(1, Math.max(0, mobility));
  }

  private inferTimeOfDay(text: string): RecommendationContext['timeOfDay'] | undefined {
    for (const [keywords, time] of TIME_KEYWORDS) {
      if (containsAny(text, keywords)) {
        return time;
      }
    }
    return undefined;
  }

  private inferActivity(text: string): string | undefined {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    // A compact activity hint = the first clause of the message.
    const clause = trimmed.split(/[.,;\n]/)[0]?.trim();
    return clause !== undefined && clause.length > 0 ? clause.slice(0, 80) : undefined;
  }
}
