import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { RecommendationSetDTO } from '@shared/ipc';

/**
 * Virtual Try-On component test (CI-DEFERRED).
 *
 * Exercises the page with React Testing Library + jsdom and a MOCKED Three.js
 * canvas (real WebGL is not possible under jsdom, and `three`/R3F cannot be
 * installed in the offline INTEGRATIONS_ONLY sandbox). Runs in CI only.
 *
 * The store is seeded directly with a real recommendation SET shape (a test
 * fixture — NOT shipped mock data) so the screen renders deterministically,
 * decoupled from the IPC bridge.
 */

// Replace the heavy R3F canvas with a stub so the page renders headlessly.
vi.mock('../rendering/three/TryOnCanvas', () => ({
  TryOnCanvas: () => <div data-testid="tryon-canvas" />,
}));

import { VirtualTryOnPage } from './VirtualTryOnPage';
import { useRecommendationStore } from '../store/recommendationStore';

const SET: RecommendationSetDTO = {
  occasion: 'business',
  season: 'all-season',
  providerId: null,
  degraded: true,
  notes: [],
  recommendations: [
    { kind: 'principal', label: 'Principal', score: 88, explanation: 'x', garments: [] },
    { kind: 'mas-elegante', label: 'Más elegante', score: 84, explanation: 'x', garments: [] },
    { kind: 'mas-comoda', label: 'Más cómoda', score: 80, explanation: 'x', garments: [] },
  ],
};

beforeEach(() => {
  // loaded:true prevents the page's effect from issuing a fresh request.
  useRecommendationStore.setState({
    set: SET,
    selectedKind: 'principal',
    loaded: true,
    loading: false,
    error: null,
  });
});

describe('<VirtualTryOnPage /> (CI-deferred)', () => {
  it('renders the recommendations, view presets and camera controls', () => {
    render(<VirtualTryOnPage />);

    expect(screen.getByText(/probador virtual/i)).toBeInTheDocument();
    expect(screen.getByTestId('tryon-canvas')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Más elegante')).toBeInTheDocument();
    expect(screen.getByText('Más cómoda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Espalda' })).toBeInTheDocument();
  });

  it('switches the selected recommendation when a tab is clicked', () => {
    render(<VirtualTryOnPage />);
    fireEvent.click(screen.getByText('Más elegante'));
    expect(useRecommendationStore.getState().selectedKind).toBe('mas-elegante');
  });
});
