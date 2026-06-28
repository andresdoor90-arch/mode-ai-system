/**
 * Capability / permission model.
 *
 * A plugin can do NOTHING by default. Every sensitive action the host API
 * exposes is gated behind a named {@link PluginCapability} the plugin must
 * declare in its manifest AND have granted at activation. This is the single
 * vocabulary the manifest validator, the permission guard and the host API
 * factory all share, so a capability can never be enforced inconsistently.
 */

/**
 * The closed set of capabilities a plugin may request. Capabilities are
 * additive and intentionally fine-grained so the host can grant the minimum a
 * plugin needs (principle of least privilege).
 */
export const PLUGIN_CAPABILITIES = [
  // --- data access (read/write the wardrobe through controlled APIs) ---
  'wardrobe:read',
  'wardrobe:write',
  'categories:read',
  'history:read',
  'recommendations:read',
  // --- extension contributions (one per extension point family) ---
  'ai:provide',
  'embedding:provide',
  'rendering:provide',
  'analyzer:provide',
  'import:provide',
  'export:provide',
  'imageFormat:provide',
  'recommendation:contribute',
  'ui:contribute',
  'garmentType:contribute',
  'categoryType:contribute',
  // --- ambient services ---
  'storage:plugin',
  'log:write',
  'network', // denied by the sandbox unless explicitly granted; reserved.
] as const;

/** A single capability identifier. */
export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

/** Fast membership test used by the manifest validator. */
export const isPluginCapability = (value: unknown): value is PluginCapability =>
  typeof value === 'string' && (PLUGIN_CAPABILITIES as readonly string[]).includes(value);

/**
 * A resolved permission grant for one plugin: the set of capabilities the host
 * has actually approved. The {@link PermissionGuard} consults this on every
 * host-API call.
 */
export interface PermissionGrant {
  readonly pluginId: string;
  readonly granted: ReadonlySet<PluginCapability>;
}

/**
 * The decision a user/host makes when a plugin requests capabilities. Returning
 * a subset implements partial approval; returning all requested implements
 * "trust this plugin". The default policy used in tests approves exactly what
 * was declared.
 */
export type PermissionApprover = (
  pluginId: string,
  requested: readonly PluginCapability[],
) => readonly PluginCapability[] | Promise<readonly PluginCapability[]>;

/** Approve every requested capability (used as the permissive default). */
export const approveAll: PermissionApprover = (_pluginId, requested) => requested;
