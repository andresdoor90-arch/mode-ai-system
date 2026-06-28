import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Virtual Try-On component test (CI-DEFERRED).
 *
 * Exercises the page with React Testing Library + jsdom and a MOCKED Three.js
 * canvas (the real WebGL render is not possible under jsdom, and `three`/R3F
 * cannot be installed in the offline INTEGRATIONS_ONLY sandbox). It is authored
 * against the Vitest + RTL API and runs in CI only — it is NOT part of the
 * offline `bun test` run. The pure rendering logic it sits on top of
 * (SceneManager, mappers, primitives) IS fully covered offline.
 */

// Replace the heavy R3F canvas with a stub so the page renders headlessly.
vi.mock('../rendering/three/TryOnCanvas', () => ({
  TryOnCanvas: () => <div data-testid="tryon-canvas" />,
}));

import { VirtualTryOnPage } from './VirtualTryOnPage';
import { useRecommendationStore } from '../store/recommendationStore';

describe('<VirtualTryOnPage /> (CI-deferred)', () => {
  it('renders the recommendations, view presets and camera controls', async () => {
    // Seed the store with the offline sample set.
    await useRecommendationStore.getState().recommend({ message: 'test' });

    render(<VirtualTryOnPage />);

    expect(screen.getByText(/probador virtual/i)).toBeInTheDocument();
    expect(screen.getByTestId('tryon-canvas')).toBeInTheDocument();
    // The three canonical recommendations.
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Más elegante')).toBeInTheDocument();
    expect(screen.getByText('Más cómoda')).toBeInTheDocument();
    // View presets.
    expect(screen.getByRole('button', { name: 'Espalda' })).toBeInTheDocument();
  });

  it('switches the selected recommendation when a tab is clicked', async () => {
    await useRecommendationStore.getState().recommend({ message: 'test' });
    render(<VirtualTryOnPage />);

    fireEvent.click(screen.getByText('Más elegante'));
    expect(useRecommendationStore.getState().selectedKind).toBe('mas-elegante');
  });
});
