import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

/**
 * Renderer component test (CI-deferred).
 *
 * Exercises the app gate with React Testing Library + jsdom. Those libraries
 * cannot be installed in the offline (`INTEGRATIONS_ONLY`) sandbox, so this test
 * is authored against the Vitest + RTL API and runs in CI only — it is NOT part
 * of the offline `bun test` run.
 *
 * In jsdom there is no desktop bridge, so no profile exists ⇒ the app must show
 * the first-run onboarding (never any demo identity).
 */
describe('<App />', () => {
  it('shows the first-run onboarding when no profile exists yet', async () => {
    render(<App />);
    expect(await screen.findByText(/¿cómo te llamas\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comenzar/i })).toBeInTheDocument();
    // The welcome copy references the product name.
    expect(screen.getByText(/mode ai system/i)).toBeInTheDocument();
  });
});
