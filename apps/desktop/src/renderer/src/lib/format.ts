/**
 * Pure presentation formatters.
 *
 * Small, dependency-free helpers used across the UI to render counts, dates,
 * enum-style identifiers and percentages consistently. Being pure functions
 * with no React/DOM dependency, they are fully unit-testable offline.
 */

/** Capitalise the first letter of a string. */
export function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Turn a kebab/snake identifier into a human "Title Case" label.
 * e.g. `dress-shoes` → `Dress Shoes`, `all-season` → `All Season`.
 */
export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map(capitalize)
    .join(' ');
}

/** Pluralise a noun based on a count: `1 item`, `2 items`. */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/** Clamp a number into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Format a 0–100 score as a rounded percentage string, clamped to range. */
export function formatScore(score: number): string {
  return `${Math.round(clamp(score, 0, 100))}%`;
}

/**
 * Format an ISO date/timestamp as a short, locale-stable label `DD MMM YYYY`.
 * Returns the original string if it cannot be parsed, so it never throws in the
 * UI. Uses UTC to keep output deterministic regardless of the host timezone.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** Build compact initials (max two letters) from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
