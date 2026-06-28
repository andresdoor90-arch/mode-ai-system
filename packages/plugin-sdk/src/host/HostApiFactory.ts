/**
 * Host API factory — builds the capability-gated {@link HostApi} for one plugin.
 *
 * This is the heart of the controlled-access model: the plugin only ever sees
 * the object this factory returns. Every method:
 *   1. refuses if the plugin is throttled (resource limits),
 *   2. requires the mapped capability (permission validation),
 *   3. records the action (activity logging),
 *   4. then delegates to the host-supplied {@link HostBackend}.
 *
 * The backend is provided by the desktop host and is the ONLY bridge to the
 * domain/application layer (CQRS buses) — the plugin can never reach `@mas/core`
 * or `@mas/infrastructure` itself. `register` enforces that a contribution's
 * required capability is held before it is accepted into the extension registry.
 */
import { type PluginActivityLogger } from '../contracts/activity';
import {
  EXTENSION_POINT_CAPABILITY,
  type ExtensionContribution,
  type GarmentView,
} from '../contracts/extensionPoints';
import {
  type HostApi,
  type PluginStorageApi,
  type RecommendationSummary,
} from '../contracts/hostApi';
import { type PluginManifest } from '../contracts/manifest';
import { type ActivityLog } from './ActivityLog';
import { type ExtensionRegistry } from './ExtensionRegistry';
import { type PermissionGuard } from './PermissionGuard';
import { type ResourceMeter } from './ResourceMeter';

/**
 * The bridge the desktop host implements to back the plugin API with the real
 * application layer. Plugin-agnostic: the factory binds it to one plugin's
 * identity, guard and meter.
 */
export interface HostBackend {
  readonly hostVersion: string;
  readonly sdkVersion: string;
  listGarments(): Promise<readonly GarmentView[]>;
  getGarment(id: string): Promise<GarmentView | null>;
  countGarments(): Promise<number>;
  requestRecommendations(message: string): Promise<readonly RecommendationSummary[]>;
  /** A plugin-scoped key/value store (the host namespaces by plugin id). */
  storageFor(pluginId: string): PluginStorageApi;
}

/** Inputs the factory needs to assemble a plugin's host API. */
export interface HostApiFactoryInput {
  readonly manifest: PluginManifest;
  readonly guard: PermissionGuard;
  readonly meter: ResourceMeter;
  readonly backend: HostBackend;
  readonly extensions: ExtensionRegistry;
  readonly activity: ActivityLog;
  /** Optional plugin-facing logger sink (defaults to the activity log). */
  readonly pluginLogger?: PluginActivityLogger;
}

/** Build a capability-gated {@link HostApi} bound to one plugin. */
export const createHostApi = (input: HostApiFactoryInput): HostApi => {
  const { manifest, guard, meter, backend, extensions, activity } = input;
  const pluginId = manifest.id;

  /** Shared gate applied to every sensitive call. */
  const gate = (capability: Parameters<PermissionGuard['require']>[0], action: string): void => {
    meter.ensureNotThrottled();
    guard.require(capability);
    meter.account(0);
    activity.record(pluginId, action, 'debug');
  };

  const storage = backend.storageFor(pluginId);

  return {
    host: { version: backend.hostVersion, sdkVersion: backend.sdkVersion },

    wardrobe: {
      async listGarments(): Promise<readonly GarmentView[]> {
        gate('wardrobe:read', 'wardrobe.listGarments');
        return backend.listGarments();
      },
      async getGarment(id: string): Promise<GarmentView | null> {
        gate('wardrobe:read', 'wardrobe.getGarment');
        return backend.getGarment(id);
      },
      async count(): Promise<number> {
        gate('wardrobe:read', 'wardrobe.count');
        return backend.countGarments();
      },
    },

    recommendations: {
      async request(message: string): Promise<readonly RecommendationSummary[]> {
        gate('recommendations:read', 'recommendations.request');
        return backend.requestRecommendations(message);
      },
    },

    storage: {
      async get(key: string): Promise<string | null> {
        gate('storage:plugin', 'storage.get');
        return storage.get(key);
      },
      async set(key: string, value: string): Promise<void> {
        gate('storage:plugin', 'storage.set');
        return storage.set(key, value);
      },
      async delete(key: string): Promise<void> {
        gate('storage:plugin', 'storage.delete');
        return storage.delete(key);
      },
      async keys(): Promise<readonly string[]> {
        gate('storage:plugin', 'storage.keys');
        return storage.keys();
      },
    },

    log: {
      info(message: string, detail?: Readonly<Record<string, unknown>>): void {
        gate('log:write', 'log.info');
        activity.record(pluginId, `log: ${message}`, 'info', detail);
      },
      warn(message: string, detail?: Readonly<Record<string, unknown>>): void {
        gate('log:write', 'log.warn');
        activity.record(pluginId, `log: ${message}`, 'warn', detail);
      },
      error(message: string, detail?: Readonly<Record<string, unknown>>): void {
        gate('log:write', 'log.error');
        activity.record(pluginId, `log: ${message}`, 'error', detail);
      },
    },

    register(contribution: ExtensionContribution): void {
      const capability = EXTENSION_POINT_CAPABILITY[contribution.point];
      meter.ensureNotThrottled();
      guard.require(capability);
      meter.account(0);
      extensions.add(pluginId, contribution);
      activity.record(pluginId, `register:${contribution.point}`, 'info');
    },
  };
};
