/**
 * Configuración — appearance, data and about settings.
 *
 * Organised with Tabs. Appearance binds to the UI/user stores (theme, density,
 * default occasion/season — all persisted). Data links to import/export. About
 * shows the live app/runtime info fetched over IPC, with a graceful fallback
 * when the desktop bridge is unavailable.
 */
import { useEffect, useState } from 'react';
import { Database, Info, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/common/PageHeader';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui';
import { OCCASION_OPTIONS, SEASON_OPTIONS } from '../data/wardrobeOptions';
import { ipc, isBridgeAvailable } from '../ipc/client';
import { cn } from '../lib/cn';
import type { ThemePreference } from '../theme/theme';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import type { AppInfoDTO } from '@shared/ipc';

const THEME_CHOICES: ReadonlyArray<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function SettingsPage(): JSX.Element {
  const theme = useUiStore((state) => state.themePreference);
  const setTheme = useUiStore((state) => state.setThemePreference);
  const density = useUserStore((state) => state.density);
  const setDensity = useUserStore((state) => state.setDensity);
  const defaultOccasion = useUserStore((state) => state.defaultOccasion);
  const setDefaultOccasion = useUserStore((state) => state.setDefaultOccasion);
  const defaultSeason = useUserStore((state) => state.defaultSeason);
  const setDefaultSeason = useUserStore((state) => state.setDefaultSeason);

  const [info, setInfo] = useState<AppInfoDTO | null>(null);

  useEffect(() => {
    if (isBridgeAvailable()) {
      ipc
        .getAppInfo()
        .then(setInfo)
        .catch(() => setInfo(null));
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Personaliza la apariencia y gestiona tus datos."
      />

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4" /> Apariencia
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="h-4 w-4" /> Datos
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4" /> Acerca de
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Tema</CardTitle>
              <CardDescription>Elige cómo se ve la aplicación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {THEME_CHOICES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors',
                      theme === value
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>

              <FormField
                label="Densidad de la interfaz"
                htmlFor="s-density"
                hint="Espaciado de las listas y tarjetas"
              >
                <Select
                  id="s-density"
                  value={density}
                  onChange={(e) => setDensity(e.target.value as 'comfortable' | 'compact')}
                  className="max-w-xs"
                >
                  <option value="comfortable">Cómoda</option>
                  <option value="compact">Compacta</option>
                </Select>
              </FormField>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Sugerencias por defecto</CardTitle>
              <CardDescription>Valores usados al generar conjuntos en el panel.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Ocasión" htmlFor="s-occasion">
                <Select
                  id="s-occasion"
                  value={defaultOccasion}
                  onChange={(e) => setDefaultOccasion(e.target.value)}
                >
                  {OCCASION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Temporada" htmlFor="s-season">
                <Select
                  id="s-season"
                  value={defaultSeason}
                  onChange={(e) => setDefaultSeason(e.target.value)}
                >
                  {SEASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Importar y exportar</CardTitle>
              <CardDescription>Mueve tu guardarropa entre dispositivos.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/import">Importar guardarropa</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/export">Exportar guardarropa</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Mode AI System</CardTitle>
              <CardDescription>Información de la aplicación y el entorno.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Versión" value={info?.version ?? '0.1.0'} />
              <Row label="Plataforma" value={info?.platform ?? '—'} />
              <Row label="Electron" value={info?.versions.electron || '—'} />
              <Row label="Chromium" value={info?.versions.chrome || '—'} />
              <Row label="Node.js" value={info?.versions.node || '—'} />
              {!isBridgeAvailable() && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Vista previa sin la aplicación de escritorio: la información del entorno no está
                  disponible.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
