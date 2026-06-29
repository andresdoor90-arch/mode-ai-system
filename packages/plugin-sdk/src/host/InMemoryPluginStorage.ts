/**
 * In-memory plugin-scoped key/value storage.
 *
 * A tiny default backing for the `storage:plugin` capability: each plugin gets
 * an isolated namespace so one plugin can never read or clobber another's keys.
 * The desktop host may swap this for a durable, file-backed implementation; the
 * `PluginStorageApi` contract is identical.
 */
import { type PluginStorageApi } from '../contracts/hostApi';

/** Provides an isolated {@link PluginStorageApi} per plugin id. */
export class InMemoryPluginStorageProvider {
  private readonly stores = new Map<string, Map<string, string>>();

  /** Get (creating on first use) the isolated store for a plugin. */
  public storageFor(pluginId: string): PluginStorageApi {
    const namespace = this.stores.get(pluginId) ?? new Map<string, string>();
    this.stores.set(pluginId, namespace);
    return {
      get: (key: string): Promise<string | null> => Promise.resolve(namespace.get(key) ?? null),
      set: (key: string, value: string): Promise<void> => {
        namespace.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string): Promise<void> => {
        namespace.delete(key);
        return Promise.resolve();
      },
      keys: (): Promise<readonly string[]> => Promise.resolve([...namespace.keys()]),
    };
  }
}
