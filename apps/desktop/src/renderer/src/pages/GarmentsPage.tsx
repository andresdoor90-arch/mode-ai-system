/**
 * Prendas — detailed tabular view of every garment.
 *
 * A dense, sortable-friendly table complementing the visual Wardrobe grid:
 * useful for scanning attributes (category, colour, brand, status, wear count,
 * last worn) at a glance. Data comes from the wardrobe store over IPC.
 */
import { useEffect } from 'react';
import { Tag } from 'lucide-react';

import { ColorDot } from '../components/common/ColorDot';
import { EmptyState } from '../components/common/EmptyState';
import { PageHeader } from '../components/common/PageHeader';
import {
  Badge,
  type BadgeProps,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui';
import { formatDate, pluralize, titleCase } from '../lib/format';
import type { GarmentDTO } from '@shared/ipc';
import { useWardrobeStore } from '../store/wardrobeStore';

const STATUS_VARIANT: Record<GarmentDTO['status'], BadgeProps['variant']> = {
  available: 'success',
  'in-laundry': 'warning',
  damaged: 'destructive',
  archived: 'secondary',
};

export function GarmentsPage(): JSX.Element {
  const loaded = useWardrobeStore((state) => state.loaded);
  const loading = useWardrobeStore((state) => state.loading);
  const load = useWardrobeStore((state) => state.load);
  const garments = useWardrobeStore((state) => state.garments);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  return (
    <div>
      <PageHeader
        title="Prendas"
        description={`Vista detallada de ${pluralize(garments.length, 'prenda')}`}
      />

      {loading && !loaded ? (
        <Skeleton className="h-96" />
      ) : garments.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No hay prendas"
          description="Añade prendas desde el guardarropa."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prenda</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead>Último uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {garments.map((garment) => (
                <TableRow key={garment.id}>
                  <TableCell className="font-medium text-foreground">{garment.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {titleCase(garment.category)} · {titleCase(garment.subcategory)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ColorDot hex={garment.color.hex} name={garment.color.name} />
                      {garment.color.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{garment.brand ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[garment.status]}>
                      {titleCase(garment.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {garment.wearCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {garment.lastWornAt !== null ? formatDate(garment.lastWornAt) : 'Nunca'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
