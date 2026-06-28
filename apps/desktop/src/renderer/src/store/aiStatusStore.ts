/**
 * AI status store (Zustand) — PLACEHOLDER.
 *
 * Phase 4 deliberately does NOT connect any AI engine, model or recommendation
 * intelligence. This store exists only to reserve the global-state shape the UI
 * will bind to once the AI engine lands (Phase 5), and to drive the
 * "AI engine: not configured" indicators shown across the interface today.
 *
 * It performs no inference, makes no network/model calls and holds no provider
 * credentials. The status is fixed to `not-configured` until Phase 5 wires it.
 */
import { create } from 'zustand';

/** Lifecycle of the (future) local/cloud AI engine. */
export type AiEngineStatus = 'not-configured' | 'idle' | 'loading' | 'ready' | 'error';

interface AiStatusState {
  status: AiEngineStatus;
  /** Human-readable note for the UI; never a real model/provider name yet. */
  detail: string;
  /** Whether intelligent recommendations are available (always false in Phase 4). */
  recommendationsEnabled: boolean;
}

export const useAiStatusStore = create<AiStatusState>(() => ({
  status: 'not-configured',
  detail: 'The AI engine is not connected yet. Coming in a later phase.',
  recommendationsEnabled: false,
}));
