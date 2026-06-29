/**
 * AddGarmentDialog — the photo-first "add garment" experience.
 *
 * THE PHOTO IS THE GARMENT. Pressing "Añadir prenda" opens the OS file picker
 * immediately; once an image is chosen the dialog opens, shows the photo, and
 * the vision analysis runs automatically ("Analizando la prenda…"). When it
 * finishes the user sees an editable preview card with the detected attributes
 * and a confidence score, plus an optional free-text box ("Ayuda a mejorar el
 * análisis") that re-runs the analysis using their notes. Saving persists the
 * original image, an optimized thumbnail, the detected + corrected attributes,
 * and the garment — all in SQLite via IPC.
 *
 * Nothing is fabricated: fields the analyser could not determine are left empty
 * for the user to fill. The flow degrades gracefully without the desktop bridge
 * (preview builds), showing a clear message instead of failing silently.
 */
import { ImagePlus, Loader2, Plus, Sparkles, Wand2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import type { AddGarmentPayload, GarmentAnalysisResultDTO } from '@shared/ipc';

import { CATEGORY_OPTIONS, SEASON_OPTIONS, SUBCATEGORY_OPTIONS } from '../../data/wardrobeOptions';
import { useToast } from '../../hooks/useToast';
import { ipc, isBridgeAvailable } from '../../ipc/client';
import {
  analysisToDraft,
  buildGarmentMetadata,
  parseTags,
  secondaryColorHexes,
  type GarmentDraft,
} from '../../lib/garmentAnalysis';
import { processImageFile, type ProcessedImage } from '../../lib/imageProcessing';
import { useWardrobeStore } from '../../store/wardrobeStore';
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
import { AnalysisAttributes } from './AnalysisAttributes';

type Phase = 'processing' | 'analyzing' | 'ready' | 'saving';

export function AddGarmentDialog(): JSX.Element {
  const { toast } = useToast();
  const reloadWardrobe = useWardrobeStore((state) => state.load);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('processing');
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [result, setResult] = useState<GarmentAnalysisResultDTO | null>(null);
  const [draft, setDraft] = useState<GarmentDraft | null>(null);
  const [freeText, setFreeText] = useState('');

  const set = <K extends keyof GarmentDraft>(key: K, value: GarmentDraft[K]): void =>
    setDraft((prev) => (prev === null ? prev : { ...prev, [key]: value }));

  const reset = useCallback((): void => {
    if (processed !== null) {
      URL.revokeObjectURL(processed.previewUrl);
    }
    setProcessed(null);
    setResult(null);
    setDraft(null);
    setFreeText('');
    setPhase('processing');
  }, [processed]);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) {
      reset();
    }
  };

  /** Pressing the button opens the OS file picker straight away. */
  const handlePick = (): void => {
    if (!isBridgeAvailable()) {
      toast({
        title: 'No disponible en vista previa',
        description: 'Añadir prendas requiere la aplicación de escritorio.',
        variant: 'warning',
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const runAnalysis = useCallback(
    async (image: ProcessedImage, notes: string): Promise<void> => {
      setPhase('analyzing');
      try {
        const analysis = await ipc.analyzeGarment({
          colorSamples: image.colorSamples,
          ...(notes.trim().length > 0 ? { freeText: notes.trim() } : {}),
        });
        setResult(analysis);
        setDraft(analysisToDraft(analysis.analysis));
      } catch (error) {
        toast({
          title: 'No se pudo analizar la imagen',
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setPhase('ready');
      }
    },
    [toast],
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file later
    if (file === undefined) {
      return;
    }
    setOpen(true);
    setPhase('processing');
    try {
      const image = await processImageFile(file);
      setProcessed(image);
      await runAnalysis(image, '');
    } catch (error) {
      toast({
        title: 'No se pudo abrir la imagen',
        description: error instanceof Error ? error.message : 'Selecciona otra fotografía.',
        variant: 'destructive',
      });
      handleOpenChange(false);
    }
  };

  const handleRefine = (): void => {
    if (processed === null) {
      return;
    }
    void runAnalysis(processed, freeText);
  };

  const handleSave = async (): Promise<void> => {
    if (processed === null || result === null || draft === null) {
      return;
    }
    if (draft.name.trim().length === 0) {
      toast({
        title: 'Falta el nombre',
        description: 'Dale un nombre a la prenda antes de guardar.',
        variant: 'warning',
      });
      return;
    }
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

      const payload: AddGarmentPayload = {
        name: draft.name.trim(),
        category: draft.category,
        subcategory: draft.subcategory,
        colorHex: draft.colorHex,
        ...(draft.colorName.trim().length > 0 ? { colorName: draft.colorName.trim() } : {}),
        seasons: [draft.season],
        ...(draft.material.trim().length > 0 ? { material: draft.material.trim() } : {}),
        ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
        ...(freeText.trim().length > 0 ? { notes: freeText.trim() } : {}),
        secondaryColorHexes: secondaryColorHexes(result.analysis),
        metadata: buildGarmentMetadata(result.analysis, result.overallConfidence),
      };

      const { id } = await ipc.addGarment(payload);
      const photoAttributes: Record<string, string> = {
        analysisConfidence: result.overallConfidence.toFixed(2),
        ...(saved.thumbnailKey !== null ? { thumbnailKey: saved.thumbnailKey } : {}),
      };
      await ipc.addPhotos(id, [{ storageKey: saved.storageKey, attributes: photoAttributes }]);

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

  const subcategories = draft !== null ? (SUBCATEGORY_OPTIONS[draft.category] ?? []) : [];
  const busy = phase === 'processing' || phase === 'analyzing';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <Button onClick={handlePick}>
        <Plus className="h-4 w-4" />
        Añadir prenda
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva prenda</DialogTitle>
            <DialogDescription>
              La fotografía es la prenda. Revisa lo que detectó la IA y ajústalo si quieres.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[minmax(0,320px)_1fr]">
            {/* Photo */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
              {processed !== null ? (
                <img
                  src={processed.previewUrl}
                  alt="Prenda seleccionada"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImagePlus className="h-10 w-10 text-muted-foreground/50" />
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {phase === 'processing' ? 'Preparando la imagen…' : 'Analizando la prenda…'}
                  </p>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-5">
              {draft !== null && result !== null ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Nombre" htmlFor="g-name" required className="sm:col-span-2">
                      <Input
                        id="g-name"
                        value={draft.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="Camisa de lino azul"
                      />
                    </FormField>
                    <FormField label="Categoría" htmlFor="g-category">
                      <Select
                        id="g-category"
                        value={draft.category}
                        onChange={(e) => {
                          const category = e.target.value;
                          const first = SUBCATEGORY_OPTIONS[category]?.[0]?.value ?? '';
                          setDraft((prev) =>
                            prev === null ? prev : { ...prev, category, subcategory: first },
                          );
                        }}
                      >
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Subcategoría" htmlFor="g-subcategory">
                      <Select
                        id="g-subcategory"
                        value={draft.subcategory}
                        onChange={(e) => set('subcategory', e.target.value)}
                      >
                        {subcategories.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Color" htmlFor="g-color">
                      <div className="flex items-center gap-2">
                        <input
                          id="g-color"
                          type="color"
                          value={draft.colorHex}
                          onChange={(e) => set('colorHex', e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                          aria-label="Color principal"
                        />
                        <Input
                          value={draft.colorName}
                          onChange={(e) => set('colorName', e.target.value)}
                          placeholder="Azul petróleo"
                        />
                      </div>
                    </FormField>
                    <FormField label="Temporada" htmlFor="g-season">
                      <Select
                        id="g-season"
                        value={draft.season}
                        onChange={(e) => set('season', e.target.value)}
                      >
                        {SEASON_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Material" htmlFor="g-material" className="sm:col-span-2">
                      <Input
                        id="g-material"
                        value={draft.material}
                        onChange={(e) => set('material', e.target.value)}
                        placeholder="Lino, algodón…"
                      />
                    </FormField>
                    <FormField
                      label="Etiquetas"
                      htmlFor="g-tags"
                      hint="Separadas por comas"
                      className="sm:col-span-2"
                    >
                      <Input
                        id="g-tags"
                        value={draft.tags.join(', ')}
                        onChange={(e) => set('tags', parseTags(e.target.value))}
                        placeholder="trabajo, clásico"
                      />
                    </FormField>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <AnalysisAttributes
                      analysis={result.analysis}
                      overallConfidence={result.overallConfidence}
                    />
                  </div>

                  <FormField
                    label="Ayuda a mejorar el análisis"
                    htmlFor="g-help"
                    hint='Opcional. Ej.: "Es de lino, manga larga, cuello mao, la uso para la iglesia."'
                  >
                    <Textarea
                      id="g-help"
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="Describe la prenda con tus palabras…"
                      rows={3}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRefine}
                    disabled={busy || freeText.trim().length === 0}
                    className="w-full"
                  >
                    <Wand2 className="h-4 w-4" />
                    Mejorar análisis con mi ayuda
                  </Button>
                </>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {busy ? 'Analizando tu prenda…' : 'Selecciona una fotografía para empezar.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={phase !== 'ready' || draft === null}
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
    </>
  );
}
