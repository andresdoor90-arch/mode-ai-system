/**
 * UI state logic (pure).
 *
 * Toast queue management is expressed as pure reducers so it can be tested
 * without React or timers. The `uiStore` wires these to Zustand and schedules
 * auto-dismissal; here we only model the data transitions.
 */

/** Severity / intent of a toast notification. */
export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

export interface Toast {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly variant: ToastVariant;
}

/** Input accepted when raising a toast (id and variant are defaulted). */
export interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
}

/** Maximum number of toasts shown at once; oldest are dropped beyond this. */
export const TOAST_LIMIT = 4;

/**
 * Append a toast to the queue, assigning it `id`, defaulting its variant, and
 * trimming the queue to {@link TOAST_LIMIT} (keeping the most recent).
 */
export function addToast(
  toasts: readonly Toast[],
  input: ToastInput,
  id: string,
): Toast[] {
  const toast: Toast = {
    id,
    title: input.title,
    variant: input.variant ?? 'default',
    ...(input.description !== undefined ? { description: input.description } : {}),
  };
  const next = [...toasts, toast];
  return next.slice(Math.max(0, next.length - TOAST_LIMIT));
}

/** Remove a toast by id. */
export function dismissToast(toasts: readonly Toast[], id: string): Toast[] {
  return toasts.filter((toast) => toast.id !== id);
}

/** Toggle helper used by the sidebar collapse control. */
export function toggle(value: boolean): boolean {
  return !value;
}
