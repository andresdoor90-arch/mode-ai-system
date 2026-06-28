import { randomUUID } from 'node:crypto';

import { type Id, type IdGenerator, toId } from '@mas/core';

/**
 * Concrete {@link IdGenerator} backed by `crypto.randomUUID()`.
 *
 * The domain declares id generation as a port and never reaches for `crypto`
 * itself; this infrastructure adapter supplies a real, collision-resistant
 * implementation for production use.
 */
export class UuidIdGenerator implements IdGenerator {
  public next<TBrand extends string>(): Id<TBrand> {
    return toId<TBrand>(randomUUID());
  }
}
