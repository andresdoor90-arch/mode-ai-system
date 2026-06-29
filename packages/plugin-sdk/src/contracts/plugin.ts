/**
 * The plugin author's contract.
 *
 * A plugin is a tiny module exposing `activate` (and optionally `deactivate`).
 * On activation it receives a {@link PluginContext} carrying its manifest and
 * the capability-gated {@link HostApi}; everything it does flows through that
 * API. The plugin never imports the domain or infrastructure — it is pure
 * "guest" code the host runs inside a sandbox.
 */
import { type HostApi } from './hostApi';
import { type PluginManifest } from './manifest';

/** Context handed to a plugin at activation. */
export interface PluginContext {
  /** The plugin's own (validated) manifest. */
  readonly manifest: PluginManifest;
  /** The capability-gated host API. */
  readonly host: HostApi;
}

/** The interface a plugin module must implement. */
export interface PluginModule {
  /** Called once when the plugin becomes active; register contributions here. */
  activate(context: PluginContext): void | Promise<void>;
  /** Called when the plugin is deactivated; release resources here. */
  deactivate?(): void | Promise<void>;
}

/**
 * A resolvable plugin source. The loader uses it to obtain the manifest, the
 * signed package bytes (for verification) and the executable module. In-process
 * sources (tests, bundled first-party plugins) return the module directly; the
 * Worker-Thread adapter resolves `manifest.main` instead.
 */
export interface ResolvedPlugin {
  readonly manifest: PluginManifest;
  /** Canonical package bytes the signature is computed over. */
  readonly packageBytes: Uint8Array;
  /** The executable module (optional for worker-resolved plugins). */
  readonly module?: PluginModule;
  /** Detached signature over {@link packageBytes}, when signed. */
  readonly signature?: Uint8Array;
  /** Id of the key that signed the package (looked up in the trust store). */
  readonly keyId?: string;
}

/** Something that can produce a {@link ResolvedPlugin}. */
export interface PluginSource {
  readonly id: string;
  resolve(): Promise<ResolvedPlugin>;
}
