/**
 * Manifest validation.
 *
 * Turns an untrusted, arbitrary `unknown` (e.g. parsed JSON from disk) into a
 * typed {@link PluginManifest}, or a precise error. Validation is total and
 * never throws — it returns a `Result`-style discriminated union so the loader
 * can park a bad plugin in the `Failed` state with a clear reason.
 */
import {
  MANIFEST_LIMITS,
  PLUGIN_ID_PATTERN,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  type PluginManifest,
} from '../contracts/manifest';
import { ExtensionPointId } from '../contracts/extensionPoints';
import { isPluginCapability, type PluginCapability } from '../contracts/permissions';
import { isValidSemVer } from './semver';

/** Outcome of validating a manifest. */
export type ManifestValidationResult =
  | { readonly ok: true; readonly manifest: PluginManifest }
  | { readonly ok: false; readonly errors: readonly string[] };

const EXTENSION_POINT_VALUES = new Set<string>(Object.values(ExtensionPointId));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate an arbitrary value as a plugin manifest. Collects ALL problems so
 * the author sees every issue at once rather than one-at-a-time.
 */
export const validateManifest = (input: unknown): ManifestValidationResult => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ['Manifest must be an object.'] };
  }

  const id = input.id;
  if (typeof id !== 'string' || id.length === 0) {
    errors.push('Manifest "id" is required and must be a non-empty string.');
  } else if (id.length > MANIFEST_LIMITS.idMaxLength) {
    errors.push(`Manifest "id" must be at most ${MANIFEST_LIMITS.idMaxLength} characters.`);
  } else if (!PLUGIN_ID_PATTERN.test(id)) {
    errors.push('Manifest "id" must be lower-case alphanumeric with "." or "-" separators.');
  }

  const name = input.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Manifest "name" is required and must be a non-empty string.');
  } else if (name.length > MANIFEST_LIMITS.nameMaxLength) {
    errors.push(`Manifest "name" must be at most ${MANIFEST_LIMITS.nameMaxLength} characters.`);
  }

  const version = input.version;
  if (typeof version !== 'string' || !isValidSemVer(version)) {
    errors.push('Manifest "version" is required and must be a valid semantic version.');
  }

  const schema = input.manifestSchemaVersion;
  if (schema !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    errors.push(
      `Manifest "manifestSchemaVersion" must equal ${PLUGIN_MANIFEST_SCHEMA_VERSION} (got ${String(
        schema,
      )}).`,
    );
  }

  const engines = input.engines;
  if (!isRecord(engines)) {
    errors.push('Manifest "engines" is required and must be an object.');
  } else {
    if (typeof engines.mas !== 'string' || engines.mas.trim().length === 0) {
      errors.push('Manifest "engines.mas" is required (a semver range for the host).');
    }
    if (engines.sdk !== undefined && typeof engines.sdk !== 'string') {
      errors.push('Manifest "engines.sdk" must be a string semver range when present.');
    }
  }

  const permissions = input.permissions;
  const validPermissions: PluginCapability[] = [];
  if (!Array.isArray(permissions)) {
    errors.push('Manifest "permissions" is required and must be an array.');
  } else {
    for (const cap of permissions) {
      if (!isPluginCapability(cap)) {
        errors.push(`Unknown permission/capability "${String(cap)}".`);
      } else {
        validPermissions.push(cap);
      }
    }
  }

  const contributes = input.contributes;
  const validContributes: ExtensionPointId[] = [];
  if (contributes !== undefined) {
    if (!Array.isArray(contributes)) {
      errors.push('Manifest "contributes" must be an array when present.');
    } else {
      for (const point of contributes) {
        if (typeof point !== 'string' || !EXTENSION_POINT_VALUES.has(point)) {
          errors.push(`Unknown extension point "${String(point)}".`);
        } else {
          validContributes.push(point as ExtensionPointId);
        }
      }
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string') {
      errors.push('Manifest "description" must be a string when present.');
    } else if (input.description.length > MANIFEST_LIMITS.descriptionMaxLength) {
      errors.push(
        `Manifest "description" must be at most ${MANIFEST_LIMITS.descriptionMaxLength} characters.`,
      );
    }
  }
  if (input.author !== undefined && typeof input.author !== 'string') {
    errors.push('Manifest "author" must be a string when present.');
  }
  if (input.homepage !== undefined && typeof input.homepage !== 'string') {
    errors.push('Manifest "homepage" must be a string when present.');
  }
  if (input.main !== undefined && typeof input.main !== 'string') {
    errors.push('Manifest "main" must be a string when present.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const engineObj = engines as Record<string, unknown>;
  const manifest: PluginManifest = {
    id: id as string,
    name: name as string,
    version: version as string,
    manifestSchemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
    engines: {
      mas: engineObj.mas as string,
      ...(typeof engineObj.sdk === 'string' ? { sdk: engineObj.sdk } : {}),
    },
    permissions: validPermissions,
    contributes: validContributes,
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.author === 'string' ? { author: input.author } : {}),
    ...(typeof input.homepage === 'string' ? { homepage: input.homepage } : {}),
    ...(typeof input.main === 'string' ? { main: input.main } : {}),
  };

  return { ok: true, manifest };
};
