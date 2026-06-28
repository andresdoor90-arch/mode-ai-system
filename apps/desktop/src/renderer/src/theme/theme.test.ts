import { describe, it, expect } from 'vitest';

import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  nextThemePreference,
  parseThemePreference,
  resolveEffectiveTheme,
  serializeThemePreference,
} from './theme';

describe('theme preference validation', () => {
  it('recognises valid preferences', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isThemePreference('blue')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(42)).toBe(false);
  });
});

describe('resolveEffectiveTheme', () => {
  it('honours explicit preferences regardless of system', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it('follows the system setting when preference is "system"', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark');
    expect(resolveEffectiveTheme('system', false)).toBe('light');
  });
});

describe('nextThemePreference', () => {
  it('cycles light -> dark -> system -> light', () => {
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
    expect(nextThemePreference('system')).toBe('light');
  });
});

describe('persistence round-trip', () => {
  it('parses persisted values, falling back to the default', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference('garbage')).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('serialises then parses back to the same preference', () => {
    for (const pref of ['light', 'dark', 'system'] as const) {
      expect(parseThemePreference(serializeThemePreference(pref))).toBe(pref);
    }
  });
});
