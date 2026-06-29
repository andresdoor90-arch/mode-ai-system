/**
 * Categorías — fully dynamic category manager (Phase 6.5, Module 1).
 *
 * No category is hardcoded: the tree is loaded from the application layer
 * (`ipc.getCategoryTree`) which sources user-owned {@link CategoryDTO} data. The
 * user can create, rename, regroup, reorder (move up/down) and delete
 * categories and unlimited subcategories. All mutations go through the strict
 * React → IPC → Application → Domain → Infrastructure flow; this component never
 * touches infrastructure directly.
 *
 * The presentation here is intentionally framework-light; the behavioural logic
 * (tree building, grouping, reorder, validation) lives in the offline-tested
 * `categoriesLogic` module.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FolderPlus, LayoutGrid, Plus, Trash2 } from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../components/ui';
import { useToast } from '../hooks/useToast';
import { ipc, isBridgeAvailable } from '../ipc/client';
import {
  groupRoots,
  moveInOrder,
  validateCategoryName,
  type CategoryFormErrors,
} from '../store/logic/categoriesLogic';
import type { CategoryDTO, CategoryNodeDTO } from '@shared/ipc';

/**
 * The structural "zone" a top-level category occupies on the 2D try-on
 * mannequin. This maps 1:1 to the domain {@link LayerSlot} and is the ONLY
 * structural fact the user supplies; everything else about a category is free.
 * Garments inherit their category's zone so the try-on places them correctly
 * (e.g. a watch on the wrist, a shirt on the torso) without any fixed taxonomy.
 */
const ZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'upper-body', label: 'Parte superior (camisas, tops)' },
  { value: 'lower-body', label: 'Parte inferior (pantalones, faldas)' },
  { value: 'outer', label: 'Abrigo / saco / chaqueta' },
  { value: 'feet', label: 'Calzado' },
  { value: 'accessory', label: 'Accesorio (corbata, reloj, correa…)' },
  { value: 'full-body', label: 'Cuerpo completo' },
];

const zoneLabel = (slot: string): string =>
  ZONE_OPTIONS.find((z) => z.value === slot)?.label.split(' (')[0] ?? slot;

export function CategoriesPage(): JSX.Element {
  const { toast } = useToast();
  const [tree, setTree] = useState<readonly CategoryNodeDTO[]>([]);
  const [flat, setFlat] = useState<readonly CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState<string>('upper-body');
  const [errors, setErrors] = useState<CategoryFormErrors>({});

  const refresh = useCallback(async (): Promise<void> => {
    if (!isBridgeAvailable()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nodes, list] = await Promise.all([ipc.getCategoryTree(), ipc.listCategories()]);
      setTree(nodes);
      setFlat(list);
    } catch (error) {
      toast({ title: 'No se pudieron cargar las categorías', description: String(error) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const roots = useMemo(() => flat.filter((c) => c.parentId === null), [flat]);
  const grouped = useMemo(() => groupRoots(flat), [flat]);

  const siblingsFor = (parentId: string | null): CategoryDTO[] =>
    flat.filter((c) => c.parentId === parentId);

  const handleCreate = async (): Promise<void> => {
    const validation = validateCategoryName(newName, siblingsFor(newParent));
    setErrors(validation);
    if (validation.name !== undefined) {
      return;
    }
    try {
      await ipc.createCategory({
        name: newName.trim(),
        parentId: newParent,
        // Only top-level categories carry a structural zone; subcategories
        // inherit their parent's zone (garments use the top category's slot).
        ...(newParent === null ? { metadata: { layerSlot: newSlot } } : {}),
      });
      setNewName('');
      toast({ title: 'Categoría creada' });
      await refresh();
    } catch (error) {
      toast({ title: 'No se pudo crear la categoría', description: String(error) });
    }
  };

  const handleDelete = async (category: CategoryDTO): Promise<void> => {
    try {
      await ipc.removeCategory(category.id);
      toast({ title: `"${category.name}" eliminada` });
      await refresh();
    } catch (error) {
      toast({ title: 'No se pudo eliminar', description: String(error) });
    }
  };

  const handleReorder = async (
    parentId: string | null,
    fromIndex: number,
    toIndex: number,
  ): Promise<void> => {
    const ids = flat
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);
    const next = moveInOrder(ids, fromIndex, toIndex);
    try {
      await ipc.reorderCategories({ orderedIds: next });
      await refresh();
    } catch (error) {
      toast({ title: 'No se pudo reordenar', description: String(error) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Crea, edita, agrupa, reordena y anida categorías. Todo es configurable: no hay categorías fijas en el sistema."
      />

      {/* Create form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" /> Nueva categoría
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              placeholder="p. ej. Pantalones elegantes, Corbatas, Relojes…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-invalid={errors.name !== undefined}
            />
            {errors.name !== undefined && (
              <p className="mt-1 text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newParent ?? ''}
            onChange={(e) => setNewParent(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Categoría de nivel superior</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                Subcategoría de {r.name}
              </option>
            ))}
          </select>
          {newParent === null && (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              aria-label="Zona en el probador"
              title="Dónde se ubica esta categoría en el probador 2D"
            >
              {ZONE_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => void handleCreate()}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando categorías…</p>
      ) : (
        Object.entries(grouped).map(([group, rootsInGroup]) => (
          <section key={group} className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
            <div className="space-y-3">
              {rootsInGroup.map((root, index) => {
                const node = tree.find((n) => n.category.id === root.id);
                return (
                  <Card key={root.id}>
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <LayoutGrid className="h-4 w-4" />
                        </span>
                        <CardTitle className="text-base">{root.name}</CardTitle>
                        {root.seeded && <Badge variant="secondary">predeterminada</Badge>}
                        <Badge variant="outline">{zoneLabel(root.metadata.layerSlot)}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => void handleReorder(null, index, index - 1)}
                          aria-label="Subir"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === rootsInGroup.length - 1}
                          onClick={() => void handleReorder(null, index, index + 1)}
                          aria-label="Bajar"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(root)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    {node !== undefined && node.children.length > 0 && (
                      <CardContent>
                        <ul className="flex flex-wrap gap-2">
                          {node.children.map((child) => (
                            <li key={child.id}>
                              <Badge variant="secondary" className="gap-1">
                                {child.name}
                                <button
                                  className="ml-1 opacity-60 hover:opacity-100"
                                  onClick={() => void handleDelete(child)}
                                  aria-label={`Eliminar ${child.name}`}
                                >
                                  ×
                                </button>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
