/**
 * Wardrobe domain events.
 *
 * These are the canonical, transport-agnostic event names and payload shapes
 * published whenever the wardrobe changes. The application layer publishes them
 * through the infrastructure {@link IEventBus}; subscribers (the cognitive
 * engine sync, the semantic index, the history, …) react WITHOUT the publisher
 * knowing who is listening. This is the backbone of Module 6 (automatic,
 * event-driven synchronisation with no user intervention).
 *
 * Payloads are plain, serialisable data (ids + a light snapshot) so they cross
 * the IPC/process boundary cleanly and never leak entity instances.
 */
import { type CategoryId, type GarmentId } from '../../shared/Identifier';

/** Dotted event names. Stable strings — subscribers key off these. */
export const WardrobeEvents = {
  GarmentAdded: 'garment.added',
  GarmentUpdated: 'garment.updated',
  GarmentArchived: 'garment.archived',
  GarmentRestored: 'garment.restored',
  GarmentRemoved: 'garment.removed',
  GarmentPhotosChanged: 'garment.photos-changed',
  CategoryCreated: 'category.created',
  CategoryUpdated: 'category.updated',
  CategoryReordered: 'category.reordered',
  CategoryRemoved: 'category.removed',
} as const;

export type WardrobeEventName = (typeof WardrobeEvents)[keyof typeof WardrobeEvents];

/** A light, serialisable snapshot of a garment carried on change events. */
export interface GarmentSnapshot {
  readonly id: GarmentId;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly categoryId: CategoryId | undefined;
  readonly status: string;
  readonly tags: readonly string[];
  /** Text used by the semantic index / embeddings (name + attributes). */
  readonly searchText: string;
}

export interface GarmentAddedPayload {
  readonly garment: GarmentSnapshot;
}
export interface GarmentUpdatedPayload {
  readonly garment: GarmentSnapshot;
}
export interface GarmentArchivedPayload {
  readonly garmentId: GarmentId;
}
export interface GarmentRestoredPayload {
  readonly garment: GarmentSnapshot;
}
export interface GarmentRemovedPayload {
  readonly garmentId: GarmentId;
}
export interface GarmentPhotosChangedPayload {
  readonly garmentId: GarmentId;
  readonly photoCount: number;
}
export interface CategoryChangedPayload {
  readonly categoryId: CategoryId;
}
export interface CategoryReorderedPayload {
  readonly orderedIds: readonly CategoryId[];
}
