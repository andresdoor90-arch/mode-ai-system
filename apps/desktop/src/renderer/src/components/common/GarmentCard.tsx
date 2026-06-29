/**
 * GarmentCard — the catalog tile. THE PHOTO IS THE GARMENT.
 *
 * The photograph dominates (~80% of the card); below it only the essentials
 * appear: name, category, favourite and wear frequency. All technical detail
 * lives in the detail view, opened by clicking the card. A favourite heart and
 * a delete action overlay the image; both stop propagation so they do not also
 * open the detail.
 */
import { Heart, MoreVertical, Repeat, Trash2 } from 'lucide-react';

import type { GarmentDTO } from '@shared/ipc';

import { cn } from '../../lib/cn';
import { titleCase } from '../../lib/format';
import { thumbnailKeyOf } from '../../lib/garmentImages';
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
import { GarmentImage } from './GarmentImage';

export interface GarmentCardProps {
  garment: GarmentDTO;
  onOpen?: (id: string) => void;
  onRemove?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export function GarmentCard({
  garment,
  onOpen,
  onRemove,
  onToggleFavorite,
}: GarmentCardProps): JSX.Element {
  const isFavorite = garment.favorite === true;

  const stop = (e: React.MouseEvent): void => {
    e.stopPropagation();
  };

  const actions = (
    <>
      <ContextMenuLabel>{garment.name}</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onToggleFavorite?.(garment.id)}>
        <Heart className="h-4 w-4" />
        {isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
      </ContextMenuItem>
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
        <Card
          className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-elevated"
          onClick={() => onOpen?.(garment.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen?.(garment.id);
            }
          }}
        >
          <div className="relative aspect-[4/5]">
            <GarmentImage
              storageKey={thumbnailKeyOf(garment)}
              alt={garment.name}
              className="h-full w-full"
            />

            {/* Favourite heart */}
            <button
              type="button"
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={isFavorite}
              onClick={(e) => {
                stop(e);
                onToggleFavorite?.(garment.id);
              }}
              className={cn(
                'absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur transition-colors hover:bg-background',
                isFavorite ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>

            {/* Actions */}
            <div className="absolute right-2 top-2" onClick={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-label="Acciones de la prenda"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onToggleFavorite?.(garment.id)}>
                    <Heart className="h-4 w-4" />
                    {isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
                  </DropdownMenuItem>
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

          <div className="space-y-1 p-3">
            <h3 className="truncate text-sm font-semibold text-foreground" title={garment.name}>
              {garment.name}
            </h3>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{titleCase(garment.category)}</span>
              <span className="flex items-center gap-1" title="Frecuencia de uso">
                <Repeat className="h-3 w-3" />
                {garment.wearCount}
              </span>
            </div>
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>{actions}</ContextMenuContent>
    </ContextMenu>
  );
}
