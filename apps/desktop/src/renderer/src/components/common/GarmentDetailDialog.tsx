/**
 * GarmentDetailDialog — the full view of a single garment.
 *
 * Opens from a catalog card. Shows the full-resolution photograph (click to
 * zoom), the detected + manual attributes, tags, usage frequency and dates, and
 * the actions: favourite, rename, delete, and replace photo. Replacing the
 * photo re-runs the vision analysis on the new image and refreshes the detected
 * colours/attributes while preserving the user's manual name, material and tags.
 *
 * All mutations go through the IPC client and then refresh the wardrobe store,
 * so the dialog always reflects the real persisted state.
 */
import {
  Calendar,
  Check,
  Heart,
  Loader2,
  Pencil,
  RefreshCw,
  Repeat,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { useRef, useState } from 'react';

import type { GarmentDTO } from '@shared/ipc';

import { useToast } from '../../hooks/useToast';
import { ipc } from '../../ipc/client';
import { cn } from '../../lib/cn';
import { titleCase } from '../../lib/format';
import { buildGarmentMetadata, garmentDetailAttributes } from '../../lib/garmentAnalysis';
import { fullImageKeyOf } from '../../lib/garmentImages';
import { processImageFile } from '../../lib/imageProcessing';
import { useWardrobeStore } from '../../store/wardrobeStore';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '../ui';
import { GarmentImage } from './GarmentImage';

export interface GarmentDetailDialogProps {
  garment: GarmentDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GarmentDetailDialog({
  garment,
  open,
  onOpenChange,
}: GarmentDetailDialogProps): JSX.Element {
  const { toast } = useToast();
  const reload = useWardrobeStore((state) => state.load);
  const removeGarment = useWardrobeStore((state) => state.removeGarment);
  const toggleFavorite = useWardrobeStore((state) => state.toggleFavorite);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [zoom, setZoom] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [replacing, setReplacing] = useState(false);

  if (garment === null) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  const rows = garmentDetailAttributes(garment);
  const isFavorite = garment.favorite === true;

  const startEdit = (): void => {
    setNameDraft(garment.name);
    setEditing(true);
  };

  const saveName = async (): Promise<void> => {
    const name = nameDraft.trim();
    if (name.length === 0 || name === garment.name) {
      setEditing(false);
      return;
    }
    try {
      await ipc.updateGarment({ id: garment.id, name });
      await reload();
      toast({ title: 'Nombre actualizado', variant: 'success' });
    } catch (error) {
      toast({
        title: 'No se pudo renombrar',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = (): void => {
    void removeGarment(garment.id);
    toast({ title: 'Prenda eliminada', variant: 'default' });
    onOpenChange(false);
  };

  const handleReplace = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) {
      return;
    }
    setReplacing(true);
    let previewUrl: string | undefined;
    try {
      const image = await processImageFile(file);
      previewUrl = image.previewUrl;
      const result = await ipc.analyzeGarment({ colorSamples: image.colorSamples });
      const saved = await ipc.saveImage({
        dataBase64: image.base64,
        mimeType: image.mimeType,
        extension: image.extension,
        ...(image.thumbnailBase64.length > 0 ? { thumbnailBase64: image.thumbnailBase64 } : {}),
      });

      // Refresh detected colours + attributes; keep manual name/material/tags.
      const primaryHex = result.analysis.primaryColor?.value;
      await ipc.confirmTags({
        garmentId: garment.id,
        ...(primaryHex !== undefined ? { primaryColorHex: primaryHex } : {}),
        ...(result.analysis.secondaryColors !== undefined
          ? { secondaryColorHexes: [...result.analysis.secondaryColors.value] }
          : {}),
        metadataPatch: buildGarmentMetadata(result.analysis, result.overallConfidence),
      });

      // Swap the photo: remove the old primary, add the new one.
      const oldPrimary = garment.photos.find((p) => p.isPrimary) ?? garment.photos[0];
      if (oldPrimary !== undefined) {
        await ipc.removePhoto(garment.id, oldPrimary.id);
      }
      const attributes: Record<string, string> = {
        analysisConfidence: result.overallConfidence.toFixed(2),
        ...(saved.thumbnailKey !== null ? { thumbnailKey: saved.thumbnailKey } : {}),
      };
      await ipc.addPhotos(garment.id, [{ storageKey: saved.storageKey, attributes }]);
      await reload();
      toast({
        title: 'Fotografía reemplazada',
        description: 'Se reanalizó la prenda.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'No se pudo reemplazar la fotografía',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      if (previewUrl !== undefined) {
        URL.revokeObjectURL(previewUrl);
      }
      setReplacing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{garment.name}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de la prenda</DialogDescription>
        </DialogHeader>

        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => void handleReplace(e)}
        />

        <div className="grid max-h-[78vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Photo */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setZoom((z) => !z)}
              className="relative block w-full overflow-hidden rounded-xl bg-muted"
              aria-label={zoom ? 'Reducir' : 'Ampliar'}
            >
              <GarmentImage
                storageKey={fullImageKeyOf(garment)}
                alt={garment.name}
                className={cn(
                  'w-full transition-transform duration-300',
                  zoom ? 'aspect-auto scale-110' : 'aspect-[4/5]',
                )}
              />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
                <ZoomIn className="h-3 w-3" />
                {zoom ? 'Reducir' : 'Ampliar'}
              </span>
              {replacing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <span className="text-sm font-medium">Reanalizando…</span>
                </div>
              )}
            </button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => replaceInputRef.current?.click()}
              disabled={replacing}
            >
              <RefreshCw className="h-4 w-4" />
              Reemplazar fotografía
            </Button>
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void saveName();
                      }
                    }}
                  />
                  <Button size="icon" onClick={() => void saveName()} aria-label="Guardar nombre">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-semibold text-foreground">{garment.name}</h2>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="mt-1 text-muted-foreground hover:text-foreground"
                    aria-label="Editar nombre"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {titleCase(garment.category)} · {titleCase(garment.subcategory)}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant={isFavorite ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => void toggleFavorite(garment.id)}
              >
                <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                {isFavorite ? 'Favorito' : 'Favorito'}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <dl className="space-y-1.5">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5 text-sm"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-foreground">{garment.wearCount}</p>
                  <p className="text-xs text-muted-foreground">usos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-foreground">{garment.lastWornAt ?? 'Nunca'}</p>
                  <p className="text-xs text-muted-foreground">último uso</p>
                </div>
              </div>
            </div>

            {garment.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {garment.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
