/**
 * Categorías — overview of the wardrobe organised by category.
 *
 * Shows a card per garment category with a live count (from the wardrobe store)
 * and a quick action that pre-sets the wardrobe filter and navigates there.
 */
import { useEffect } from 'react';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '../components/common/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui';
import { CATEGORY_LABELS } from '../data/sampleData';
import { pluralize } from '../lib/format';
import { groupByCategory } from '../store/logic/wardrobeLogic';
import { useWardrobeStore } from '../store/wardrobeStore';

export function CategoriesPage(): JSX.Element {
  const navigate = useNavigate();
  const loaded = useWardrobeStore((state) => state.loaded);
  const load = useWardrobeStore((state) => state.load);
  const garments = useWardrobeStore((state) => state.garments);
  const setFilters = useWardrobeStore((state) => state.setFilters);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  const counts = groupByCategory(garments);

  const openCategory = (categoryId: string): void => {
    setFilters({ category: categoryId });
    navigate('/wardrobe');
  };

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Explora tu armario organizado por tipo de prenda."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_LABELS.map((category) => {
          const count = counts[category.id]?.length ?? 0;
          return (
            <Card key={category.id} className="flex flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutGrid className="h-5 w-5" />
                  </span>
                  <CardTitle>{category.label}</CardTitle>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <CardDescription>{category.description}</CardDescription>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{pluralize(count, 'prenda')}</span>
                  <Button variant="ghost" size="sm" onClick={() => openCategory(category.id)}>
                    Ver prendas
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
