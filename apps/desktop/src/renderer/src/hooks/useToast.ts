/**
 * useToast — ergonomic accessor for raising toasts from anywhere in the UI.
 *
 * Returns the UI store's `toast` and `dismiss` actions so components can notify
 * the user without wiring up the store boilerplate themselves.
 */
import { useUiStore } from '../store/uiStore';

export function useToast(): {
  toast: ReturnType<typeof useUiStore.getState>['toast'];
  dismiss: ReturnType<typeof useUiStore.getState>['dismiss'];
} {
  const toast = useUiStore((state) => state.toast);
  const dismiss = useUiStore((state) => state.dismiss);
  return { toast, dismiss };
}
