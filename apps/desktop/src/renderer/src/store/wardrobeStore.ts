/**
 * Wardrobe store (Zustand).
 *
 * Holds the garment/collection data loaded from the main process over IPC, plus
 * the active filters and sort. All persistence and domain logic lives behind
 * the IPC boundary (`ipc` client → main → application layer); this store is a
 * client-side cache and view-model. Filtering/sorting are delegated to the pure
 * helpers in `./logic/wardrobeLogic`.
 *
 * `add`/`remove` perform the command over IPC then refresh from source. If the
 * bridge is unavailable (e.g. a browser preview) the store falls back to sample
 * content so the UI is never empty.
 */
import { create } from 'zustand';

import type { AddGarmentPayload, CollectionDTO, GarmentDTO } from '@shared/ipc';

import { ipc, isBridgeAvailable } from '../ipc/client';
import { sampleGarments } from '../data/sampleData';
import {
  DEFAULT_WARDROBE_FILTERS,
  filterGarments,
  sortGarments,
  type WardrobeFilters,
  type WardrobeSort,
} from './logic/wardrobeLogic';

interface WardrobeState {
  garments: GarmentDTO[];
  collections: CollectionDTO[];
  filters: WardrobeFilters;
  sort: WardrobeSort;
  loading: boolean;
  error: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  setFilters: (patch: Partial<WardrobeFilters>) => void;
  resetFilters: () => void;
  setSort: (sort: WardrobeSort) => void;
  addGarment: (payload: AddGarmentPayload) => Promise<boolean>;
  removeGarment: (id: string) => Promise<void>;
  /** Derived: garments after applying the active filters and sort. */
  visibleGarments: () => GarmentDTO[];
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  garments: [],
  collections: [],
  filters: DEFAULT_WARDROBE_FILTERS,
  sort: 'name-asc',
  loading: false,
  error: null,
  loaded: false,

  load: async () => {
    set({ loading: true, error: null });
    if (!isBridgeAvailable()) {
      set({ garments: sampleGarments, collections: [], loading: false, loaded: true });
      return;
    }
    try {
      const view = await ipc.getWardrobe();
      set({
        garments: [...view.garments],
        collections: [...view.collections],
        loading: false,
        loaded: true,
      });
    } catch (error) {
      set({
        garments: sampleGarments,
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : 'Failed to load wardrobe.',
      });
    }
  },

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: DEFAULT_WARDROBE_FILTERS }),
  setSort: (sort) => set({ sort }),

  addGarment: async (payload) => {
    if (!isBridgeAvailable()) {
      return false;
    }
    try {
      await ipc.addGarment(payload);
      await get().load();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add garment.' });
      return false;
    }
  },

  removeGarment: async (id) => {
    // Optimistic removal; reconcile from source afterwards.
    const previous = get().garments;
    set({ garments: previous.filter((garment) => garment.id !== id) });
    if (!isBridgeAvailable()) {
      return;
    }
    try {
      await ipc.removeGarment(id);
      await get().load();
    } catch (error) {
      set({
        garments: previous,
        error: error instanceof Error ? error.message : 'Failed to remove garment.',
      });
    }
  },

  visibleGarments: () => {
    const { garments, filters, sort } = get();
    return sortGarments(filterGarments(garments, filters), sort);
  },
}));
