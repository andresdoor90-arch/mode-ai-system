/**
 * Barrel for the Zustand stores.
 *
 * Global state is split by concern (UI, wardrobe, outfit, user, AI status),
 * each store owning a single slice. Pure transition logic lives under
 * `./logic`. Since Phase 5 the AI status store mirrors the real engine
 * capability reported over IPC (rules-only "degraded" vs provider-backed).
 */
export { useUiStore } from './uiStore';
export { useWardrobeStore } from './wardrobeStore';
export { useOutfitStore } from './outfitStore';
export { useUserStore } from './userStore';
export { useAiStatusStore } from './aiStatusStore';

export type { ToastVariant, Toast, ToastInput } from './logic/uiLogic';
export type { WardrobeFilters, WardrobeSort } from './logic/wardrobeLogic';
