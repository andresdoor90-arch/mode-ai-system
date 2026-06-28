/**
 * Plugin loader — the validation gauntlet a plugin must pass before it can run.
 *
 * Given a {@link PluginSource}, the loader: resolves it, validates the manifest
 * (structure + capabilities + extension points), checks host/SDK compatibility,
 * and verifies the package signature under the active policy. It NEVER executes
 * plugin code — loading is purely about trust and shape — so a malformed,
 * incompatible or untrusted plugin is rejected with a precise error before any
 * sandbox is involved.
 */
import {
  IncompatiblePluginError,
  ManifestValidationError,
  type PluginError,
  SignatureVerificationError,
} from '../contracts/errors';
import { type PluginManifest } from '../contracts/manifest';
import { type PluginSource, type ResolvedPlugin } from '../contracts/plugin';
import { type CompatibilityChecker } from '../validation/compatibility';
import { validateManifest } from '../validation/manifestValidator';
import { SignatureVerifier, type VerificationResult } from './SignatureVerifier';

/** A fully-validated, ready-to-activate plugin. */
export interface LoadedPlugin {
  readonly manifest: PluginManifest;
  readonly resolved: ResolvedPlugin;
  readonly verification: VerificationResult;
}

/** Loader outcome: a loaded plugin or a typed rejection. */
export type LoadResult =
  | { readonly ok: true; readonly loaded: LoadedPlugin }
  | { readonly ok: false; readonly error: PluginError };

export class PluginLoader {
  public constructor(
    private readonly checker: CompatibilityChecker,
    private readonly verifier: SignatureVerifier,
  ) {}

  /** Resolve + validate + compatibility + signature, in that order. */
  public async load(source: PluginSource): Promise<LoadResult> {
    const resolved = await source.resolve();

    // 1) Manifest shape & vocabulary.
    const validation = validateManifest(resolved.manifest);
    if (!validation.ok) {
      return {
        ok: false,
        error: new ManifestValidationError(
          `Invalid manifest: ${validation.errors.join('; ')}`,
          (resolved.manifest as { id?: string }).id,
        ),
      };
    }
    const manifest = validation.manifest;

    // 2) Host / SDK compatibility.
    const compat = this.checker.check(manifest);
    if (!compat.ok) {
      return {
        ok: false,
        error: new IncompatiblePluginError(
          `Incompatible plugin: ${compat.reasons.join('; ')}`,
          manifest.id,
        ),
      };
    }

    // 3) Signature / authenticity.
    const verification = this.verifier.verify(resolved);
    if (!verification.accepted) {
      return {
        ok: false,
        error: new SignatureVerificationError(verification.reason, manifest.id),
      };
    }

    return { ok: true, loaded: { manifest, resolved, verification } };
  }
}
