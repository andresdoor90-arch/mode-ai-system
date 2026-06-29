/**
 * Theme logic (pure).
 *
 * The user picks one of three *preferences*: explicit light, explicit dark, or
 * "system" (follow the OS). The *effective* theme actually applied to the DOM
 * is always concrete (light/dark) and is derived from the preference plus the
 * current OS setting. Keeping this resolution and the persistence
 * (de)serialisation as pure functions makes the theming behaviour testable
 * without a DOM.
 */

/** What the user selected. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What is actually applied to the document. */
export type EffectiveTheme = 'light' | 'dark';

/** localStorage key under which the preference is persisted. */
export const THEME_STORAGE_KEY = 'mas.theme-preference';

/** The default preference for a fresh install. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

const VALID_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Type guard for a valid {@link ThemePreference}. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (VALID_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Resolve the concrete theme to apply, given the user's preference and whether
 * the operating system currently prefers a dark colour scheme.
 */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Cycle to the next preference for a single toggle control:
 * light → dark → system → light.
 */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  switch (current) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    case 'system':
    default:
      return 'light';
  }
}

/** Parse a persisted value into a preference, falling back to the default. */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
}

/** Serialise a preference for persistence. */
export function serializeThemePreference(preference: ThemePreference): string {
  return preference;
}
