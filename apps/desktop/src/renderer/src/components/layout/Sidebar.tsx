/**
 * Sidebar — primary navigation rail.
 *
 * Renders the declarative {@link NAV_ITEMS} grouped by section, with active-route
 * highlighting via React Router `NavLink`. Collapsible to an icon-only rail
 * (state persisted in the UI store); in collapsed mode each item shows a tooltip.
 * A footer surfaces the live AI-engine status reported by the orchestrator over
 * IPC (`ready` provider-backed, `degraded` rules-only, etc.).
 */
import { Link, NavLink } from 'react-router-dom';

import { useAiStatusStore, type AiEngineStatus } from '../../store/aiStatusStore';
import { useUiStore } from '../../store/uiStore';
import { cn } from '../../lib/cn';
import { BRAND_ICON, NAV_GROUP_LABELS, NAV_ITEMS, type NavItem } from '../../navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const GROUP_ORDER: ReadonlyArray<NavItem['group']> = ['main', 'library', 'system'];

/** Short label + dot colour for each AI-engine status shown in the footer. */
const AI_STATUS_PRESENTATION: Record<AiEngineStatus, { label: string; dot: string }> = {
  ready: { label: 'Proveedor activo', dot: 'bg-success' },
  degraded: { label: 'Reglas del dominio', dot: 'bg-success' },
  loading: { label: 'Comprobando…', dot: 'bg-warning animate-pulse' },
  idle: { label: 'Inactivo', dot: 'bg-warning' },
  error: { label: 'Error', dot: 'bg-destructive' },
  'not-configured': { label: 'Sin configurar', dot: 'bg-warning' },
};

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }): JSX.Element {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-accent/15 text-white'
            : 'text-sidebar-foreground hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center',
              isActive ? 'text-sidebar-accent' : 'text-sidebar-foreground group-hover:text-white',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) {
    return link;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar(): JSX.Element {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const aiStatus = useAiStatusStore((state) => state.status);
  const aiDetail = useAiStatusStore((state) => state.detail);
  const Brand = BRAND_ICON;
  const ai = AI_STATUS_PRESENTATION[aiStatus];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      <Link
        to="/"
        className={cn('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-0')}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm">
          <Brand className="h-5 w-5" />
        </span>
        {!collapsed && (
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white">Mode AI System</span>
            <span className="text-xs text-sidebar-foreground/70">Wardrobe Studio</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {GROUP_ORDER.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          if (items.length === 0) {
            return null;
          }
          return (
            <div key={group} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {NAV_GROUP_LABELS[group]}
                </p>
              )}
              {items.map((item) => (
                <NavRow key={item.path} item={item} collapsed={collapsed} />
              ))}
            </div>
          );
        })}
      </nav>

      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'px-2')}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-md bg-white/5 px-3 py-2',
            collapsed && 'justify-center px-0',
          )}
          title={aiDetail}
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-full', ai.dot)} aria-hidden />
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-white">Motor IA</span>
              <span className="text-[11px] text-sidebar-foreground/70">{ai.label}</span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
