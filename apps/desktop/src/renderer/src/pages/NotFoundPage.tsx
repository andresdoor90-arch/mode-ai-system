/**
 * NotFound — fallback for unknown routes.
 */
import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Página no encontrada
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        La página que buscas no existe o se ha movido.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
