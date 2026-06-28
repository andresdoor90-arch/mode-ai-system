/**
 * AddGarmentDialog — modal form to add a garment.
 *
 * A controlled form that builds an `AddGarmentPayload` and dispatches it through
 * the wardrobe store (→ IPC → AddGarment use case). It demonstrates the full
 * write path end-to-end while staying decoupled: the renderer only sends
 * primitive strings; the main process validates them against the domain enums.
 * Success/failure is surfaced via a toast.
 */
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { AddGarmentPayload } from '@shared/ipc';

import {
  CATEGORY_OPTIONS,
  SEASON_OPTIONS,
  SUBCATEGORY_OPTIONS,
} from '../../data/wardrobeOptions';
import { useToast } from '../../hooks/useToast';
import { isBridgeAvailable } from '../../ipc/client';
import { useWardrobeStore } from '../../store/wardrobeStore';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Select,
} from '../ui';

const INITIAL = {
  name: '',
  category: 'tops',
  subcategory: 'shirt',
  colorHex: '#1d3f72',
  colorName: '',
  season: 'all-season',
  brand: '',
  tags: '',
};

export function AddGarmentDialog(): JSX.Element {
  const addGarment = useWardrobeStore((state) => state.addGarment);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const subcategories = SUBCATEGORY_OPTIONS[form.category] ?? [];

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (form.name.trim().length === 0) {
      toast({ title: 'Falta el nombre', description: 'Indica un nombre para la prenda.', variant: 'warning' });
      return;
    }
    if (!isBridgeAvailable()) {
      toast({
        title: 'No disponible en vista previa',
        description: 'Añadir prendas requiere la aplicación de escritorio.',
        variant: 'warning',
      });
      return;
    }

    const payload: AddGarmentPayload = {
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      colorHex: form.colorHex,
      ...(form.colorName.trim() !== '' ? { colorName: form.colorName.trim() } : {}),
      seasons: [form.season],
      ...(form.brand.trim() !== '' ? { brand: form.brand.trim() } : {}),
      ...(form.tags.trim() !== ''
        ? { tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) }
        : {}),
    };

    setSubmitting(true);
    const ok = await addGarment(payload);
    setSubmitting(false);

    if (ok) {
      toast({ title: 'Prenda añadida', description: `"${payload.name}" se añadió al guardarropa.`, variant: 'success' });
      setForm(INITIAL);
      setOpen(false);
    } else {
      toast({ title: 'No se pudo añadir', description: 'Revisa los datos e inténtalo de nuevo.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Añadir prenda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva prenda</DialogTitle>
          <DialogDescription>Añade una prenda a tu guardarropa.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <FormField label="Nombre" htmlFor="g-name" required>
            <Input
              id="g-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Camisa de algodón Oxford"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Categoría" htmlFor="g-category">
              <Select
                id="g-category"
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value;
                  const first = SUBCATEGORY_OPTIONS[category]?.[0]?.value ?? '';
                  setForm((prev) => ({ ...prev, category, subcategory: first }));
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
                value={form.subcategory}
                onChange={(e) => set('subcategory', e.target.value)}
              >
                {subcategories.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Color" htmlFor="g-color">
              <div className="flex items-center gap-2">
                <input
                  id="g-color"
                  type="color"
                  value={form.colorHex}
                  onChange={(e) => set('colorHex', e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                  aria-label="Selector de color"
                />
                <Input
                  value={form.colorName}
                  onChange={(e) => set('colorName', e.target.value)}
                  placeholder="Navy"
                />
              </div>
            </FormField>
            <FormField label="Temporada" htmlFor="g-season">
              <Select id="g-season" value={form.season} onChange={(e) => set('season', e.target.value)}>
                {SEASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Marca" htmlFor="g-brand" hint="Opcional">
              <Input id="g-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Atelier" />
            </FormField>
            <FormField label="Etiquetas" htmlFor="g-tags" hint="Separadas por comas">
              <Input id="g-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="work, classic" />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar prenda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
