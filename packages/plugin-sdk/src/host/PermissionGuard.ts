/**
 * Permission guard (security — Part E).
 *
 * Holds the resolved capability grant for one plugin and enforces it on every
 * host-API call. There is exactly one guard per plugin, so a capability check
 * can never be bypassed by a different code path.
 */
import { PermissionDeniedError } from '../contracts/errors';
import { type PluginCapability } from '../contracts/permissions';

export class PermissionGuard {
  private readonly granted: ReadonlySet<PluginCapability>;

  public constructor(
    public readonly pluginId: string,
    granted: Iterable<PluginCapability>,
  ) {
    this.granted = new Set(granted);
  }

  /** Whether the plugin holds a capability. */
  public has(capability: PluginCapability): boolean {
    return this.granted.has(capability);
  }

  /** All granted capabilities (read-only view). */
  public capabilities(): readonly PluginCapability[] {
    return [...this.granted];
  }

  /**
   * Assert the plugin holds a capability, throwing {@link PermissionDeniedError}
   * otherwise. Returns the capability so call-sites can chain.
   */
  public require(capability: PluginCapability): PluginCapability {
    if (!this.granted.has(capability)) {
      throw new PermissionDeniedError(capability, this.pluginId);
    }
    return capability;
  }
}
