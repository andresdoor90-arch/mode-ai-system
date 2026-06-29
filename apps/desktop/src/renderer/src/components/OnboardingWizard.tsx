/**
 * First-run onboarding.
 *
 * Shown only when no profile exists in SQLite. Asks the single required
 * question — the user's name — and persists it via the profile use case
 * (renderer → profile:create → repository → SQLite). Once created, the app
 * gate re-renders into the main application. There is no demo/sample identity:
 * the name the user types here is the one used everywhere afterwards.
 */
import { useState, type FormEvent } from 'react';

import { useUserStore } from '../store/userStore';

export function OnboardingWizard(): JSX.Element {
  const createProfile = useUserStore((state) => state.createProfile);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProfile(trimmed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear el perfil. Inténtalo de nuevo.',
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-semibold text-primary">
            M
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Mode AI System</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu asistente de outfits basado en las fotos reales de tu guardarropa.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-xl"
        >
          <label htmlFor="onboarding-name" className="mb-2 block text-sm font-medium">
            ¿Cómo te llamas?
          </label>
          <input
            id="onboarding-name"
            type="text"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tu nombre"
            maxLength={60}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />

          {error !== null && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creando tu perfil…' : 'Comenzar'}
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tu guardarropa empieza vacío. Añadirás tus prendas con sus fotografías.
          </p>
        </form>
      </div>
    </div>
  );
}
