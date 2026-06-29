/**
 * Outfit store (Zustand).
 *
 * Caches scored outfit suggestions (produced by the domain's deterministic,
 * rules-based scoring — NOT an AI engine) and the outfit history view-model.
 * Suggestions are fetched over IPC; outfit history starts empty and is filled
 * from real persisted usage.
 */
import { create } from 'zustand';

import type { OutfitDTO, OutfitSuggestionDTO, SuggestionsPayload } from '@shared/ipc';

import { ipc, isBridgeAvailable } from '../ipc/client';

interface OutfitState {
  suggestions: OutfitSuggestionDTO[];
  history: OutfitDTO[];
  loading: boolean;
  error: string | null;

  loadSuggestions: (payload: SuggestionsPayload) => Promise<void>;
  loadHistory: () => void;
}

export const useOutfitStore = create<OutfitState>((set) => ({
  suggestions: [],
  history: [],
  loading: false,
  error: null,

  loadSuggestions: async (payload) => {
    set({ loading: true, error: null });
    if (!isBridgeAvailable()) {
      set({ suggestions: [], loading: false });
      return;
    }
    try {
      const suggestions = await ipc.getOutfitSuggestions(payload);
      set({ suggestions: [...suggestions], loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load suggestions.',
      });
    }
  },

  loadHistory: () => set({ history: [] }),
}));
