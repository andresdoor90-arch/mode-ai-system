import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose conditional class names and resolve Tailwind conflicts.
 *
 * `clsx` flattens the conditional inputs; `tailwind-merge` then de-duplicates
 * conflicting utilities so the last one wins (e.g. `px-2 px-4` → `px-4`). This
 * is the standard utility every design-system component uses to merge its base
 * styles with caller-supplied `className` overrides.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
