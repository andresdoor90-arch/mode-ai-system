/**
 * Plugin manifest contract.
 *
 * The manifest is the stable, declarative description of a plugin: who it is,
 * what host/SDK versions it needs, which capabilities it requests and which
 * extension points it contributes to. It is plain data (JSON-serialisable) so
 * it can be read, signed and verified WITHOUT executing any plugin code — the
 * cornerstone of the security model.
 */
import { type PluginCapability } from './permissions';
import { type ExtensionPointId } from './extensionPoints';

/** The manifest contract version this SDK understands. Bumped on breaking changes. */
export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Compatibility ranges a plugin declares against the host + SDK. */
export interface PluginEngineRanges {
  /**
   * Semver range the plugin requires of the M-A-S host application
   * (e.g. ">=0.7.0 <1.0.0" or "^0.7.0"). REQUIRED.
   */
  readonly mas: string;
  /** Optional semver range required of the `@mas/plugin-sdk` itself. */
  readonly sdk?: string;
}

/** The declarative plugin manifest. */
export interface PluginManifest {
  /** Globally-unique, stable plugin id (reverse-DNS recommended). */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Plugin's own semantic version. */
  readonly version: string;
  /** Manifest schema version; must equal {@link PLUGIN_MANIFEST_SCHEMA_VERSION}. */
  readonly manifestSchemaVersion: number;
  /** Host/SDK compatibility ranges. */
  readonly engines: PluginEngineRanges;
  /** Capabilities the plugin requests (least-privilege; granted at activation). */
  readonly permissions: readonly PluginCapability[];
  /** Extension points the plugin intends to contribute to. */
  readonly contributes: readonly ExtensionPointId[];
  /** Optional short description. */
  readonly description?: string;
  /** Optional author/vendor string. */
  readonly author?: string;
  /** Optional homepage / repository URL. */
  readonly homepage?: string;
  /**
   * Entry-point module specifier the runtime loads inside the sandbox
   * (e.g. "./dist/index.js"). Opaque to the core; only the sandbox adapter
   * resolves it. Optional for in-process/test plugins supplied directly.
   */
  readonly main?: string;
}

/** Maximum lengths to keep manifests sane and bound parsing work. */
export const MANIFEST_LIMITS = {
  idMaxLength: 128,
  nameMaxLength: 128,
  descriptionMaxLength: 1024,
} as const;

/** Pattern a plugin id must match: lower-case, dotted/dashed segments. */
export const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
