/**
 * Virtual Try-On — a simple, fast 2D paper-doll.
 *
 * The user assembles an outfit by picking garments from their own wardrobe,
 * one per body slot (top, bottom, outerwear, belt, shoes, accessory). Each
 * pick paints a SIMPLIFIED representation of that garment (its colour + pattern,
 * derived from the photo analysis — never the photo itself) onto a flat,
 * minimal mannequin, which updates immediately. No 3D, no WebGL: instant and
 * stable.
 */
import { Shirt, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from '../components/common/EmptyState';
import { GarmentImage } from '../components/common/GarmentImage';
import { PageHeader } from '../components/common/PageHeader';
import { TryOnMannequin } from '../components/common/TryOnMannequin';
import { Badge, Button, Card, CardContent } from '../components/ui';
import { cn } from '../lib/cn';
import { titleCase } from '../lib/format';
import { thumbnailKeyOf } from '../lib/garmentImages';
import {
  buildOutfitLayers,
  OUTFIT_SLOTS,
  selectionFromGarments,
  slotForGarment,
  type OutfitSelection,
  type SlotId,
} from '../lib/outfitModel';
import { useRecommendationStore } from '../store/recommendationStore';
import { useWardrobeStore } from '../store/wardrobeStore';

export function VirtualTryOnPage(): JSX.Element {
  const loaded = useWardrobeStore((s) => s.loaded);
  const load = useWardrobeStore((s) => s.load);
  const garments = useWardrobeStore((s) => s.garments);

  // The advisor can ask us to dress the mannequin with its chosen outfit. We
  // apply it ONCE per request (tracked by a nonce) so the user can keep editing.
  const recoSet = useRecommendationStore((s) => s.set);
  const recoKind = useRecommendationStore((s) => s.selectedKind);
  const tryOnRequestId = useRecommendationStore((s) => s.tryOnRequestId);

  const [selection, setSelection] = useState<OutfitSelection>({});
  const [fromAdvisor, setFromAdvisor] = useState(false);
  const appliedRequestRef = useRef(0);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    if (tryOnRequestId === 0 || tryOnRequestId === appliedRequestRef.current) {
      return;
    }
    appliedRequestRef.current = tryOnRequestId;
    const rec =
      recoSet?.recommendations.find((r) => r.kind === recoKind) ??
      recoSet?.recommendations[0] ??
      null;
    if (rec !== null && rec !== undefined) {
      setSelection(selectionFromGarments(rec.garments));
      setFromAdvisor(true);
    }
  }, [tryOnRequestId, recoSet, recoKind]);

  // Garments grouped by the body slot they occupy (only wearable ones).
  const bySlot = useMemo(() => {
    const groups = Object.fromEntries(
      OUTFIT_SLOTS.map((s) => [s.id, [] as typeof garments]),
    ) as Record<SlotId, typeof garments>;
    for (const garment of garments) {
      const slot = slotForGarment(garment);
      if (slot !== null) {
        groups[slot].push(garment);
      }
    }
    return groups;
  }, [garments]);

  const layers = useMemo(() => buildOutfitLayers(selection), [selection]);

  const assign = (slot: SlotId, garmentId: string): void => {
    setFromAdvisor(false);
    setSelection((prev) => {
      if (prev[slot]?.id === garmentId) {
        const next = { ...prev };
        delete next[slot];
        return next;
      }
      const garment = garments.find((g) => g.id === garmentId);
      return garment === undefined ? prev : { ...prev, [slot]: garment };
    });
  };

  const clearSlot = (slot: SlotId): void => {
    setFromAdvisor(false);
    setSelection((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const clearAll = (): void => {
    setFromAdvisor(false);
    setSelection({});
  };

  if (loaded && garments.length === 0) {
    return (
      <div>
        <PageHeader
          title="Probador virtual"
          description="Arma un conjunto con tus prendas y míralo en el maniquí."
        />
        <EmptyState
          icon={Shirt}
          title="Tu guardarropa está vacío"
          description="Agrega prendas con fotografía en el guardarropa para poder probarlas aquí."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Probador virtual"
        description="Elige una prenda por zona y míralas combinadas en el maniquí al instante."
        actions={
          <div className="flex items-center gap-2">
            {fromAdvisor && (
              <Badge variant="secondary">
                <Sparkles className="h-3.5 w-3.5" />
                Vestido por el asesor
              </Badge>
            )}
            <Button variant="outline" onClick={clearAll} disabled={layers.length === 0}>
              <X className="h-4 w-4" />
              Vaciar conjunto
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        {/* ------------------------------- mannequin ------------------------------ */}
        <Card className="bg-gradient-to-b from-zinc-900 to-zinc-950">
          <CardContent className="flex items-center justify-center p-4">
            <TryOnMannequin layers={layers} className="h-[520px] w-auto" />
          </CardContent>
        </Card>

        {/* ----------------------------- outfit builder --------------------------- */}
        <div className="space-y-5">
          {OUTFIT_SLOTS.filter(
            ({ id }) => bySlot[id].length > 0 || selection[id] !== undefined,
          ).map(({ id, label }) => {
            const options = bySlot[id];
            const selected = selection[id];
            return (
              <div key={id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  {selected !== undefined && (
                    <Button variant="ghost" size="sm" onClick={() => clearSlot(id)}>
                      <X className="h-3.5 w-3.5" />
                      Quitar
                    </Button>
                  )}
                </div>
                {options.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                    No tienes prendas en esta zona todavía.
                  </p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {options.map((garment) => {
                      const isSelected = selected?.id === garment.id;
                      return (
                        <button
                          key={garment.id}
                          type="button"
                          onClick={() => assign(id, garment.id)}
                          title={garment.name}
                          className={cn(
                            'group relative flex w-24 shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-colors',
                            isSelected
                              ? 'border-primary ring-2 ring-primary/40'
                              : 'border-border hover:border-primary/50',
                          )}
                        >
                          <GarmentImage
                            storageKey={thumbnailKeyOf(garment)}
                            alt={garment.name}
                            className="aspect-square w-full"
                          />
                          <span className="truncate px-1.5 py-1 text-[11px] font-medium text-foreground">
                            {garment.name}
                          </span>
                          {isSelected && (
                            <span className="absolute right-1 top-1">
                              <Badge variant="success">✓</Badge>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
