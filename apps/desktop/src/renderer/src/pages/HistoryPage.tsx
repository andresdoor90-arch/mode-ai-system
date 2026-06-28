/**
 * Historial — outfits the user has worn and rated.
 *
 * Presents the outfit history as cards with their occasion, season, rating and
 * the garments involved. Uses sample content until outfit-history queries are
 * surfaced over IPC in a later phase; the visual structure is definitive.
 */
import { useEffect } from 'react';
import { History, Star } from 'lucide-react';

import { EmptyState } from '../components/common/EmptyState';
import { PageHeader } from '../components/common/PageHeader';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui';
import { formatDate, titleCase } from '../lib/format';
import { useOutfitStore } from '../store/outfitStore';

export function HistoryPage(): JSX.Element {
  const history = useOutfitStore((state) => state.history);
  const loadHistory = useOutfitStore((state) => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div>
      <PageHeader title="Historial" description="Conjuntos que has usado, con sus valoraciones." />

      {history.length === 0 ? (
        <EmptyState icon={History} title="Sin historial" description="Tus conjuntos aparecerán aquí." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {history.map((outfit) => (
            <Card key={outfit.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>{outfit.name}</CardTitle>
                  <CardDescription>{formatDate(outfit.createdAt)}</CardDescription>
                </div>
                {outfit.rating !== null && (
                  <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-sm font-semibold text-warning-foreground">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    {outfit.rating}
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{titleCase(outfit.occasion)}</Badge>
                  <Badge variant="outline">{titleCase(outfit.season)}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {outfit.garments.map((garment) => (
                    <span
                      key={garment.id}
                      className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-muted-foreground"
                    >
                      {garment.name}
                    </span>
                  ))}
                </div>
                {outfit.notes !== null && (
                  <p className="text-sm italic text-muted-foreground">“{outfit.notes}”</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
