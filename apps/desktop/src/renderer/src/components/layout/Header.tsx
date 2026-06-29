/**
 * Header — top application bar.
 *
 * Hosts the sidebar collapse toggle, breadcrumbs, a global search field, the
 * theme switcher and the user menu. Sticky to the top of the content column and
 * theme-aware. The search is presentational in Phase 4 (wired to filtering in a
 * later phase) but is part of the definitive layout.
 */
import { Menu, PanelLeftClose, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useUiStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import { initials } from '../../lib/format';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeSwitcher } from './ThemeSwitcher';

export function Header(): JSX.Element {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const profile = useUserStore((state) => state.profile);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Alternar barra lateral"
          >
            {collapsed ? (
              <Menu className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{collapsed ? 'Expandir' : 'Contraer'}</TooltipContent>
      </Tooltip>

      <div className="hidden md:block">
        <Breadcrumbs />
      </div>

      <div className="relative ml-auto w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar prendas, conjuntos…"
          aria-label="Buscar"
          className="pl-9"
        />
      </div>

      <ThemeSwitcher />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2"
            aria-label="Menú de usuario"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials(profile.name)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{profile.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{profile.handle}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">Ver perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">Configuración</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
