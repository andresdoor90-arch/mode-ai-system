/**
 * Exportar — produce a portable JSON bundle of the wardrobe.
 *
 * Requests the bundle over the IPC transfer channel (built from the wardrobe
 * query in the application layer), then lets the user copy it or download it as
 * a file. All data assembly happens in the main process; the renderer only
 * presents and saves the resulting string.
 */
import { useState } from 'react';
import { ClipboardCopy, FileDown, Save } from 'lucide-react';

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

export function ExportPage(): JSX.Element {
  const { toast } = useToast();
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);

  const handleExport = async (): Promise<void> => {
    if (!isBridgeAvailable()) {
      toast({ title: 'No disponible en vista previa', variant: 'warning' });
      return;
    }
    setBusy(true);
    try {
      const result = await ipc.exportWardrobe();
      setJson(result.json);
      toast({ title: 'Guardarropa exportado', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (json.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(json);
    toast({ title: 'Copiado al portapapeles', variant: 'success' });
  };

  const handleDownload = (): void => {
    if (json.length === 0) {
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mas-wardrobe-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Exportar"
        description="Genera un archivo portable con todo tu guardarropa."
        actions={
          <Button onClick={handleExport} disabled={busy}>
            <FileDown className="h-4 w-4" />
            {busy ? 'Generando…' : 'Generar export'}
          </Button>
        }
      />

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Bundle de exportación</CardTitle>
          <CardDescription>
            Genera el archivo y cópialo o descárgalo para guardarlo o moverlo a otro dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={json}
            readOnly
            placeholder="Pulsa «Generar export» para crear el bundle…"
            className="min-h-[220px] font-mono text-xs"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={json.length === 0}>
              <ClipboardCopy className="h-4 w-4" />
              Copiar
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={json.length === 0}>
              <Save className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
