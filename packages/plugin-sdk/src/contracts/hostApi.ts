/**
 * The Host API — the ONLY surface a plugin may touch.
 *
 * A plugin can NEVER import `@mas/core`, `@mas/infrastructure` or reach the
 * database/filesystem directly. Instead it receives a `HostApi` object whose
 * every sensitive method is permission-checked, audited and resource-accounted
 * by the host. This is the controlled public API the architecture mandates:
 * React → IPC → Application → Domain → Infrastructure, with plugins strictly
 * outside the domain, mediated by the host.
 */
import { type GarmentView, type ExtensionContribution } from './extensionPoints';

/** Read-only wardrobe access (gated by `wardrobe:read`). */
export interface WardrobeApi {
  /** List garment views (never live domain entities — read-only DTOs). */
  listGarments(): Promise<readonly GarmentView[]>;
  /** Fetch a single garment view by id, or `null`. */
  getGarment(id: string): Promise<GarmentView | null>;
  /** Count garments (cheap; gated by `wardrobe:read`). */
  count(): Promise<number>;
}

/** A recommendation summary exposed to plugins (gated by `recommendations:read`). */
export interface RecommendationSummary {
  readonly kind: string;
  readonly label: string;
  readonly score: number;
  readonly garmentIds: readonly string[];
  readonly explanation: string;
}

/** Recommendation access (gated by `recommendations:read`). */
export interface RecommendationsApi {
  request(message: string): Promise<readonly RecommendationSummary[]>;
}

/** Plugin-scoped key/value storage (gated by `storage:plugin`). */
export interface PluginStorageApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<readonly string[]>;
}

/** Logging the plugin may write (gated by `log:write`). */
export interface PluginLogApi {
  info(message: string, detail?: Readonly<Record<string, unknown>>): void;
  warn(message: string, detail?: Readonly<Record<string, unknown>>): void;
  error(message: string, detail?: Readonly<Record<string, unknown>>): void;
}

/**
 * The complete host API. The host builds ONE of these per plugin, bound to that
 * plugin's identity and granted capabilities. Calling any method without the
 * required capability throws a `PermissionDeniedError` and is audited.
 */
export interface HostApi {
  /** Versions, so a plugin can adapt to the host it runs in. */
  readonly host: {
    readonly version: string;
    readonly sdkVersion: string;
  };
  readonly wardrobe: WardrobeApi;
  readonly recommendations: RecommendationsApi;
  readonly storage: PluginStorageApi;
  readonly log: PluginLogApi;
  /**
   * Register an extension contribution. The host validates that the plugin
   * holds the capability the contribution's extension point requires before
   * accepting it; otherwise it throws `PermissionDeniedError`.
   */
  register(contribution: ExtensionContribution): void;
}
