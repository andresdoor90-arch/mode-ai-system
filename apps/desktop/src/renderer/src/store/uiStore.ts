/**
 * UI store (Zustand).
 *
 * Owns cross-cutting interface state: the theme preference (persisted), sidebar
 * collapse, command-palette visibility and the toast queue. Theme and sidebar
 * are persisted to `localStorage` via the `persist` middleware so the user's
 * choices survive restarts; transient state (toasts, palette) is not persisted.
 *
 * Pure transitions live in `./logic/uiLogic` and are unit-tested independently;
 * this store only binds them to React and schedules toast auto-dismissal.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { DEFAULT_THEME_PREFERENCE, nextThemePreference, type ThemePreference } from '../theme/theme';
import { addToast, dismissToast, type Toast, type ToastInput } from './logic/uiLogic';

/** How long (ms) a toast stays before auto-dismissing. */
const TOAST_TTL_MS = 5000;

let toastSeq = 0;
function nextToastId(): string {
  toastSeq += 1;
  return `toast-${toastSeq}`;
}

interface UiState {
  themePreference: ThemePreference;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  toasts: Toast[];

  setThemePreference: (preference: ThemePreference) => void;
  cycleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      themePreference: DEFAULT_THEME_PREFERENCE,
      sidebarCollapsed: false,
      commandOpen: false,
      toasts: [],

      setThemePreference: (preference) => set({ themePreference: preference }),
      cycleTheme: () => set({ themePreference: nextThemePreference(get().themePreference) }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCommandOpen: (open) => set({ commandOpen: open }),

      toast: (input) => {
        const id = nextToastId();
        set((state) => ({ toasts: addToast(state.toasts, input, id) }));
        if (typeof window !== 'undefined') {
          window.setTimeout(() => get().dismiss(id), TOAST_TTL_MS);
        }
        return id;
      },
      dismiss: (id) => set((state) => ({ toasts: dismissToast(state.toasts, id) })),
    }),
    {
      name: 'mas.ui',
      storage: createJSONStorage(() => localStorage),
      // Persist only durable preferences; keep transient UI state out of storage.
      partialize: (state) => ({
        themePreference: state.themePreference,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
