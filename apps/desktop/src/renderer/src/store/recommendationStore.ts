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
 * Recommendations are built EXCLUSIVELY from the user's real garments by the
 * engine; there is no sample/mock fallback. With no garments yet, the set is
 * simply null and the screen shows an empty state.
 */
import { create } from 'zustand';

import type {
  OutfitRecommendationDTO,
  RecommendationRequestPayload,
  RecommendationSetDTO,
} from '@shared/ipc';

import { ipc, isBridgeAvailable } from '../ipc/client';

interface RecommendationState {
  set: RecommendationSetDTO | null;
  selectedKind: string | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  /**
   * Monotonic nonce bumped each time the advisor asks the Try-On to dress the
   * mannequin with the currently selected recommendation. The Try-On watches it
   * and applies the outfit ONCE per bump, so manual edits afterwards are kept.
   */
  tryOnRequestId: number;

  /** Request a fresh recommendation set from the engine (or sample offline). */
  recommend: (payload: RecommendationRequestPayload) => Promise<void>;
  /** Select which recommendation to visualise. */
  select: (kind: string) => void;
  /** Ask the Try-On to dress the mannequin with the current selection. */
  requestTryOn: () => void;
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
  tryOnRequestId: 0,

  recommend: async (payload) => {
    rawSet({ loading: true, error: null });
    if (!isBridgeAvailable()) {
      rawSet({ set: null, selectedKind: null, loading: false, loaded: true });
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
        set: null,
        selectedKind: null,
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

  requestTryOn: () => rawSet((state) => ({ tryOnRequestId: state.tryOnRequestId + 1 })),

  current: () => {
    const { set, selectedKind } = get();
    if (set === null) {
      return null;
    }
    return (
      set.recommendations.find((r) => r.kind === selectedKind) ?? set.recommendations[0] ?? null
    );
  },
}));
