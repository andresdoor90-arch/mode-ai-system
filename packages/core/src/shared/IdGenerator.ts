import { type Id, toId } from './Identifier';

/**
 * Abstraction for generating unique identifiers.
 *
 * The domain never reaches for `crypto`, `uuid` or any runtime-specific API
 * directly — id generation is a *port*. The application layer is handed an
 * implementation; tests can inject a deterministic generator.
 */
export interface IdGenerator {
  next<TBrand extends string>(): Id<TBrand>;
}

/**
 * Deterministic, dependency-free id generator suitable for tests and for the
 * pure in-memory wiring shipped with the domain package. It does **not** rely
 * on any external library or platform global, keeping the domain fully
 * portable. Infrastructure may provide a UUID-backed implementation later.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  public constructor(private readonly prefix = 'id') {}

  public next<TBrand extends string>(): Id<TBrand> {
    this.counter += 1;
    return toId<TBrand>(`${this.prefix}-${this.counter.toString().padStart(8, '0')}`);
  }
}
