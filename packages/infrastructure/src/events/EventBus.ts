/**
 * Infrastructure event system (pub/sub).
 *
 * A lightweight, dependency-free event bus used to publish infrastructure-level
 * events (e.g. "garment persisted", "backup created") to interested
 * subscribers. It is intentionally decoupled: publishers never know who is
 * listening, and the bus contains no business rules — it is pure plumbing.
 *
 * Implemented without `node:events` so it has zero external/runtime
 * dependencies and behaves identically everywhere.
 */

/** Envelope describing a single published event. */
export interface DomainEventEnvelope<TPayload = unknown> {
  /** Dotted event name, e.g. `garment.saved`. */
  readonly type: string;
  /** Arbitrary, event-specific payload. */
  readonly payload: TPayload;
  /** ISO timestamp the event was published at. */
  readonly occurredAt: string;
}

/** A handler invoked when a matching event is published. */
export type EventHandler<TPayload = unknown> = (
  event: DomainEventEnvelope<TPayload>,
) => void | Promise<void>;

/** Unsubscribe function returned by {@link IEventBus.subscribe}. */
export type Unsubscribe = () => void;

/** The event bus port. */
export interface IEventBus {
  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  subscribe<TPayload = unknown>(type: string, handler: EventHandler<TPayload>): Unsubscribe;
  /** Subscribe to *every* event regardless of type. */
  subscribeAll(handler: EventHandler): Unsubscribe;
  /** Publish an event to all matching subscribers. */
  publish<TPayload = unknown>(type: string, payload: TPayload): Promise<void>;
}

export interface EventBusOptions {
  /** Clock injection point (testability). */
  readonly now?: () => Date;
  /**
   * Invoked when a handler throws/rejects. Defaults to swallowing the error so
   * one faulty subscriber cannot break publication for the others.
   */
  readonly onHandlerError?: (error: unknown, event: DomainEventEnvelope) => void;
}

/**
 * In-memory, synchronous-dispatch event bus. Handlers for an event are awaited
 * sequentially; a failing handler is isolated via `onHandlerError` and does not
 * prevent the remaining handlers from running.
 */
export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly wildcard = new Set<EventHandler>();
  private readonly now: () => Date;
  private readonly onHandlerError: (error: unknown, event: DomainEventEnvelope) => void;

  public constructor(options: EventBusOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
    this.onHandlerError = options.onHandlerError ?? ((): void => {});
  }

  public subscribe<TPayload = unknown>(type: string, handler: EventHandler<TPayload>): Unsubscribe {
    const set = this.handlers.get(type) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as EventHandler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  public subscribeAll(handler: EventHandler): Unsubscribe {
    this.wildcard.add(handler);
    return () => {
      this.wildcard.delete(handler);
    };
  }

  public async publish<TPayload = unknown>(type: string, payload: TPayload): Promise<void> {
    const event: DomainEventEnvelope<TPayload> = {
      type,
      payload,
      occurredAt: this.now().toISOString(),
    };
    const targeted = this.handlers.get(type);
    const recipients: EventHandler[] = [...(targeted ? [...targeted] : []), ...this.wildcard];
    for (const handler of recipients) {
      try {
        await handler(event as DomainEventEnvelope);
      } catch (error) {
        this.onHandlerError(error, event as DomainEventEnvelope);
      }
    }
  }

  /** Number of registered handlers (targeted + wildcard). Useful in tests. */
  public get handlerCount(): number {
    let total = this.wildcard.size;
    for (const set of this.handlers.values()) {
      total += set.size;
    }
    return total;
  }
}
