/**
 * @mas/plugin-sdk — Plugin SDK entry point.
 *
 * Public surface for third-party plugin developers: the plugin manifest
 * schema, lifecycle hook contracts and the host API exposed to plugins
 * running inside sandboxed Worker Threads.
 *
 * Phase 1 ships only the package scaffold; the SDK is implemented in Phase 7.
 */

/** Package name, useful for diagnostics and logging. */
export const PLUGIN_SDK_PACKAGE_NAME = '@mas/plugin-sdk' as const;

/** Semantic version of the plugin SDK package. */
export const PLUGIN_SDK_VERSION = '0.1.0' as const;

/** Version of the plugin manifest contract supported by this SDK. */
export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;
