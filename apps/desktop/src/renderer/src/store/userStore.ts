/**
 * User store (Zustand).
 *
 * The authoritative profile lives in SQLite and is reached over IPC
 * (renderer → profile:get/create/rename → use case → repository). There is NO
 * sample/mock profile: on a fresh install `hasProfile` is false and the app
 * shows the first-run onboarding. Lightweight UI preferences (display density,
 * default occasion/season) are the only things persisted locally.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { ipc, isBridgeAvailable } from '../ipc/client';

export type Density = 'comfortable' | 'compact';

export interface UserProfileView {
  readonly name: string;
  readonly handle: string;
  readonly joinedAt: string;
  readonly preferredColors: readonly string[];
  readonly styleKeywords: readonly string[];
  readonly measurements: {
    readonly height: string;
    readonly chest: string;
    readonly waist: string;
  };
}

/** Build the renderer view-model from the real profile name. */
const toView = (name: string): UserProfileView => ({
  name,
  handle: `@${name.trim().toLowerCase().replace(/\s+/g, '') || 'tu-perfil'}`,
  joinedAt: '',
  preferredColors: [],
  styleKeywords: [],
  measurements: { height: '', chest: '', waist: '' },
});

interface UserState {
  /** The real profile, or null until one is created in onboarding. */
  profile: UserProfileView | null;
  /** True once a profile exists in SQLite. */
  hasProfile: boolean;
  /** True once the initial profile lookup has completed. */
  loaded: boolean;
  density: Density;
  defaultOccasion: string;
  defaultSeason: string;

  /** Load the current profile from SQLite (called on app start). */
  loadProfile: () => Promise<void>;
  /** First-run: create the profile with the user's real name. */
  createProfile: (name: string) => Promise<void>;
  /** Rename the existing profile. */
  renameProfile: (name: string) => Promise<void>;

  setDensity: (density: Density) => void;
  setDefaultOccasion: (occasion: string) => void;
  setDefaultSeason: (season: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      hasProfile: false,
      loaded: false,
      density: 'comfortable',
      defaultOccasion: 'casual',
      defaultSeason: 'all-season',

      loadProfile: async () => {
        if (!isBridgeAvailable()) {
          set({ profile: null, hasProfile: false, loaded: true });
          return;
        }
        try {
          const dto = await ipc.getProfile();
          if (dto === null) {
            set({ profile: null, hasProfile: false, loaded: true });
          } else {
            set({ profile: toView(dto.name), hasProfile: true, loaded: true });
          }
        } catch {
          set({ profile: null, hasProfile: false, loaded: true });
        }
      },

      createProfile: async (name) => {
        const dto = await ipc.createProfile(name);
        set({ profile: toView(dto.name), hasProfile: true, loaded: true });
      },

      renameProfile: async (name) => {
        await ipc.renameProfile(name);
        set({ profile: toView(name) });
      },

      setDensity: (density) => set({ density }),
      setDefaultOccasion: (defaultOccasion) => set({ defaultOccasion }),
      setDefaultSeason: (defaultSeason) => set({ defaultSeason }),
    }),
    {
      name: 'mas.user',
      storage: createJSONStorage(() => localStorage),
      // Never persist the profile locally — SQLite is the source of truth.
      partialize: (state) => ({
        density: state.density,
        defaultOccasion: state.defaultOccasion,
        defaultSeason: state.defaultSeason,
      }),
    },
  ),
);
