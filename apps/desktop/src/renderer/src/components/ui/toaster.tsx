/**
 * Toaster — connects the UI store's toast queue to the Radix toast primitives.
 *
 * Mounted once near the app root. It subscribes to `useUiStore`, renders each
 * queued toast with the appropriate variant and an accent strip, and removes it
 * from the store when the user (or the auto-dismiss timer) closes it.
 */
import { useUiStore } from '../../store/uiStore';
import { cn } from '../../lib/cn';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

const ACCENT: Record<string, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export function Toaster(): JSX.Element {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismiss);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(toast.id);
            }
          }}
        >
          <span
            className={cn('absolute inset-y-0 left-0 w-1', ACCENT[toast.variant] ?? ACCENT.default)}
            aria-hidden
          />
          <div className="flex flex-col gap-1 pl-2">
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description !== undefined && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
