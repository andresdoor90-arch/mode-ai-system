/**
 * User store (Zustand).
 *
 * Holds the current user's profile and lightweight preferences view-model.
 * Persisted preferences (display density, default occasion/season for
 * suggestions) live here; the authoritative profile will be served by the
 * profile use cases over IPC in a later phase. Prepared now so screens can bind
 * to a stable shape.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { sampleProfile } from '../data/sampleData';

export type Density = 'comfortable' | 'compact';

export interface UserProfileView {
  readonly name: string;
  readonly handle: string;
  readonly joinedAt: string;
  readonly preferredColors: readonly string[];
  readonly styleKeywords: readonly string[];
  readonly measurements: { readonly height: string; readonly chest: string; readonly waist: string };
}

interface UserState {
  profile: UserProfileView;
  density: Density;
  defaultOccasion: string;
  defaultSeason: string;

  setDensity: (density: Density) => void;
  setDefaultOccasion: (occasion: string) => void;
  setDefaultSeason: (season: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: sampleProfile,
      density: 'comfortable',
      defaultOccasion: 'casual',
      defaultSeason: 'all-season',

      setDensity: (density) => set({ density }),
      setDefaultOccasion: (defaultOccasion) => set({ defaultOccasion }),
      setDefaultSeason: (defaultSeason) => set({ defaultSeason }),
    }),
    {
      name: 'mas.user',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        density: state.density,
        defaultOccasion: state.defaultOccasion,
        defaultSeason: state.defaultSeason,
      }),
    },
  ),
);
