import { type Id } from './Identifier';

/**
 * Base class for entities — objects compared *by identity* (their id) rather
 * than by their attribute values.
 */
export abstract class Entity<TBrand extends string> {
  public readonly id: Id<TBrand>;

  protected constructor(id: Id<TBrand>) {
    this.id = id;
  }

  /** Identity equality: same concrete type and same id. */
  public equals(other?: Entity<TBrand> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (other.constructor !== this.constructor) {
      return false;
    }
    return this.id === other.id;
  }
}

/**
 * Marker base class for aggregate roots. An aggregate root is the only member
 * of an aggregate that outside code may hold a reference to; it is responsible
 * for protecting the invariants of everything inside its consistency boundary.
 */
export abstract class AggregateRoot<TBrand extends string> extends Entity<TBrand> {}
