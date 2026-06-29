/**
 * GarmentCard — the catalog wardrobe tile. THE PHOTO IS THE GARMENT.
 *
 * The photograph dominates the card; below it the essentials appear: name,
 * category/subcategory, colour and tags. The photo is fetched lazily over IPC
 * by {@link GarmentImage} (with a graceful monogram fallback for garments that
 * have no photo yet). Right-click and the hover kebab both expose delete,
 * routed back to the caller via `onRemove`.
 */
import { MoreVertical, Trash2 } from 'lucide-react';

import type { GarmentDTO } from '@shared/ipc';

import { titleCase } from '../../lib/format';
import { thumbnailKeyOf } from '../../lib/garmentImages';
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
import { GarmentImage } from './GarmentImage';

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
          <div className="relative aspect-[4/5]">
            <GarmentImage
              storageKey={thumbnailKeyOf(garment)}
              alt={garment.name}
              className="h-full w-full"
            />
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
            <div className="absolute left-2 top-2">
              <Badge variant={STATUS_VARIANT[garment.status]}>{titleCase(garment.status)}</Badge>
            </div>
          </div>

          <div className="space-y-2 p-3">
            <div>
              <h3 className="truncate text-sm font-semibold text-foreground" title={garment.name}>
                {garment.name}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {titleCase(garment.category)} · {titleCase(garment.subcategory)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ColorDot hex={garment.color.hex} name={garment.color.name} />
              <span className="truncate">{garment.color.name}</span>
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
