/**
 * Plugin error hierarchy.
 *
 * Deliberately distinct from the domain (`@mas/core` `DomainError`) and
 * infrastructure error families: these errors describe failures of the plugin
 * SUBSYSTEM itself (a bad manifest, an incompatible engine range, a denied
 * permission, a tripped resource limit, a faulting plugin). Each carries a
 * stable, machine-readable `code` so the host/IPC layer can map it to a
 * transport representation without inspecting messages.
 */

/** Base class for every error originating from the plugin subsystem. */
export class PluginError extends Error {
  /** Stable, machine-readable error code. */
  public readonly code: string;
  /** The plugin this error concerns, when known. */
  public readonly pluginId: string | undefined;

  public constructor(message: string, code = 'PLUGIN_ERROR', pluginId?: string) {
    super(message);
    this.name = 'PluginError';
    this.code = code;
    this.pluginId = pluginId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when a manifest is missing required fields or malformed. */
export class ManifestValidationError extends PluginError {
  public constructor(message: string, pluginId?: string) {
    super(message, 'PLUGIN_MANIFEST_INVALID', pluginId);
    this.name = 'ManifestValidationError';
  }
}

/** Raised when a plugin declares an engine/SDK range the host cannot satisfy. */
export class IncompatiblePluginError extends PluginError {
  public constructor(message: string, pluginId?: string) {
    super(message, 'PLUGIN_INCOMPATIBLE', pluginId);
    this.name = 'IncompatiblePluginError';
  }
}

/** Raised when a plugin signature is missing/invalid/untrusted under policy. */
export class SignatureVerificationError extends PluginError {
  public constructor(message: string, pluginId?: string) {
    super(message, 'PLUGIN_SIGNATURE_REJECTED', pluginId);
    this.name = 'SignatureVerificationError';
  }
}

/** Raised when a plugin calls an API it was not granted permission to use. */
export class PermissionDeniedError extends PluginError {
  /** The capability that was required but not granted. */
  public readonly capability: string;
  public constructor(capability: string, pluginId?: string) {
    super(
      `Plugin "${pluginId ?? 'unknown'}" lacks the required capability "${capability}".`,
      'PLUGIN_PERMISSION_DENIED',
      pluginId,
    );
    this.name = 'PermissionDeniedError';
    this.capability = capability;
  }
}

/** Raised when a plugin exceeds a resource limit (time/memory/invocations). */
export class ResourceLimitExceededError extends PluginError {
  /** Which limit was exceeded (e.g. "time", "memory", "invocations"). */
  public readonly limit: string;
  public constructor(limit: string, message: string, pluginId?: string) {
    super(message, 'PLUGIN_RESOURCE_LIMIT', pluginId);
    this.name = 'ResourceLimitExceededError';
    this.limit = limit;
  }
}

/** Raised when an illegal lifecycle transition is attempted. */
export class IllegalLifecycleTransitionError extends PluginError {
  public constructor(message: string, pluginId?: string) {
    super(message, 'PLUGIN_ILLEGAL_TRANSITION', pluginId);
    this.name = 'IllegalLifecycleTransitionError';
  }
}

/** Raised when a plugin's own code throws during a sandboxed call. */
export class PluginRuntimeError extends PluginError {
  /** The original error thrown by the plugin, preserved for diagnostics. */
  public override readonly cause: unknown;
  public constructor(message: string, cause: unknown, pluginId?: string) {
    super(message, 'PLUGIN_RUNTIME_ERROR', pluginId);
    this.name = 'PluginRuntimeError';
    this.cause = cause;
  }
}

/** Raised when a plugin id is unknown to the registry. */
export class PluginNotFoundError extends PluginError {
  public constructor(pluginId: string) {
    super(`No plugin registered with id "${pluginId}".`, 'PLUGIN_NOT_FOUND', pluginId);
    this.name = 'PluginNotFoundError';
  }
}

/** Raised when registering a plugin id that already exists. */
export class DuplicatePluginError extends PluginError {
  public constructor(pluginId: string) {
    super(`A plugin with id "${pluginId}" is already registered.`, 'PLUGIN_DUPLICATE', pluginId);
    this.name = 'DuplicatePluginError';
  }
}
