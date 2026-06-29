/**
 * @mas/plugin-sdk — the definitive M-A-S extensibility system (Phase 7 C/D/E).
 *
 * This package is PURE and engine-agnostic: it imports only `@mas/core` (for the
 * port/entity types extensions hook into) and Node's built-in `crypto` (for
 * signature verification). It never imports Electron, the renderer, the
 * database or any AI/graphics library, so the entire plugin host kernel —
 * registry, manifest validation, semver/compatibility, the permission model,
 * the lifecycle state machine, the capability-gated API surface, resource-limit
 * accounting, the activity log and signature verification — is fully
 * unit-testable offline with Node built-ins. The Worker-Threads sandbox adapter
 * (ADR-005) and the renderer panels are the only runtime-deferred pieces; both
 * implement interfaces declared here.
 *
 * Layers:
 *  - `contracts`  — the STABLE public surface plugin authors + the host share
 *                   (manifest, permissions, lifecycle, extension points, host
 *                   API, plugin module, sandbox, activity, errors).
 *  - `validation` — pure semver + manifest + compatibility validators.
 *  - `host`       — the reference plugin host runtime (loader, registry,
 *                   lifecycle machine, permission guard, resource meter,
 *                   activity log, signature verifier, extension registry,
 *                   in-process sandbox, host-API factory, plugin manager).
 */

/** Package name, useful for diagnostics and logging. */
export const PLUGIN_SDK_PACKAGE_NAME = '@mas/plugin-sdk' as const;

/** Semantic version of the plugin SDK package. */
export const PLUGIN_SDK_VERSION = '0.7.0' as const;

/* -------------------------------- contracts ------------------------------- */
export * from './contracts/errors';
export * from './contracts/manifest';
export * from './contracts/permissions';
export * from './contracts/lifecycle';
export * from './contracts/extensionPoints';
export * from './contracts/activity';
export * from './contracts/hostApi';
export * from './contracts/plugin';
export * from './contracts/sandbox';

/* ------------------------------- validation ------------------------------- */
export * from './validation/semver';
export * from './validation/manifestValidator';
export * from './validation/compatibility';

/* ---------------------------------- host ---------------------------------- */
export * from './host/SignatureVerifier';
export * from './host/PluginLifecycleMachine';
export * from './host/PermissionGuard';
export * from './host/ResourceMeter';
export * from './host/ActivityLog';
export * from './host/ExtensionRegistry';
export * from './host/PluginRegistry';
export * from './host/InProcessPluginSandbox';
export * from './host/InMemoryPluginStorage';
export * from './host/HostApiFactory';
export * from './host/PluginLoader';
export * from './host/inProcessSource';
export * from './host/PluginManager';
