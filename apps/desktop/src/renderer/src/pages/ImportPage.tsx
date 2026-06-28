/**
 * Importar — bring a wardrobe in from a portable JSON bundle.
 *
 * The user picks a `.json` file or pastes its contents; importing dispatches
 * through the IPC transfer channel (→ main → AddGarment use cases), then
 * refreshes the wardrobe store. Demonstrates the read-file → application-layer
 * write path while keeping the renderer free of any filesystem access.
 */
import { useState } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from '../components/ui';
import { useToast } from '../hooks/useToast';
import { ipc, isBridgeAvailable } from '../ipc/client';
import { useWardrobeStore } from '../store/wardrobeStore';

export function ImportPage(): JSX.Element {
  const { toast } = useToast();
  const reloadWardrobe = useWardrobeStore((state) => state.load);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setContent(await file.text());
  };

  const handleImport = async (): Promise<void> => {
    if (content.trim().length === 0) {
      toast({ title: 'Nada que importar', description: 'Selecciona un archivo o pega su contenido.', variant: 'warning' });
      return;
    }
    if (!isBridgeAvailable()) {
      toast({ title: 'No disponible en vista previa', variant: 'warning' });
      return;
    }
    setBusy(true);
    try {
      const { imported } = await ipc.importWardrobe(content);
      await reloadWardrobe();
      toast({
        title: 'Importación completada',
        description: `${imported} prenda(s) importada(s).`,
        variant: 'success',
      });
      setContent('');
    } catch (error) {
      toast({
        title: 'Error al importar',
        description: error instanceof Error ? error.message : 'Archivo no válido.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Importar"
        description="Importa un guardarropa desde un archivo JSON portable."
      />

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" /> Archivo de guardarropa
          </CardTitle>
          <CardDescription>
            Compatible con los archivos generados desde la pantalla de Exportar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center transition-colors hover:bg-accent/50">
            <Download className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Selecciona un archivo .json</span>
            <span className="text-xs text-muted-foreground">o pega el contenido abajo</span>
            <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          </label>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='{ "garments": [ … ] }'
            className="min-h-[160px] font-mono text-xs"
          />

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={busy}>
              <Upload className="h-4 w-4" />
              {busy ? 'Importando…' : 'Importar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
