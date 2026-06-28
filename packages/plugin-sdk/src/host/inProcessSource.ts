/**
 * In-process plugin source helper.
 *
 * Wraps a directly-supplied {@link PluginModule} + manifest as a
 * {@link PluginSource}, optionally signing its canonical package bytes. Used by
 * first-party bundled plugins and by tests, where the plugin code is already in
 * memory rather than on disk behind a Worker entry point.
 */
import { type KeyObject } from 'node:crypto';

import { type PluginManifest } from '../contracts/manifest';
import { type PluginModule, type PluginSource, type ResolvedPlugin } from '../contracts/plugin';
import { canonicalPackageBytes, signPackage } from './SignatureVerifier';

/** Options for an in-process source. */
export interface InProcessSourceOptions {
  readonly manifest: PluginManifest;
  readonly module: PluginModule;
  /**
   * The plugin's source code (or any stable identity string) the signature is
   * computed over. Defaults to an empty string for unsigned dev plugins.
   */
  readonly code?: string;
  /** When provided, the package is signed with this key under this id. */
  readonly signing?: { readonly keyId: string; readonly privateKey: KeyObject };
}

/** Build a {@link PluginSource} from an in-memory module + manifest. */
export const createInProcessSource = (options: InProcessSourceOptions): PluginSource => {
  const { manifest, module, code = '', signing } = options;
  const packageBytes = canonicalPackageBytes(manifest, code);
  const resolved: ResolvedPlugin = {
    manifest,
    packageBytes,
    module,
    ...(signing !== undefined
      ? { signature: signPackage(packageBytes, signing.privateKey), keyId: signing.keyId }
      : {}),
  };
  return {
    id: manifest.id,
    resolve: (): Promise<ResolvedPlugin> => Promise.resolve(resolved),
  };
};
