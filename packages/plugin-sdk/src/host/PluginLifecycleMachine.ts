/**
 * The plugin lifecycle state machine.
 *
 * Owns one plugin's current {@link PluginLifecycleState} and only permits the
 * transitions declared in `LIFECYCLE_TRANSITIONS`. Illegal transitions throw an
 * {@link IllegalLifecycleTransitionError}, so the manager can never drive a
 * plugin into an inconsistent state (e.g. activating something uninstalled).
 */
import {
  LifecycleTransitionRecord,
  PluginLifecycleEvent,
  PluginLifecycleState,
  nextLifecycleState,
} from '../contracts/lifecycle';
import { IllegalLifecycleTransitionError } from '../contracts/errors';

export class PluginLifecycleMachine {
  private _state: PluginLifecycleState;
  private readonly _history: LifecycleTransitionRecord[] = [];

  public constructor(
    public readonly pluginId: string,
    initial: PluginLifecycleState = PluginLifecycleState.Discovered,
    private readonly now: () => Date = () => new Date(),
  ) {
    this._state = initial;
  }

  /** Current state. */
  public get state(): PluginLifecycleState {
    return this._state;
  }

  /** Immutable transition history (for diagnostics / activity log). */
  public get history(): readonly LifecycleTransitionRecord[] {
    return this._history;
  }

  /** Whether the given event is legal from the current state. */
  public can(event: PluginLifecycleEvent): boolean {
    return nextLifecycleState(this._state, event) !== null;
  }

  /**
   * Apply an event, advancing the state. Throws when the edge is illegal so a
   * misuse surfaces immediately rather than corrupting state silently.
   */
  public apply(event: PluginLifecycleEvent): PluginLifecycleState {
    const to = nextLifecycleState(this._state, event);
    if (to === null) {
      throw new IllegalLifecycleTransitionError(
        `Cannot "${event}" from state "${this._state}".`,
        this.pluginId,
      );
    }
    const record: LifecycleTransitionRecord = {
      pluginId: this.pluginId,
      from: this._state,
      event,
      to,
      at: this.now().toISOString(),
    };
    this._state = to;
    this._history.push(record);
    return to;
  }
}
