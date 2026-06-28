/**
 * Barrel for the Zustand stores.
 *
 * Global state is split by concern (UI, wardrobe, outfit, user, AI status),
 * each store owning a single slice. Pure transition logic lives under
 * `./logic`. The AI status store is a placeholder only — no engine is wired in
 * Phase 4.
 */
export { useUiStore } from './uiStore';
export { useWardrobeStore } from './wardrobeStore';
export { useOutfitStore } from './outfitStore';
export { useUserStore } from './userStore';
export { useAiStatusStore } from './aiStatusStore';

export type { ToastVariant, Toast, ToastInput } from './logic/uiLogic';
export type { WardrobeFilters, WardrobeSort } from './logic/wardrobeLogic';
