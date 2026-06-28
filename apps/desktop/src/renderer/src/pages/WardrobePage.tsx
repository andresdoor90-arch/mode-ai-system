/**
 * Wardrobe — the main grid of garments with filtering and sorting.
 *
 * Binds to the wardrobe store: free-text search, category/status/season filters
 * and sort are applied via the pure `visibleGarments` selector. Each card
 * supports removal (optimistic, reconciled over IPC). Adding goes through the
 * AddGarmentDialog. Loading shows skeletons; no matches shows an EmptyState.
 */
import { useEffect } from 'react';
import { Search, Shirt, SlidersHorizontal } from 'lucide-react';

import { AddGarmentDialog } from '../components/common/AddGarmentDialog';
import { EmptyState } from '../components/common/EmptyState';
import { GarmentCard } from '../components/common/GarmentCard';
import { PageHeader } from '../components/common/PageHeader';
import { Button, Card, Input, Select, Skeleton } from '../components/ui';
import { useToast } from '../hooks/useToast';
import {
  CATEGORY_OPTIONS,
  SEASON_OPTIONS,
  STATUS_OPTIONS,
} from '../data/wardrobeOptions';
import { pluralize } from '../lib/format';
import type { WardrobeSort } from '../store/logic/wardrobeLogic';
import { useWardrobeStore } from '../store/wardrobeStore';

const SORT_OPTIONS: ReadonlyArray<{ value: WardrobeSort; label: string }> = [
  { value: 'name-asc', label: 'Nombre (A–Z)' },
  { value: 'name-desc', label: 'Nombre (Z–A)' },
  { value: 'most-worn', label: 'Más usadas' },
  { value: 'least-worn', label: 'Menos usadas' },
];

export function WardrobePage(): JSX.Element {
  const { toast } = useToast();
  const loaded = useWardrobeStore((state) => state.loaded);
  const loading = useWardrobeStore((state) => state.loading);
  const load = useWardrobeStore((state) => state.load);
  const filters = useWardrobeStore((state) => state.filters);
  const setFilters = useWardrobeStore((state) => state.setFilters);
  const resetFilters = useWardrobeStore((state) => state.resetFilters);
  const sort = useWardrobeStore((state) => state.sort);
  const setSort = useWardrobeStore((state) => state.setSort);
  const removeGarment = useWardrobeStore((state) => state.removeGarment);
  const visible = useWardrobeStore((state) => state.visibleGarments());
  const total = useWardrobeStore((state) => state.garments.length);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  const handleRemove = (id: string): void => {
    void removeGarment(id);
    toast({ title: 'Prenda eliminada', variant: 'default' });
  };

  return (
    <div>
      <PageHeader
        title="Guardarropa"
        description={`${pluralize(total, 'prenda')} en tu colección`}
        actions={<AddGarmentDialog />}
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Buscar por nombre, marca o etiqueta…"
              className="pl-9"
              aria-label="Buscar prendas"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
            <Select
              value={filters.category}
              onChange={(e) => setFilters({ category: e.target.value })}
              aria-label="Filtrar por categoría"
              className="lg:w-40"
            >
              <option value="all">Todas las categorías</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as never })}
              aria-label="Filtrar por estado"
              className="lg:w-36"
            >
              <option value="all">Todos los estados</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={filters.season}
              onChange={(e) => setFilters({ season: e.target.value })}
              aria-label="Filtrar por temporada"
              className="lg:w-36"
            >
              <option value="all">Toda temporada</option>
              {SEASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as WardrobeSort)}
              aria-label="Ordenar"
              className="lg:w-40"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading && !loaded ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={total === 0 ? Shirt : SlidersHorizontal}
          title={total === 0 ? 'Tu guardarropa está vacío' : 'Sin resultados'}
          description={
            total === 0
              ? 'Empieza añadiendo tu primera prenda.'
              : 'Ninguna prenda coincide con los filtros actuales.'
          }
          action={
            total === 0 ? (
              <AddGarmentDialog />
            ) : (
              <Button variant="outline" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((garment) => (
            <GarmentCard key={garment.id} garment={garment} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
