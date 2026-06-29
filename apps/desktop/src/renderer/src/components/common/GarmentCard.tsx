/**
 * GarmentCard — the canonical wardrobe item tile.
 *
 * Presents a garment's key attributes (name, category, colour, brand, status,
 * tags, wear count) on a Card, with a thumbnail area that falls back to an
 * initial-style monogram when no image exists. Right-click exposes a context
 * menu and a kebab button exposes the same actions, both routed back to the
 * caller via `onRemove`. Purely presentational beyond those callbacks.
 */
import { MoreVertical, Shirt, Trash2 } from 'lucide-react';

import type { GarmentDTO } from '@shared/ipc';

import { titleCase } from '../../lib/format';
import { Badge, type BadgeProps } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ColorDot } from './ColorDot';

const STATUS_VARIANT: Record<GarmentDTO['status'], BadgeProps['variant']> = {
  available: 'success',
  'in-laundry': 'warning',
  damaged: 'destructive',
  archived: 'secondary',
};

export interface GarmentCardProps {
  garment: GarmentDTO;
  onRemove?: (id: string) => void;
}

export function GarmentCard({ garment, onRemove }: GarmentCardProps): JSX.Element {
  const actions = (
    <>
      <ContextMenuLabel>{garment.name}</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem
        className="text-destructive focus:text-destructive"
        onSelect={() => onRemove?.(garment.id)}
      >
        <Trash2 className="h-4 w-4" />
        Eliminar prenda
      </ContextMenuItem>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="group overflow-hidden transition-shadow hover:shadow-elevated">
          <div
            className="relative flex aspect-[4/3] items-center justify-center"
            style={{ backgroundColor: `${garment.color.hex}1a` }}
          >
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: garment.color.hex }}
            >
              <Shirt className="h-7 w-7 opacity-90" />
            </span>
            <div className="absolute right-2 top-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-label="Acciones de la prenda"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onRemove?.(garment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">{garment.name}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {titleCase(garment.category)} · {titleCase(garment.subcategory)}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[garment.status]}>{titleCase(garment.status)}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ColorDot hex={garment.color.hex} name={garment.color.name} />
                <span>{garment.color.name}</span>
              </div>
              {garment.brand !== null && (
                <span className="truncate text-xs text-muted-foreground">{garment.brand}</span>
              )}
            </div>

            {garment.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {garment.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>{actions}</ContextMenuContent>
    </ContextMenu>
  );
}
