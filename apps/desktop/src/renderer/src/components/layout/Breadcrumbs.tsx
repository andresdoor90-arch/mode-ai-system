/**
 * Breadcrumbs — contextual location trail.
 *
 * Derives a simple trail from the current route: Home (Inicio) → current
 * section. Kept route-driven via the navigation model so labels stay consistent
 * with the sidebar. Extensible to deeper trails (e.g. garment detail) later.
 */
import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { findNavItem } from '../../navigation';

export function Breadcrumbs(): JSX.Element {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);
  const isHome = current?.path === '/';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
        Inicio
      </Link>
      {!isHome && current !== undefined && (
        <>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />
          <span className="font-medium text-foreground">{current.label}</span>
        </>
      )}
    </nav>
  );
}
