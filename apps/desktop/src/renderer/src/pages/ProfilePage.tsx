/**
 * Perfil — the user's style identity, preferences and measurements.
 *
 * Presents the profile view-model (sample content until profile use cases are
 * wired over IPC). Layout and structure are definitive: a profile header card,
 * style keywords, signature colours and body measurements.
 */
import { CalendarDays, Palette, Ruler } from 'lucide-react';

import { ColorDot } from '../components/common/ColorDot';
import { PageHeader } from '../components/common/PageHeader';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui';
import { formatDate, initials } from '../lib/format';
import { useUserStore } from '../store/userStore';

const COLOR_HINT: Record<string, string> = {
  Navy: '#1d3f72',
  Charcoal: '#3a3a3a',
  Emerald: '#2f6b5e',
  Camel: '#4a3b2f',
};

export function ProfilePage(): JSX.Element {
  const profile = useUserStore((state) => state.profile);

  return (
    <div>
      <PageHeader title="Perfil" description="Tu estilo, tus colores y tus medidas." />

      <Card className="mb-6">
        <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 text-xl">
            <AvatarFallback>{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.handle}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Miembro desde {formatDate(profile.joinedAt)}
            </p>
          </div>
          <Button variant="outline">Editar perfil</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Estilo
            </CardTitle>
            <CardDescription>Palabras que definen tu estilo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.styleKeywords.map((keyword) => (
              <Badge key={keyword} variant="default">
                {keyword}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Colores
            </CardTitle>
            <CardDescription>Tu paleta de colores favorita</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.preferredColors.map((color) => (
              <div key={color} className="flex items-center gap-2 text-sm text-foreground">
                <ColorDot hex={COLOR_HINT[color] ?? '#64748b'} name={color} />
                {color}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" /> Medidas
            </CardTitle>
            <CardDescription>Usadas para ajustes y recomendaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Measure label="Altura" value={profile.measurements.height} />
            <Measure label="Pecho" value={profile.measurements.chest} />
            <Measure label="Cintura" value={profile.measurements.waist} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Measure({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
