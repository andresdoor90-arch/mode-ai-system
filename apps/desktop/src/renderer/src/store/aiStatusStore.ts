/**
 * AI status store (Zustand).
 *
 * Reflects the AI engine's real capability, reported by the main process over
 * IPC (`ai:status`). Since Phase 5 the cognitive engine is wired and always
 * able to recommend from domain rules — even with NO model configured — so
 * `recommendationsEnabled` is true once the bridge has answered. The `status`
 * distinguishes the rules-only (`degraded`) mode from a fully provider-backed
 * `ready` mode.
 *
 * The store still performs no inference and holds no credentials; it only
 * mirrors the status the orchestrator exposes.
 */
import { create } from 'zustand';

import { ipc, isBridgeAvailable } from '../ipc/client';

/** Lifecycle of the local/cloud AI engine. */
export type AiEngineStatus = 'not-configured' | 'idle' | 'loading' | 'ready' | 'degraded' | 'error';

interface AiStatusState {
  status: AiEngineStatus;
  /** Human-readable note for the UI. */
  detail: string;
  /** Id of the active AI provider, or null when running on rules only. */
  providerId: string | null;
  /** Whether intelligent recommendations are available at all. */
  recommendationsEnabled: boolean;
  /** Refresh the status from the main process. */
  refresh: () => Promise<void>;
}

export const useAiStatusStore = create<AiStatusState>((set) => ({
  status: 'not-configured',
  detail: 'Comprobando el motor de IA…',
  providerId: null,
  recommendationsEnabled: false,
  refresh: async () => {
    if (!isBridgeAvailable()) {
      set({
        status: 'not-configured',
        detail: 'El puente del escritorio no está disponible.',
        providerId: null,
        recommendationsEnabled: false,
      });
      return;
    }
    try {
      set({ status: 'loading', detail: 'Comprobando el motor de IA…' });
      const info = await ipc.getAiStatus();
      set({
        status: info.providerAvailable ? 'ready' : 'degraded',
        detail: info.providerAvailable
          ? `Proveedor de IA activo: ${info.providerId ?? 'desconocido'}.`
          : 'Sin proveedor de IA: recomendaciones basadas solo en las reglas del dominio.',
        providerId: info.providerId,
        recommendationsEnabled: info.recommendationsEnabled,
      });
    } catch {
      set({
        status: 'error',
        detail: 'No se pudo obtener el estado del motor de IA.',
        providerId: null,
        recommendationsEnabled: false,
      });
    }
  },
}));
