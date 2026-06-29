/**
 * Dashboard — overview of the wardrobe and recent activity.
 *
 * Binds to the wardrobe and outfit stores (data sourced over IPC from the
 * application layer) to show KPI stats, rules-based outfit suggestions and
 * recent outfit history. Includes a clear, honest banner that the AI engine is
 * not yet connected — no intelligent recommendations are produced in Phase 4.
 */
import { useEffect, useMemo } from 'react';
import { CalendarClock, Layers, Shirt, Sparkles, Star, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/common/EmptyState';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
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
import { formatDate, formatScore, titleCase } from '../lib/format';
import { countByStatus, groupByCategory } from '../store/logic/wardrobeLogic';
import { useOutfitStore } from '../store/outfitStore';
import { useUserStore } from '../store/userStore';
import { useWardrobeStore } from '../store/wardrobeStore';

export function DashboardPage(): JSX.Element {
  const garments = useWardrobeStore((state) => state.garments);
  const loading = useWardrobeStore((state) => state.loading);
  const loaded = useWardrobeStore((state) => state.loaded);
  const load = useWardrobeStore((state) => state.load);

  const history = useOutfitStore((state) => state.history);
  const suggestions = useOutfitStore((state) => state.suggestions);
  const loadSuggestions = useOutfitStore((state) => state.loadSuggestions);
  const loadHistory = useOutfitStore((state) => state.loadHistory);

  const profile = useUserStore((state) => state.profile);
  const defaultOccasion = useUserStore((state) => state.defaultOccasion);
  const defaultSeason = useUserStore((state) => state.defaultSeason);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
    loadHistory();
    void loadSuggestions({ occasion: defaultOccasion, season: defaultSeason, limit: 3 });
  }, [loaded, load, loadHistory, loadSuggestions, defaultOccasion, defaultSeason]);

  const stats = useMemo(() => {
    const byCategory = groupByCategory(garments);
    const byStatus = countByStatus(garments);
    const totalWears = garments.reduce((sum, g) => sum + g.wearCount, 0);
    return {
      total: garments.length,
      categories: Object.keys(byCategory).length,
      available: byStatus.available,
      avgWear: garments.length === 0 ? 0 : Math.round(totalWears / garments.length),
    };
  }, [garments]);

  return (
    <div>
      <PageHeader
        title={`Hola, ${profile.name.split(' ')[0]}`}
        description="Esto es lo que está pasando en tu guardarropa hoy."
        actions={
          <Button asChild>
            <Link to="/wardrobe">
              <Shirt className="h-4 w-4" />
              Ir al guardarropa
            </Link>
          </Button>
        }
      />

      {/* Honest AI status banner — no engine is connected in this phase. */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Motor de IA todavía no configurado
              </p>
              <p className="text-sm text-muted-foreground">
                Las recomendaciones inteligentes llegarán en una fase posterior. Por ahora se usan
                sugerencias basadas en reglas.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            Próximamente
          </Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !loaded ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard
              label="Prendas totales"
              value={stats.total}
              icon={Shirt}
              hint="En tu guardarropa"
            />
            <StatCard
              label="Categorías"
              value={stats.categories}
              icon={Layers}
              hint="Tipos de prenda"
            />
            <StatCard
              label="Disponibles"
              value={stats.available}
              icon={Star}
              hint="Listas para usar"
            />
            <StatCard
              label="Uso medio"
              value={stats.avgWear}
              icon={CalendarClock}
              hint="Veces por prenda"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Sugerencias para hoy</CardTitle>
              <CardDescription>
                Conjuntos puntuados según reglas de estilo · {titleCase(defaultOccasion)}
              </CardDescription>
            </div>
            <Wand2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <EmptyState
                icon={Wand2}
                title="Aún no hay sugerencias"
                description="Añade más prendas o cambia tu ocasión por defecto para ver combinaciones."
              />
            ) : (
              <ul className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {suggestion.garments.map((g) => g.name).join(' · ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.garments.length} prendas
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">{formatScore(suggestion.score)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conjuntos recientes</CardTitle>
            <CardDescription>Tu historial de looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.slice(0, 4).map((outfit) => (
              <div key={outfit.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{outfit.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(outfit.createdAt)}</p>
                </div>
                {outfit.rating !== null && (
                  <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    {outfit.rating}
                  </span>
                )}
              </div>
            ))}
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/history">Ver historial completo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
