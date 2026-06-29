/**
 * Event-driven synchronisation ports (Module 6).
 *
 * When a garment is added / modified / archived / removed, the cognitive engine
 * and every dependent subsystem must update automatically — with no user
 * intervention. The application publishes domain events; subsystems react.
 *
 * These ports keep the publisher and the subsystems decoupled and keep the
 * dependency arrow pointing inward: the publisher/subscriber ports are declared
 * here in core and are *structurally compatible* with the infrastructure
 * `IEventBus`, so the existing bus satisfies them with no wrapper. Each
 * subsystem is an abstract port too, so the coordinator never knows how a cache,
 * an index or the history actually works.
 */
import { type GarmentId } from '../../shared/Identifier';
import { type GarmentSnapshot } from '../../domain/events/wardrobeEvents';

/** Publish a domain event. Satisfied by infrastructure `IEventBus`. */
export interface IDomainEventPublisher {
  publish<TPayload = unknown>(type: string, payload: TPayload): Promise<void>;
}

/** Subscribe to a domain event. Satisfied by infrastructure `IEventBus`. */
export interface IDomainEventSubscriber {
  subscribe<TPayload = unknown>(
    type: string,
    handler: (event: {
      type: string;
      payload: TPayload;
      occurredAt: string;
    }) => void | Promise<void>,
  ): () => void;
}

/** Inventory projection — keeps live counts/availability in sync. */
export interface IInventoryProjection {
  applyUpserted(snapshot: GarmentSnapshot): Promise<void> | void;
  applyRemoved(garmentId: GarmentId): Promise<void> | void;
}

/** Semantic index + embeddings — keeps the vector index in sync. */
export interface ISemanticIndexProjection {
  index(snapshot: GarmentSnapshot): Promise<void>;
  remove(garmentId: GarmentId): Promise<void>;
}

/** Cache invalidation for recommendations and the visualisation engine. */
export interface ICacheInvalidationPort {
  invalidateRecommendations(): Promise<void> | void;
  invalidateVisualization(garmentId: GarmentId): Promise<void> | void;
}

/** Append-only history of wardrobe changes. */
export interface IHistoryRecorderPort {
  record(eventName: string, payload: unknown): Promise<void> | void;
}

/** Preference-memory notifications (optional; only when applicable). */
export interface IPreferenceMemoryNotifier {
  onGarmentRemoved(garmentId: GarmentId): Promise<void> | void;
}

/**
 * The bundle of subsystems the coordinator fans events out to. Every member is
 * optional so the app can wire as many or as few as are available; the
 * coordinator simply skips the absent ones.
 */
export interface WardrobeSyncSubsystems {
  readonly inventory?: IInventoryProjection;
  readonly semanticIndex?: ISemanticIndexProjection;
  readonly cache?: ICacheInvalidationPort;
  readonly history?: IHistoryRecorderPort;
  readonly preferenceMemory?: IPreferenceMemoryNotifier;
}
