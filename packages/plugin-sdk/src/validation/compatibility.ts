/**
 * Host / SDK compatibility validation.
 *
 * A validated manifest declares the host (`engines.mas`) and optional SDK
 * (`engines.sdk`) semver ranges it needs. The {@link CompatibilityChecker}
 * decides whether the running host + SDK satisfy them — the gate that prevents
 * a plugin built for a different M-A-S version from loading.
 */
import { type PluginManifest } from '../contracts/manifest';
import { satisfies } from './semver';

/** Versions of the running host the checker validates against. */
export interface HostEnvironment {
  /** The M-A-S host application version. */
  readonly hostVersion: string;
  /** The `@mas/plugin-sdk` version. */
  readonly sdkVersion: string;
}

/** The result of a compatibility check. */
export type CompatibilityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

/** Validates a manifest's declared engine ranges against the host. */
export class CompatibilityChecker {
  public constructor(private readonly env: HostEnvironment) {}

  /** Check a manifest; collects every unmet range. */
  public check(manifest: PluginManifest): CompatibilityResult {
    const reasons: string[] = [];

    if (!satisfies(this.env.hostVersion, manifest.engines.mas)) {
      reasons.push(
        `Requires M-A-S host "${manifest.engines.mas}" but host is ${this.env.hostVersion}.`,
      );
    }

    const sdkRange = manifest.engines.sdk;
    if (sdkRange !== undefined && !satisfies(this.env.sdkVersion, sdkRange)) {
      reasons.push(
        `Requires plugin SDK "${sdkRange}" but SDK is ${this.env.sdkVersion}.`,
      );
    }

    return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
  }

  /** Convenience boolean form. */
  public isCompatible(manifest: PluginManifest): boolean {
    return this.check(manifest).ok;
  }
}
