/**
 * Wardrobe sync coordinator (Module 6).
 *
 * Subscribes once to the wardrobe domain events and, for each, fans the change
 * out to every wired subsystem (inventory, semantic index + embeddings,
 * recommendation cache, visualisation cache, history, preference memory). This
 * is the "everything added to the inventory becomes automatically available to
 * the cognitive engine, search, history and visualisation" guarantee — and it
 * runs entirely off events, with no user intervention.
 *
 * The coordinator holds NO business rules: it only routes events to ports. A
 * faulty subsystem is isolated by the event bus's error handling, so one broken
 * subscriber never blocks the others.
 */
import {
  WardrobeEvents,
  type GarmentAddedPayload,
  type GarmentUpdatedPayload,
  type GarmentRestoredPayload,
  type GarmentArchivedPayload,
  type GarmentRemovedPayload,
  type GarmentPhotosChangedPayload,
} from '../../domain/events/wardrobeEvents';
import { type IDomainEventSubscriber, type WardrobeSyncSubsystems } from './ports';

export class WardrobeSyncCoordinator {
  private readonly unsubscribes: Array<() => void> = [];

  public constructor(
    private readonly bus: IDomainEventSubscriber,
    private readonly subsystems: WardrobeSyncSubsystems,
  ) {}

  /** Wire all subscriptions. Returns the coordinator for chaining. */
  public start(): this {
    this.on<GarmentAddedPayload>(WardrobeEvents.GarmentAdded, async (p) => {
      await this.subsystems.inventory?.applyUpserted(p.garment);
      await this.subsystems.semanticIndex?.index(p.garment);
      await this.subsystems.cache?.invalidateRecommendations();
      await this.subsystems.cache?.invalidateVisualization(p.garment.id);
      await this.subsystems.history?.record(WardrobeEvents.GarmentAdded, p);
    });

    this.on<GarmentUpdatedPayload>(WardrobeEvents.GarmentUpdated, async (p) => {
      await this.subsystems.inventory?.applyUpserted(p.garment);
      await this.subsystems.semanticIndex?.index(p.garment);
      await this.subsystems.cache?.invalidateRecommendations();
      await this.subsystems.cache?.invalidateVisualization(p.garment.id);
      await this.subsystems.history?.record(WardrobeEvents.GarmentUpdated, p);
    });

    this.on<GarmentRestoredPayload>(WardrobeEvents.GarmentRestored, async (p) => {
      await this.subsystems.inventory?.applyUpserted(p.garment);
      await this.subsystems.semanticIndex?.index(p.garment);
      await this.subsystems.cache?.invalidateRecommendations();
      await this.subsystems.history?.record(WardrobeEvents.GarmentRestored, p);
    });

    this.on<GarmentArchivedPayload>(WardrobeEvents.GarmentArchived, async (p) => {
      // Archived garments leave the active inventory and the semantic index so
      // the recommendation engine never proposes them.
      await this.subsystems.inventory?.applyRemoved(p.garmentId);
      await this.subsystems.semanticIndex?.remove(p.garmentId);
      await this.subsystems.cache?.invalidateRecommendations();
      await this.subsystems.cache?.invalidateVisualization(p.garmentId);
      await this.subsystems.history?.record(WardrobeEvents.GarmentArchived, p);
    });

    this.on<GarmentRemovedPayload>(WardrobeEvents.GarmentRemoved, async (p) => {
      await this.subsystems.inventory?.applyRemoved(p.garmentId);
      await this.subsystems.semanticIndex?.remove(p.garmentId);
      await this.subsystems.cache?.invalidateRecommendations();
      await this.subsystems.cache?.invalidateVisualization(p.garmentId);
      await this.subsystems.preferenceMemory?.onGarmentRemoved(p.garmentId);
      await this.subsystems.history?.record(WardrobeEvents.GarmentRemoved, p);
    });

    this.on<GarmentPhotosChangedPayload>(WardrobeEvents.GarmentPhotosChanged, async (p) => {
      await this.subsystems.cache?.invalidateVisualization(p.garmentId);
      await this.subsystems.history?.record(WardrobeEvents.GarmentPhotosChanged, p);
    });

    return this;
  }

  /** Tear down all subscriptions. */
  public stop(): void {
    for (const off of this.unsubscribes.splice(0)) {
      off();
    }
  }

  private on<TPayload>(type: string, handler: (payload: TPayload) => Promise<void> | void): void {
    const off = this.bus.subscribe<TPayload>(type, (event) => handler(event.payload));
    this.unsubscribes.push(off);
  }
}
