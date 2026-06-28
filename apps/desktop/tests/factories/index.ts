/**
 * Test fixtures & factories scaffold.
 *
 * Factories produce deterministic test data so specs stay readable and
 * resilient to schema growth. Each factory accepts a partial override object
 * merged over sensible defaults. Domain-specific factories (garments, outfits,
 * profiles) are added alongside the entities they cover in later phases.
 */

/** A generic factory builds an object of type `T` from optional overrides. */
export type Factory<T> = (overrides?: Partial<T>) => T;

/**
 * Helper to declare a factory from a default-producing function.
 *
 * @example
 * const buildUser = defineFactory<User>(() => ({ id: '1', name: 'Test' }));
 * const user = buildUser({ name: 'Ada' });
 */
export function defineFactory<T>(makeDefaults: () => T): Factory<T> {
  return (overrides?: Partial<T>): T => ({ ...makeDefaults(), ...overrides });
}
