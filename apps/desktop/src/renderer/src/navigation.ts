/**
 * Navigation model.
 *
 * A single declarative source of truth for the app's routes: their paths,
 * labels (Spanish, matching the product spec), icons and sidebar grouping. The
 * Sidebar renders from this list, the Breadcrumbs resolve labels from it, and
 * the router maps each `path` to its page — so adding a screen means editing
 * one array.
 */
import {
  Download,
  History,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Shirt,
  Sparkles,
  Tag,
  Upload,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: 'main' | 'library' | 'system';
  /** Short description used in command surfaces and page headers. */
  readonly description: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    group: 'main',
    description: 'Resumen de tu guardarropa y actividad reciente',
  },
  {
    path: '/wardrobe',
    label: 'Guardarropa',
    icon: Shirt,
    group: 'library',
    description: 'Explora y gestiona todas tus prendas',
  },
  {
    path: '/categories',
    label: 'Categorías',
    icon: LayoutGrid,
    group: 'library',
    description: 'Organiza tu armario por categoría',
  },
  {
    path: '/garments',
    label: 'Prendas',
    icon: Tag,
    group: 'library',
    description: 'Vista detallada de cada prenda',
  },
  {
    path: '/history',
    label: 'Historial',
    icon: History,
    group: 'library',
    description: 'Conjuntos que has usado y valorado',
  },
  {
    path: '/profile',
    label: 'Perfil',
    icon: User,
    group: 'system',
    description: 'Tu estilo, medidas y preferencias',
  },
  {
    path: '/settings',
    label: 'Configuración',
    icon: Settings,
    group: 'system',
    description: 'Apariencia, datos y ajustes de la aplicación',
  },
  {
    path: '/import',
    label: 'Importar',
    icon: Download,
    group: 'system',
    description: 'Importa un guardarropa desde un archivo',
  },
  {
    path: '/export',
    label: 'Exportar',
    icon: Upload,
    group: 'system',
    description: 'Exporta tu guardarropa a un archivo portable',
  },
];

/** Icon used for the app/brand mark in the sidebar header. */
export const BRAND_ICON = Sparkles;

export const NAV_GROUP_LABELS: Record<NavItem['group'], string> = {
  main: 'General',
  library: 'Mi armario',
  system: 'Sistema',
};

/** Find the best-matching nav item for a pathname (longest path prefix). */
export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === '/') {
    return NAV_ITEMS.find((item) => item.path === '/');
  }
  return NAV_ITEMS.filter((item) => item.path !== '/')
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
