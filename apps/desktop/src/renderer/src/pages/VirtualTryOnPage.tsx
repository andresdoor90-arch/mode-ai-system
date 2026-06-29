/**
 * Virtual Try-On — visualises the recommended outfit on a fictional avatar.
 *
 * This screen wires the existing recommendation flow (renderer → IPC →
 * orchestrator → domain) to the engine-agnostic rendering layer: it takes the
 * selected recommendation's structured garments, maps them to a renderable
 * outfit (NO AI/score data crosses into the renderer) and feeds the pure
 * `SceneManager` via {@link useVirtualTryOn}. The 3D drawing is done by the
 * swappable Three.js/R3F adapter (`../rendering/three`).
 *
 * Controls: 360° rotation, zoom in/out, front/back/side view presets, body
 * type, lighting and screenshot capture. Switching recommendation tabs swaps
 * the garments automatically.
 */
import { Suspense, useEffect, useMemo } from 'react';
import {
  Camera,
  RotateCcw,
  RotateCw,
  Maximize,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '../components/ui';
import { recommendationToRenderable } from '../rendering/dtoToRenderable';
import { ROTATE_STEP, useVirtualTryOn } from '../rendering/useVirtualTryOn';
import { TryOnCanvas } from '../rendering/three/TryOnCanvas';
import { useRecommendationStore } from '../store/recommendationStore';
import { useUserStore } from '../store/userStore';
import type { BodyType, LightingPreset, ViewPreset } from '@mas/rendering';

const VIEW_PRESETS: ReadonlyArray<{ id: ViewPreset; label: string }> = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Espalda' },
  { id: 'left', label: 'Izquierda' },
  { id: 'right', label: 'Derecha' },
  { id: 'three-quarter', label: '3/4' },
];

const BODY_TYPES: ReadonlyArray<{ id: BodyType; label: string }> = [
  { id: 'neutral', label: 'Neutro' },
  { id: 'feminine', label: 'Femenino' },
  { id: 'masculine', label: 'Masculino' },
  { id: 'athletic', label: 'Atlético' },
  { id: 'plus', label: 'Plus' },
];

const LIGHTING: ReadonlyArray<{ id: LightingPreset; label: string }> = [
  { id: 'studio', label: 'Estudio' },
  { id: 'soft', label: 'Suave' },
  { id: 'dramatic', label: 'Dramática' },
];

export function VirtualTryOnPage(): JSX.Element {
  const set = useRecommendationStore((s) => s.set);
  const loading = useRecommendationStore((s) => s.loading);
  const loaded = useRecommendationStore((s) => s.loaded);
  const selectedKind = useRecommendationStore((s) => s.selectedKind);
  const recommend = useRecommendationStore((s) => s.recommend);
  const select = useRecommendationStore((s) => s.select);
  const current = useRecommendationStore((s) => s.current);

  const defaultOccasion = useUserStore((s) => s.defaultOccasion);
  const defaultSeason = useUserStore((s) => s.defaultSeason);

  useEffect(() => {
    if (!loaded) {
      void recommend({
        message: 'Quiero un look para hoy',
        occasion: defaultOccasion,
        season: defaultSeason,
      });
    }
  }, [loaded, recommend, defaultOccasion, defaultSeason]);

  const currentRecommendation = current();
  const outfit = useMemo(
    () => (currentRecommendation !== null ? recommendationToRenderable(currentRecommendation) : null),
    [currentRecommendation],
  );

  const { scene, controls, registerCanvas, capture, currentView } = useVirtualTryOn(outfit);

  return (
    <div>
      <PageHeader
        title="Probador virtual"
        description="Visualiza el conjunto recomendado sobre un personaje y míralo desde todos los ángulos."
        actions={
          <Button onClick={() => void capture()}>
            <Camera className="h-4 w-4" />
            Captura
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ----------------------------- 3D viewport ----------------------------- */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="relative h-[520px] w-full overflow-hidden rounded-xl">
              {loading && !loaded ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <TryOnCanvas scene={scene} onReady={registerCanvas} />
                </Suspense>
              )}

              {/* Floating camera controls. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
                <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-border bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur">
                  <Button variant="ghost" size="icon" title="Rotar a la izquierda" onClick={() => controls.rotate(-ROTATE_STEP)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Rotar a la derecha" onClick={() => controls.rotate(ROTATE_STEP)}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <Button variant="ghost" size="icon" title="Acercar" onClick={controls.zoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Alejar" onClick={controls.zoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <Button variant="ghost" size="icon" title="Restablecer cámara" onClick={controls.reset}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------- side panel ------------------------------ */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Recomendaciones
              </CardTitle>
              <CardDescription>
                {set?.degraded === true
                  ? 'Generadas con las reglas del dominio (sin proveedor de IA).'
                  : 'Elige cuál quieres ver puesta.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(set?.recommendations ?? []).map((rec) => (
                <button
                  key={rec.kind}
                  type="button"
                  onClick={() => select(rec.kind)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    rec.kind === selectedKind
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{rec.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rec.garments.map((g) => g.name).join(' · ')}
                    </p>
                  </div>
                  <Badge variant="success">{Math.round(rec.score)}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ángulo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {VIEW_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant={preset.id === currentView ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => controls.applyView(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personaje</CardTitle>
              <CardDescription>Tipo de cuerpo e iluminación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {BODY_TYPES.map((body) => (
                  <Button
                    key={body.id}
                    variant={body.id === scene.avatar.bodyType ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => controls.setBodyType(body.id)}
                  >
                    {body.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LIGHTING.map((light) => (
                  <Button key={light.id} variant="outline" size="sm" onClick={() => controls.setLighting(light.id)}>
                    {light.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
