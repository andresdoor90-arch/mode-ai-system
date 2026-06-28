/**
 * ThemeProvider.
 *
 * Bridges the persisted theme *preference* (in the UI store) to the *effective*
 * theme applied to the document. It toggles the `dark` class on `<html>` and
 * keeps `color-scheme` in sync, reacting both to preference changes and — when
 * the preference is "system" — to OS colour-scheme changes via `matchMedia`.
 *
 * Resolution itself is delegated to the pure `resolveEffectiveTheme` helper so
 * the policy is unit-tested independently of the DOM.
 */
import { useEffect } from 'react';

import { useUiStore } from '../store/uiStore';
import { resolveEffectiveTheme } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function applyEffectiveTheme(systemPrefersDark: boolean): void {
  const preference = useUiStore.getState().themePreference;
  const effective = resolveEffectiveTheme(preference, systemPrefersDark);
  const root = document.documentElement;
  root.classList.toggle('dark', effective === 'dark');
  root.style.colorScheme = effective;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const preference = useUiStore((state) => state.themePreference);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    applyEffectiveTheme(media.matches);

    const onChange = (event: MediaQueryListEvent): void => applyEffectiveTheme(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
    // Re-run whenever the user's preference changes so the class updates live.
  }, [preference]);

  return <>{children}</>;
}
