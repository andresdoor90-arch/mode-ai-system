/**
 * AI Provider Router (supports step 8 of the flow).
 *
 * Chooses which text provider — if any — to use for this run. Providers are
 * tried in priority order (e.g. local Ollama first, then cloud); the first one
 * that reports itself available wins. When none is available the router returns
 * `null`, which the orchestrator treats as the MANDATORY graceful-degradation
 * path: it carries on with domain rules only.
 *
 * The router knows nothing about prompts, styling or scoring — it only does
 * availability/health selection over the abstract {@link ITextProvider} port,
 * so adding, reordering or removing a provider never touches the domain.
 */
import { type ITextProvider } from './ports';

export interface ProviderSelection {
  /** The chosen provider, or `null` when none is available (offline). */
  readonly provider: ITextProvider | null;
  /** Ids of providers probed, in order. */
  readonly probed: readonly string[];
  /** Diagnostic note describing the selection outcome. */
  readonly note: string;
}

export class AIProviderRouter {
  private readonly providers: readonly ITextProvider[];

  public constructor(providers: readonly ITextProvider[] = []) {
    this.providers = providers;
  }

  /** Number of registered providers (regardless of availability). */
  public get size(): number {
    return this.providers.length;
  }

  /**
   * Select the first available provider in priority order. Availability checks
   * that throw are treated as "unavailable" so a misbehaving provider can never
   * break the recommendation flow.
   */
  public async select(): Promise<ProviderSelection> {
    const probed: string[] = [];
    for (const provider of this.providers) {
      probed.push(provider.id);
      let available = false;
      try {
        available = await provider.isAvailable();
      } catch {
        available = false;
      }
      if (available) {
        return {
          provider,
          probed,
          note: `Selected provider "${provider.id}".`,
        };
      }
    }
    return {
      provider: null,
      probed,
      note:
        probed.length === 0
          ? 'No providers configured; running offline with domain rules only.'
          : `No provider available (${probed.join(', ')}); running offline with domain rules only.`,
    };
  }
}
