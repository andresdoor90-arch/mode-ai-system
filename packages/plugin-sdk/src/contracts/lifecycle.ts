/**
 * Plugin lifecycle state machine contract.
 *
 * A plugin moves through a strict, explicit lifecycle. Every legal edge is
 * enumerated here; anything not listed is rejected by the
 * {@link PluginLifecycleMachine}. Encoding the transitions as data (rather than
 * scattered `if`s) keeps the rules auditable and lets the host reason about
 * "can I activate this plugin right now?" without duplicating logic.
 */

/** The discrete states a plugin can occupy. */
export enum PluginLifecycleState {
  /** Found by a source but not yet installed into the registry. */
  Discovered = 'discovered',
  /** Installed (persisted/registered) but not yet validated. */
  Installed = 'installed',
  /** Manifest + compatibility + signature checks passed; ready to activate. */
  Validated = 'validated',
  /** Running inside a sandbox; contributions are live. */
  Active = 'active',
  /** Previously active, now stopped; contributions withdrawn but still installed. */
  Inactive = 'inactive',
  /** Removed entirely; a terminal state for this registration. */
  Uninstalled = 'uninstalled',
  /** A validation/activation failure parked the plugin in a safe error state. */
  Failed = 'failed',
}

/** The events that drive transitions. */
export enum PluginLifecycleEvent {
  Install = 'install',
  Validate = 'validate',
  Activate = 'activate',
  Deactivate = 'deactivate',
  Uninstall = 'uninstall',
  Fail = 'fail',
  /** Recover a failed plugin back to the installed state for another attempt. */
  Reset = 'reset',
}

/**
 * The authoritative transition table: for a given state, which event leads to
 * which next state. Absent entries are illegal transitions.
 */
export const LIFECYCLE_TRANSITIONS: Readonly<
  Record<PluginLifecycleState, Partial<Record<PluginLifecycleEvent, PluginLifecycleState>>>
> = {
  [PluginLifecycleState.Discovered]: {
    [PluginLifecycleEvent.Install]: PluginLifecycleState.Installed,
    [PluginLifecycleEvent.Fail]: PluginLifecycleState.Failed,
  },
  [PluginLifecycleState.Installed]: {
    [PluginLifecycleEvent.Validate]: PluginLifecycleState.Validated,
    [PluginLifecycleEvent.Uninstall]: PluginLifecycleState.Uninstalled,
    [PluginLifecycleEvent.Fail]: PluginLifecycleState.Failed,
  },
  [PluginLifecycleState.Validated]: {
    [PluginLifecycleEvent.Activate]: PluginLifecycleState.Active,
    [PluginLifecycleEvent.Uninstall]: PluginLifecycleState.Uninstalled,
    [PluginLifecycleEvent.Fail]: PluginLifecycleState.Failed,
  },
  [PluginLifecycleState.Active]: {
    [PluginLifecycleEvent.Deactivate]: PluginLifecycleState.Inactive,
    [PluginLifecycleEvent.Fail]: PluginLifecycleState.Failed,
  },
  [PluginLifecycleState.Inactive]: {
    [PluginLifecycleEvent.Activate]: PluginLifecycleState.Active,
    [PluginLifecycleEvent.Uninstall]: PluginLifecycleState.Uninstalled,
    [PluginLifecycleEvent.Fail]: PluginLifecycleState.Failed,
  },
  [PluginLifecycleState.Failed]: {
    [PluginLifecycleEvent.Reset]: PluginLifecycleState.Installed,
    [PluginLifecycleEvent.Uninstall]: PluginLifecycleState.Uninstalled,
  },
  [PluginLifecycleState.Uninstalled]: {
    // Terminal — no outgoing transitions.
  },
};

/** Compute the next state for an event, or `null` when the edge is illegal. */
export const nextLifecycleState = (
  current: PluginLifecycleState,
  event: PluginLifecycleEvent,
): PluginLifecycleState | null => LIFECYCLE_TRANSITIONS[current][event] ?? null;

/** A record of one lifecycle transition (for the activity log / diagnostics). */
export interface LifecycleTransitionRecord {
  readonly pluginId: string;
  readonly from: PluginLifecycleState;
  readonly event: PluginLifecycleEvent;
  readonly to: PluginLifecycleState;
  readonly at: string;
}
