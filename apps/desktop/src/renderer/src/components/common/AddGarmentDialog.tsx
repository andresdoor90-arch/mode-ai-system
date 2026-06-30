/**
 * AddGarmentDialog — the photo-first "add garment" experience.
 *
 * THE PHOTO IS THE GARMENT. Pressing "Agregar prenda" opens a dialog that asks
 * for a photo first — via file picker, drag-and-drop, or paste. As soon as an
 * image arrives it is analysed automatically ("Analizando la prenda…"); when
 * the analysis finishes the user sees a form ALREADY FILLED with the detected
 * attributes (type, colour, material, pattern, sleeve, …) plus a confidence
 * summary. Every field is editable but nothing is mandatory to change. Saving
 * persists the original image, an optimized thumbnail, the detected + corrected
 * attributes, the category and tags — all in SQLite via IPC.
 *
 * Nothing is fabricated: attributes the analyser could not determine are left
 * empty for the user. The flow degrades gracefully without the desktop bridge.
 */
import { ImagePlus, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AddGarmentPayload, CategoryNodeDTO, GarmentAnalysisResultDTO } from '@shared/ipc';

import { SEASON_OPTIONS } from '../../data/wardrobeOptions';
import { useToast } from '../../hooks/useToast';
import { ipc, isBridgeAvailable } from '../../ipc/client';
import { cn } from '../../lib/cn';
import {
  analysisPassthroughMetadata,
  analysisToDraft,
  draftToMetadata,
  parseTags,
  type GarmentDraft,
} from '../../lib/garmentAnalysis';
import { processImageFile, type ProcessedImage } from '../../lib/imageProcessing';
import { useWardrobeStore } from '../../store/wardrobeStore';
import { AnalysisAttributes } from './AnalysisAttributes';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from '../ui';

type Phase = 'await-photo' | 'processing' | 'analyzing' | 'ready' | 'saving';

/**
 * Maps a vision-detected coarse category to the structural body zone
 * (domain LayerSlot). Used ONLY to pre-select the best-matching user category
 * after analysis — never to fabricate a category. If nothing matches, the user
 * picks one of their own categories.
 */
const DETECTED_CATEGORY_TO_LAYER_SLOT: Readonly<Record<string, string>> = {
  tops: 'upper-body',
  dresses: 'full-body',
  bottoms: 'lower-body',
  outerwear: 'outer',
  shoes: 'feet',
  accessories: 'accessory',
};

/**
 * Editable list of secondary-colour hexes: pre-filled from the analysis, each
 * shown as a removable chip, with a colour picker to add more. Never invents —
 * starts empty when the model detected none.
 */
function SecondaryColorsField({
  colors,
  onChange,
}: {
  colors: readonly string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const [pending, setPending] = useState('#888888');
  const add = (): void => {
    const hex = pending.toLowerCase();
    if (!colors.includes(hex)) {
      onChange([...colors, hex]);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(colors.filter((c) => c !== hex))}
          className="group flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1.5 pr-2 text-xs"
          title="Quitar este color"
        >
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          <span className="text-muted-foreground">{hex}</span>
          <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-1"
          aria-label="Elegir un color secundario"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Añadir color
        </Button>
      </div>
    </div>
  );
}

export function AddGarmentDialog(): JSX.Element {
  const { toast } = useToast();
  const reloadWardrobe = useWardrobeStore((state) => state.load);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('await-photo');
  const [dragging, setDragging] = useState(false);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [result, setResult] = useState<GarmentAnalysisResultDTO | null>(null);
  const [draft, setDraft] = useState<GarmentDraft | null>(null);

  // Categories come exclusively from SQLite (user-created). No fixed list.
  const [categories, setCategories] = useState<readonly CategoryNodeDTO[]>([]);
  const [selectedTopId, setSelectedTopId] = useState<string>('');
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const topNode = categories.find((n) => n.category.id === selectedTopId) ?? null;
  const subOptions = topNode?.children ?? [];

  // Load the user's category tree whenever the dialog opens.
  useEffect(() => {
    if (!open || !isBridgeAvailable()) {
      return;
    }
    let active = true;
    void ipc
      .getCategoryTree()
      .then((tree) => {
        if (active) {
          setCategories(tree);
        }
      })
      .catch(() => {
        if (active) {
          setCategories([]);
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  // After an analysis completes, pre-select the user category whose zone best
  // matches the detected coarse category. Never invents a category.
  useEffect(() => {
    if (result === null || categories.length === 0 || selectedTopId !== '') {
      return;
    }
    const detected = result.analysis.category?.value;
    const wantSlot = detected !== undefined ? DETECTED_CATEGORY_TO_LAYER_SLOT[detected] : undefined;
    const match =
      wantSlot !== undefined
        ? categories.find((n) => n.category.metadata.layerSlot === wantSlot)
        : undefined;
    if (match !== undefined) {
      setSelectedTopId(match.category.id);
    }
  }, [result, categories, selectedTopId]);

  const setField = <K extends keyof GarmentDraft>(key: K, value: GarmentDraft[K]): void =>
    setDraft((prev) => (prev === null ? prev : { ...prev, [key]: value }));

  const reset = useCallback((): void => {
    setProcessed(null);
    setResult(null);
    setDraft(null);
    setDragging(false);
    setSelectedTopId('');
    setSelectedSubId('');
    setPhase('await-photo');
  }, []);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) {
      reset();
    }
  };

  const analyze = useCallback(
    async (image: ProcessedImage): Promise<void> => {
      setPhase('analyzing');
      try {
        const analysis = await ipc.analyzeGarment({
          colorSamples: image.colorSamples,
          image: { base64: image.base64, mimeType: image.mimeType },
        });
        // Diagnostic: shows in DevTools which providers actually ran. If
        // `providers` lacks 'ollama-vision', the model was not reached/installed;
        // if it is present but populatedFields is low, the model replied poorly.
        // eslint-disable-next-line no-console
        console.info('[addGarment] analysis', {
          providers: analysis.providers,
          visionAvailable: analysis.visionAvailable,
          populatedFields: analysis.populatedFields,
          fields: Object.keys(analysis.analysis),
        });
        setResult(analysis);
        setDraft(analysisToDraft(analysis.analysis));
      } catch (error) {
        toast({
          title: 'No se pudo analizar la imagen',
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
        setResult({
          analysis: {},
          providers: [],
          visionAvailable: false,
          overallConfidence: 0,
          populatedFields: 0,
        });
        setDraft(analysisToDraft({}));
      } finally {
        setPhase('ready');
      }
    },
    [toast],
  );

  const acceptImage = useCallback(
    async (file: File): Promise<void> => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Archivo no válido',
          description: 'Selecciona una imagen.',
          variant: 'warning',
        });
        return;
      }
      setPhase('processing');
      try {
        const image = await processImageFile(file);
        setProcessed(image);
        await analyze(image);
      } catch (error) {
        toast({
          title: 'No se pudo abrir la imagen',
          description: error instanceof Error ? error.message : 'Prueba con otra fotografía.',
          variant: 'destructive',
        });
        setPhase('await-photo');
      }
    },
    [analyze, toast],
  );

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) {
      void acceptImage(file);
    }
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file !== undefined) {
      void acceptImage(file);
    }
  };

  const onPaste = (event: React.ClipboardEvent): void => {
    const item = Array.from(event.clipboardData.items).find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file !== null && file !== undefined) {
      event.preventDefault();
      void acceptImage(file);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (processed === null || result === null || draft === null) {
      return;
    }
    if (!isBridgeAvailable()) {
      toast({
        title: 'No disponible en vista previa',
        description: 'Guardar prendas requiere la aplicación de escritorio.',
        variant: 'warning',
      });
      return;
    }
    if (draft.name.trim().length === 0) {
      toast({
        title: 'Falta el nombre',
        description: 'Dale un nombre a la prenda.',
        variant: 'warning',
      });
      return;
    }
    const top = topNode?.category;
    if (top === undefined) {
      toast({
        title: 'Falta la categoría',
        description: 'Elige una categoría para la prenda.',
        variant: 'warning',
      });
      return;
    }
    const sub = subOptions.find((c) => c.id === selectedSubId);
    setPhase('saving');
    try {
      const saved = await ipc.saveImage({
        dataBase64: processed.base64,
        mimeType: processed.mimeType,
        extension: processed.extension,
        ...(processed.thumbnailBase64.length > 0
          ? { thumbnailBase64: processed.thumbnailBase64 }
          : {}),
      });

      // The domain requires at least one season; if the model didn't determine
      // one and the user left it blank, fall back to the neutral "all-season"
      // (applies-to-all — not a fabricated specific-season claim).
      const seasons = draft.season.trim().length > 0 ? [draft.season] : ['all-season'];

      const payload: AddGarmentPayload = {
        name: draft.name.trim(),
        category: top.slug,
        subcategory: sub?.slug ?? top.slug,
        categoryId: sub?.id ?? top.id,
        colorHex: draft.colorHex,
        ...(draft.colorName.trim().length > 0 ? { colorName: draft.colorName.trim() } : {}),
        ...(draft.secondaryColors.length > 0 ? { secondaryColorHexes: draft.secondaryColors } : {}),
        seasons,
        ...(draft.brand.trim().length > 0 ? { brand: draft.brand.trim() } : {}),
        ...(draft.material.trim().length > 0 ? { material: draft.material.trim() } : {}),
        ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
        ...(draft.notes.trim().length > 0 ? { notes: draft.notes.trim() } : {}),
        // Rich attributes persisted in the metadata bag: the user's EDITED
        // values, plus detected extras (texture/length/fit/gender) that have no
        // dedicated control, plus the category's structural try-on zone.
        metadata: {
          ...analysisPassthroughMetadata(result.analysis),
          ...draftToMetadata(draft, result.overallConfidence),
          layerSlot: top.metadata.layerSlot,
        },
      };

      const { id } = await ipc.addGarment(payload);
      const attributes: Record<string, string> = {
        analysisConfidence: result.overallConfidence.toFixed(2),
        ...(saved.thumbnailKey !== null ? { thumbnailKey: saved.thumbnailKey } : {}),
      };
      await ipc.addPhotos(id, [{ storageKey: saved.storageKey, attributes }]);

      await reloadWardrobe();
      toast({
        title: 'Prenda añadida',
        description: `"${payload.name}" se añadió a tu guardarropa.`,
        variant: 'success',
      });
      handleOpenChange(false);
    } catch (error) {
      setPhase('ready');
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const busy = phase === 'processing' || phase === 'analyzing';
  const noCategories = categories.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Agregar prenda
      </Button>

      <DialogContent className="max-w-3xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle>Nueva prenda</DialogTitle>
          <DialogDescription>
            La fotografía es la prenda. Súbela y la IA completará los datos por ti.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={onFileChange}
        />

        {processed === null ? (
          /* ----------------------- Step 1: ask for a photo ---------------------- */
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
          >
            {busy ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Preparando la imagen…</p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Arrastra una foto, pégala o haz clic para elegir
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG o WebP</p>
                </div>
              </>
            )}
          </button>
        ) : (
          /* ----------------- Steps 2–4: preview + prefilled form ---------------- */
          <div className="grid max-h-[68vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[minmax(0,300px)_1fr]">
            <div className="space-y-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <img
                  src={processed.previewDataUrl}
                  alt="Prenda seleccionada"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {busy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">Analizando la prenda…</p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus className="h-4 w-4" />
                Cambiar fotografía
              </Button>
            </div>

            {draft !== null && result !== null ? (
              <div className="space-y-5">
                {noCategories && (
                  <div className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning">
                    Aún no tienes categorías. Crea al menos una en la sección{' '}
                    <span className="font-semibold">Categorías</span> para poder guardar esta
                    prenda.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Nombre sugerido"
                    htmlFor="g-name"
                    required
                    className="sm:col-span-2"
                  >
                    <Input
                      id="g-name"
                      value={draft.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="Camisa de lino azul"
                    />
                  </FormField>
                  <FormField label="Estilo" htmlFor="g-style">
                    <Input
                      id="g-style"
                      value={draft.style}
                      onChange={(e) => setField('style', e.target.value)}
                      placeholder="Casual, formal, urbano…"
                    />
                  </FormField>
                  <FormField label="Categoría" htmlFor="g-category">
                    <Select
                      id="g-category"
                      value={selectedTopId}
                      onChange={(e) => {
                        setSelectedTopId(e.target.value);
                        setSelectedSubId('');
                      }}
                      disabled={noCategories}
                    >
                      <option value="">Selecciona una categoría…</option>
                      {categories.map((node) => (
                        <option key={node.category.id} value={node.category.id}>
                          {node.category.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Subcategoría" htmlFor="g-subcategory">
                    <Select
                      id="g-subcategory"
                      value={selectedSubId}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      disabled={selectedTopId === '' || subOptions.length === 0}
                    >
                      <option value="">
                        {subOptions.length === 0 ? 'Sin subcategorías' : 'Sin subcategoría'}
                      </option>
                      {subOptions.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Color principal" htmlFor="g-color">
                    <div className="flex items-center gap-2">
                      <input
                        id="g-color"
                        type="color"
                        value={draft.colorHex}
                        onChange={(e) => setField('colorHex', e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                        aria-label="Color principal"
                      />
                      <Input
                        value={draft.colorName}
                        onChange={(e) => setField('colorName', e.target.value)}
                        placeholder="Azul petróleo"
                      />
                    </div>
                  </FormField>
                  <FormField label="Temporada recomendada" htmlFor="g-season">
                    <Select
                      id="g-season"
                      value={draft.season}
                      onChange={(e) => setField('season', e.target.value)}
                    >
                      <option value="">Sin determinar</option>
                      {SEASON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    label="Colores secundarios"
                    hint="Detectados por la IA · haz clic en un color para quitarlo"
                    className="sm:col-span-2"
                  >
                    <SecondaryColorsField
                      colors={draft.secondaryColors}
                      onChange={(next) => setField('secondaryColors', next)}
                    />
                  </FormField>
                  <FormField label="Material" htmlFor="g-material">
                    <Input
                      id="g-material"
                      value={draft.material}
                      onChange={(e) => setField('material', e.target.value)}
                      placeholder="Lino, algodón, mezclilla…"
                    />
                  </FormField>
                  <FormField label="Patrón o estampado" htmlFor="g-pattern">
                    <Input
                      id="g-pattern"
                      value={draft.pattern}
                      onChange={(e) => setField('pattern', e.target.value)}
                      placeholder="Liso, rayas, cuadros…"
                    />
                  </FormField>
                  <FormField label="Tipo de manga" htmlFor="g-sleeve">
                    <Input
                      id="g-sleeve"
                      value={draft.sleeve}
                      onChange={(e) => setField('sleeve', e.target.value)}
                      placeholder="Manga larga, corta, sin mangas…"
                    />
                  </FormField>
                  <FormField label="Tipo de cuello" htmlFor="g-neckline">
                    <Input
                      id="g-neckline"
                      value={draft.neckline}
                      onChange={(e) => setField('neckline', e.target.value)}
                      placeholder="Cuello redondo, en V, mao…"
                    />
                  </FormField>
                  <FormField label="Nivel de formalidad" htmlFor="g-formality" hint="0 a 10">
                    <Input
                      id="g-formality"
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={draft.formality}
                      onChange={(e) => setField('formality', e.target.value)}
                      placeholder="0–10"
                    />
                  </FormField>
                  <FormField
                    label="Ocasiones recomendadas"
                    htmlFor="g-occasions"
                    hint="Separadas por comas"
                  >
                    <Input
                      id="g-occasions"
                      value={draft.occasions}
                      onChange={(e) => setField('occasions', e.target.value)}
                      placeholder="formal, trabajo, fiesta…"
                    />
                  </FormField>
                  <FormField label="Marca" htmlFor="g-brand" hint="Opcional">
                    <Input
                      id="g-brand"
                      value={draft.brand}
                      onChange={(e) => setField('brand', e.target.value)}
                      placeholder="Opcional"
                    />
                  </FormField>
                  <FormField label="Etiquetas" htmlFor="g-tags" hint="Separadas por comas">
                    <Input
                      id="g-tags"
                      value={draft.tags.join(', ')}
                      onChange={(e) => setField('tags', parseTags(e.target.value))}
                      placeholder="trabajo, clásico"
                    />
                  </FormField>
                  <FormField
                    label="Observaciones"
                    htmlFor="g-notes"
                    hint="Opcional"
                    className="sm:col-span-2"
                  >
                    <Textarea
                      id="g-notes"
                      value={draft.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                      placeholder="Notas personales sobre la prenda…"
                      className="min-h-[64px]"
                    />
                  </FormField>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div
                    className={cn(
                      'mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs',
                      result.visionAvailable
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/15 text-warning',
                    )}
                  >
                    {result.visionAvailable ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Analizado con IA de visión (Ollama) · {result.populatedFields}{' '}
                        características
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        IA de visión no disponible: solo se detectó el color. Verifica que Ollama
                        esté activo con el modelo qwen2.5vl:7b.
                      </>
                    )}
                  </div>
                  <AnalysisAttributes
                    analysis={result.analysis}
                    overallConfidence={result.overallConfidence}
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                <Sparkles className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">Analizando tu prenda…</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={phase !== 'ready' || draft === null || selectedTopId === ''}
          >
            {phase === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Guardar prenda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
