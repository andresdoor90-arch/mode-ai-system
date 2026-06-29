import { DomainError } from './errors';

/**
 * A lightweight `Result` type used across the domain and application layers.
 *
 * The domain never throws for *expected* failures (validation, broken
 * invariants, not-found): it returns a `Result` so callers are forced to deal
 * with both branches. Unexpected programming errors may still throw.
 */
export type Result<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Build a successful result. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Build a failed result. */
export const err = <E extends DomainError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/** Type guard narrowing a result to its success branch. */
export const isOk = <T, E extends DomainError>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } => result.ok;

/** Type guard narrowing a result to its failure branch. */
export const isErr = <T, E extends DomainError>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } => !result.ok;

/**
 * Unwrap a result, throwing the contained error if it failed. Intended for
 * tests and trusted call-sites where a failure is genuinely exceptional.
 */
export const unwrap = <T, E extends DomainError>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};

/**
 * Unwrap a result's value, returning the given fallback when it failed.
 * Use at call-sites that can safely degrade to a default instead of failing.
 */
export const unwrapOr = <T, E extends DomainError>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

/**
 * Combine many results into a single result containing the array of values.
 * Fails fast on the first error encountered.
 */
export const combine = <T, E extends DomainError>(
  results: ReadonlyArray<Result<T, E>>,
): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
};
