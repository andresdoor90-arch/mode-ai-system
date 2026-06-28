/**
 * Recommendation store (Zustand).
 *
 * Holds the latest AI recommendation set (fetched over IPC: renderer → IPC →
 * orchestrator → domain) and which of the three picks (principal / más elegante
 * / más cómoda) is selected for the Virtual Try-On screen. The store performs
 * NO inference and NO rendering — it just mirrors the structured recommendation
 * DTOs so the try-on view can visualise the selected outfit and swap garments
 * automatically when the selection or recommendation changes.
 *
 * When the bridge is unavailable (e.g. a browser preview) it falls back to a
 * realistic sample so the screen is never empty.
 */
import { create } from 'zustand';

import type {
  OutfitRecommendationDTO,
  RecommendationRequestPayload,
  RecommendationSetDTO,
} from '@shared/ipc';

import { ipc, isBridgeAvailable } from '../ipc/client';
import { sampleGarments } from '../data/sampleData';

const SAMPLE_SET: RecommendationSetDTO = {
  occasion: 'business',
  season: 'all-season',
  providerId: null,
  degraded: true,
  notes: ['Conjunto de ejemplo (puente de escritorio no disponible).'],
  recommendations: [
    {
      kind: 'principal',
      label: 'Principal',
      score: 88,
      explanation: 'Equilibrio de formalidad y armonía de color para la ocasión.',
      garments: [sampleGarments[0]!, sampleGarments[3]!, sampleGarments[7]!],
    },
    {
      kind: 'mas-elegante',
      label: 'Más elegante',
      score: 84,
      explanation: 'Sube el registro con una americana estructurada.',
      garments: [sampleGarments[0]!, sampleGarments[3]!, sampleGarments[6]!, sampleGarments[7]!],
    },
    {
      kind: 'mas-comoda',
      label: 'Más cómoda',
      score: 80,
      explanation: 'Prioriza comodidad y movilidad sin perder coherencia.',
      garments: [sampleGarments[2]!, sampleGarments[4]!, sampleGarments[8]!],
    },
  ],
};

interface RecommendationState {
  set: RecommendationSetDTO | null;
  selectedKind: string | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;

  /** Request a fresh recommendation set from the engine (or sample offline). */
  recommend: (payload: RecommendationRequestPayload) => Promise<void>;
  /** Select which recommendation to visualise. */
  select: (kind: string) => void;
  /** The currently selected recommendation, if any. */
  current: () => OutfitRecommendationDTO | null;
}

const firstKind = (set: RecommendationSetDTO | null): string | null =>
  set?.recommendations[0]?.kind ?? null;

export const useRecommendationStore = create<RecommendationState>((rawSet, get) => ({
  set: null,
  selectedKind: null,
  loading: false,
  error: null,
  loaded: false,

  recommend: async (payload) => {
    rawSet({ loading: true, error: null });
    if (!isBridgeAvailable()) {
      rawSet({
        set: SAMPLE_SET,
        selectedKind: firstKind(SAMPLE_SET),
        loading: false,
        loaded: true,
      });
      return;
    }
    try {
      const result = await ipc.getRecommendations(payload);
      rawSet({
        set: result,
        selectedKind: firstKind(result),
        loading: false,
        loaded: true,
      });
    } catch (error) {
      rawSet({
        set: SAMPLE_SET,
        selectedKind: firstKind(SAMPLE_SET),
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : 'No se pudo obtener la recomendación.',
      });
    }
  },

  select: (kind) => {
    const { set } = get();
    if (set?.recommendations.some((r) => r.kind === kind) === true) {
      rawSet({ selectedKind: kind });
    }
  },

  current: () => {
    const { set, selectedKind } = get();
    if (set === null) {
      return null;
    }
    return set.recommendations.find((r) => r.kind === selectedKind) ?? set.recommendations[0] ?? null;
  },
}));
