import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

/**
 * Renderer component test (CI-deferred).
 *
 * This spec exercises the full app shell with React Testing Library + jsdom.
 * Those libraries cannot be installed in the offline (`INTEGRATIONS_ONLY`)
 * sandbox, so this test is authored against the Vitest + RTL API and runs in
 * CI, where the renderer toolchain is available. It is NOT part of the offline
 * `bun test` run.
 */
describe('<App />', () => {
  it('renders the application shell with brand and primary navigation', () => {
    render(<App />);
    expect(screen.getByText(/mode ai system/i)).toBeInTheDocument();
    // The sidebar exposes the primary navigation labels.
    expect(screen.getByRole('link', { name: /guardarropa/i })).toBeInTheDocument();
  });
});
