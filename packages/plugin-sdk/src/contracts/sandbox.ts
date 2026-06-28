/**
 * The plugin sandbox contract + resource-limit types.
 *
 * Isolation is expressed behind an interface so the CORE host logic stays
 * engine-agnostic and unit-testable offline: an in-process reference sandbox
 * (`InProcessPluginSandbox`) runs plugins directly for tests, while the
 * intended runtime — a Worker-Threads adapter per ADR-005 — implements the same
 * interface in the desktop main process. Neither the manager nor the tests need
 * to spawn a real worker.
 */
import { type HostApi } from './hostApi';
import { type PluginManifest } from './manifest';
import { type PluginModule } from './plugin';

/**
 * Resource limits enforced at the sandbox boundary. The in-process sandbox
 * enforces wall-clock time per call and an invocation quota; the Worker adapter
 * additionally enforces a real memory ceiling via worker `resourceLimits`.
 */
export interface ResourceLimits {
  /** Max wall-clock time (ms) for a single sandboxed call. */
  readonly maxCallMs: number;
  /** Max number of host-API/lifecycle calls before the plugin is throttled. */
  readonly maxInvocations: number;
  /** Advisory memory ceiling (MB) — enforced by the Worker adapter at runtime. */
  readonly maxMemoryMb: number;
}

/** Sensible defaults applied when the host does not override them. */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxCallMs: 2_000,
  maxInvocations: 10_000,
  maxMemoryMb: 128,
};

/** Everything a sandbox needs to run one plugin. */
export interface SandboxRunInput {
  readonly manifest: PluginManifest;
  /** Direct module for in-process sandboxes; the Worker adapter loads `main`. */
  readonly module?: PluginModule;
  /** The capability-gated API the plugin receives at activation. */
  readonly host: HostApi;
  readonly limits: ResourceLimits;
}

/** A live handle to a sandboxed plugin. */
export interface SandboxHandle {
  /** Run the plugin's `activate`. Contained: it never throws into the host. */
  activate(): Promise<SandboxOutcome>;
  /** Run the plugin's `deactivate`. Contained. */
  deactivate(): Promise<SandboxOutcome>;
  /** Tear down the sandbox and release resources. */
  dispose(): Promise<void>;
  /** Whether the plugin has faulted (and been contained). */
  readonly faulted: boolean;
}

/** The contained result of a sandboxed call. */
export interface SandboxOutcome {
  readonly ok: boolean;
  /** Populated when `ok` is false; the contained error (never re-thrown). */
  readonly error?: Error;
  /** Wall-clock duration of the call (ms), for resource accounting. */
  readonly durationMs: number;
}

/** The sandbox port: produce a handle for a given run input. */
export interface IPluginSandbox {
  /** Identifies the isolation strategy (e.g. "in-process", "worker-thread"). */
  readonly kind: string;
  run(input: SandboxRunInput): Promise<SandboxHandle>;
}
