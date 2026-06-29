/**
 * Explanation Generator (step 10 of the flow).
 *
 * Produces clear, human-readable reasoning for each recommendation. The
 * reasoning is DERIVED ENTIRELY from the domain scoring breakdown — the facts
 * are decided by M-A-S, never by the model.
 *
 * Offline (no provider) it renders a deterministic Spanish template from those
 * facts. When a provider is available it asks the model ONLY to rephrase the
 * very same facts into more natural prose; the prompt forbids inventing new
 * reasons, and any provider failure falls back to the template. The model thus
 * phrases the explanation but never makes the styling decision.
 */
import { type ScoreFactor } from '../../domain/services/OutfitScoringService';
import { type ITextProvider } from './ports';
import { type RankedCandidate } from './OutfitRankingEngine';
import {
  RECOMMENDATION_LABELS,
  type RecommendationContext,
  type RecommendationKind,
} from './types';

/** Spanish labels for each scoring factor, for readable explanations. */
const FACTOR_LABELS: Readonly<Record<ScoreFactor['name'], string>> = {
  colorCompatibility: 'armonía de color',
  formalityCoherence: 'coherencia de formalidad',
  thermalAdequacy: 'adecuación térmica',
  eventAdequacy: 'adecuación a la ocasión',
  comfortMobility: 'comodidad y movilidad',
  freshness: 'frescura (poco repetido)',
  visualBalance: 'equilibrio visual',
  accessories: 'uso de accesorios',
  userPreference: 'tus preferencias',
  seasonality: 'idoneidad de temporada',
};

/** Why each recommendation kind was chosen, in plain Spanish. */
const KIND_RATIONALE: Readonly<Record<RecommendationKind, string>> = {
  principal: 'es la opción más equilibrada para hoy',
  'mas-elegante': 'es la alternativa más elegante y formal',
  'mas-comoda': 'es la alternativa más cómoda y práctica',
};

export interface Explanation {
  readonly text: string;
  /** True when a provider rephrased the template into natural language. */
  readonly enriched: boolean;
}

export class ExplanationGenerator {
  /** Build the explanation, using the provider to enrich it when supplied. */
  public async explain(
    candidate: RankedCandidate,
    kind: RecommendationKind,
    context: RecommendationContext,
    provider?: ITextProvider,
  ): Promise<Explanation> {
    const template = this.renderTemplate(candidate, kind, context);
    if (provider === undefined) {
      return { text: template, enriched: false };
    }
    try {
      const result = await provider.complete(
        [
          {
            role: 'system',
            content:
              'Eres el asistente de estilo de M-A-S. Reescribe el razonamiento dado en 1-2 ' +
              'frases naturales en español. NO inventes datos nuevos ni cambies la decisión: ' +
              'solo reformula los motivos proporcionados.',
          },
          { role: 'user', content: template },
        ],
        { temperature: 0.4, maxTokens: 160 },
      );
      const text = result.text.trim();
      return text.length > 0 ? { text, enriched: true } : { text: template, enriched: false };
    } catch {
      // Provider failure must never break the flow — fall back to the template.
      return { text: template, enriched: false };
    }
  }

  /** The deterministic, offline explanation built purely from domain facts. */
  public renderTemplate(
    candidate: RankedCandidate,
    kind: RecommendationKind,
    context: RecommendationContext,
  ): string {
    const label = RECOMMENDATION_LABELS[kind];
    const names = candidate.garments.map((g) => g.name).join(', ');
    const topFactors = this.topFactors(candidate, 2)
      .map((f) => FACTOR_LABELS[f.name])
      .join(' y ');
    const weatherNote =
      context.weather !== undefined
        ? ` Pensada para ${context.weather.temperatureC}°C.`
        : '';
    const score = candidate.finalScore;

    return (
      `${label} (${score}/100): ${names}. ` +
      `Esta combinación ${KIND_RATIONALE[kind]} para una ocasión ${context.occasion} ` +
      `(${context.season}); destaca por su ${topFactors}.${weatherNote}`
    );
  }

  private topFactors(candidate: RankedCandidate, n: number): readonly ScoreFactor[] {
    return [...candidate.breakdown.factors]
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, Math.max(1, n));
  }
}
