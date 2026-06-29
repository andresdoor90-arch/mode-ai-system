/**
 * Plugin worker entry point (ADR-005) — runs INSIDE a Worker Thread.
 *
 * Loads the plugin module from its `main` entry, hands it a PROXY `HostApi`
 * whose every method round-trips to the host process over `postMessage`, and
 * mediates the activate/deactivate lifecycle. Contributions the plugin
 * registers are serialised (data verbatim, function members as method markers)
 * and invoked back here on demand, so executable code never leaves the worker.
 *
 * STATUS: CI/runtime-deferred — requires the Node `worker_threads` runtime and
 * a built plugin bundle. The offline test suite uses the in-process sandbox.
 */
import { parentPort, workerData } from 'node:worker_threads';

import {
  type HostApi,
  type PluginContext,
  type PluginManifest,
  type PluginModule,
} from '@mas/plugin-sdk';

interface WorkerData {
  readonly manifest: PluginManifest;
  readonly main: string;
}

const port = parentPort;
if (port === null) {
  throw new Error('pluginWorkerEntry must run inside a Worker Thread.');
}

const { manifest, main } = workerData as WorkerData;

let callSeq = 0;
const pendingCalls = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const contributions = new Map<number, Record<string, unknown>>();
let contributionSeq = 0;
let plugin: PluginModule | undefined;

/** Issue a host-API call and await the host's response. */
const hostCall = (path: readonly string[], args: readonly unknown[]): Promise<unknown> => {
  const callId = (callSeq += 1);
  return new Promise<unknown>((resolve, reject) => {
    pendingCalls.set(callId, { resolve, reject });
    port.postMessage({ type: 'host-call', callId, path, args });
  });
};

/** Build the async proxy method bound to a host path. */
const proxyMethod =
  (...path: string[]) =>
  (...args: unknown[]): Promise<unknown> =>
    hostCall(path, args);

/** Reconstruct the capability-gated host API as a message-passing proxy. */
const buildHostProxy = (): HostApi =>
  ({
    host: { version: 'proxy', sdkVersion: 'proxy' },
    wardrobe: {
      listGarments: proxyMethod('wardrobe', 'listGarments'),
      getGarment: proxyMethod('wardrobe', 'getGarment'),
      count: proxyMethod('wardrobe', 'count'),
    },
    recommendations: { request: proxyMethod('recommendations', 'request') },
    storage: {
      get: proxyMethod('storage', 'get'),
      set: proxyMethod('storage', 'set'),
      delete: proxyMethod('storage', 'delete'),
      keys: proxyMethod('storage', 'keys'),
    },
    log: {
      info: (m: string, d?: Record<string, unknown>) => void hostCall(['log', 'info'], [m, d]),
      warn: (m: string, d?: Record<string, unknown>) => void hostCall(['log', 'warn'], [m, d]),
      error: (m: string, d?: Record<string, unknown>) => void hostCall(['log', 'error'], [m, d]),
    },
    register: (contribution: unknown): void => {
      const id = (contributionSeq += 1);
      const record = contribution as Record<string, unknown>;
      contributions.set(id, record);
      const data: Record<string, unknown> = {};
      const methods: string[] = [];
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'function') methods.push(key);
        else data[key] = value;
      }
      port.postMessage({ type: 'register', contributionId: id, descriptor: { data, methods } });
    },
  }) as unknown as HostApi;

const hostProxy = buildHostProxy();

const loadPlugin = async (): Promise<PluginModule> => {
  if (plugin === undefined) {
    const mod = (await import(main)) as { default?: PluginModule } & Partial<PluginModule>;
    plugin = mod.default ?? (mod as PluginModule);
  }
  return plugin;
};

port.on('message', (msg: Record<string, unknown>) => {
  void (async (): Promise<void> => {
    const type = msg.type as string;
    if (type === 'activate' || type === 'deactivate') {
      try {
        const mod = await loadPlugin();
        if (type === 'activate') {
          const context: PluginContext = { manifest, host: hostProxy };
          await mod.activate(context);
        } else if (mod.deactivate !== undefined) {
          await mod.deactivate();
        }
        port.postMessage({ type: 'lifecycle-result', phase: type, ok: true });
      } catch (error) {
        port.postMessage({
          type: 'lifecycle-result',
          phase: type,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (type === 'host-call-result') {
      const pending = pendingCalls.get(msg.callId as number);
      if (pending !== undefined) {
        pendingCalls.delete(msg.callId as number);
        if (msg.ok === true) pending.resolve(msg.value);
        else pending.reject(new Error((msg.error as string) ?? 'host call failed'));
      }
    } else if (type === 'contribution-invoke') {
      const contribution = contributions.get(msg.contributionId as number);
      const invokeId = msg.invokeId as number;
      try {
        const method = contribution?.[msg.method as string];
        const value = await (method as (...a: unknown[]) => unknown).apply(
          contribution,
          msg.args as unknown[],
        );
        port.postMessage({ type: 'contribution-invoke-result', invokeId, ok: true, value });
      } catch (error) {
        port.postMessage({
          type: 'contribution-invoke-result',
          invokeId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  })();
});

port.postMessage({ type: 'ready' });
