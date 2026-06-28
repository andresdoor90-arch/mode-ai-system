import { ValidationError } from './errors';
import { type Result, ok, err } from './Result';

/**
 * Small collection of reusable validation helpers. Each guard returns a
 * `Result<void, ValidationError>` so they compose cleanly inside value-object
 * and entity factories without throwing.
 */
export const Guard = {
  /** Fails when the value is `null` or `undefined`. */
  defined(value: unknown, field: string): Result<void, ValidationError> {
    if (value === null || value === undefined) {
      return err(new ValidationError(`${field} is required.`));
    }
    return ok(undefined);
  },

  /** Fails when a string is missing, empty or only whitespace. */
  nonEmptyString(value: unknown, field: string): Result<void, ValidationError> {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return err(new ValidationError(`${field} must be a non-empty string.`));
    }
    return ok(undefined);
  },

  /** Fails when a string exceeds `max` characters. */
  maxLength(value: string, max: number, field: string): Result<void, ValidationError> {
    if (value.length > max) {
      return err(new ValidationError(`${field} must be at most ${max} characters.`));
    }
    return ok(undefined);
  },

  /** Fails when a number is outside the inclusive `[min, max]` range. */
  inRange(
    value: number,
    min: number,
    max: number,
    field: string,
  ): Result<void, ValidationError> {
    if (!Number.isFinite(value) || value < min || value > max) {
      return err(new ValidationError(`${field} must be between ${min} and ${max}.`));
    }
    return ok(undefined);
  },

  /** Fails when a number is not a positive, finite value (> 0). */
  positive(value: number, field: string): Result<void, ValidationError> {
    if (!Number.isFinite(value) || value <= 0) {
      return err(new ValidationError(`${field} must be a positive number.`));
    }
    return ok(undefined);
  },

  /** Fails when `value` is not a member of the provided enum-like object. */
  isEnumMember<T extends Record<string, string>>(
    value: unknown,
    enumObject: T,
    field: string,
  ): Result<void, ValidationError> {
    if (!Object.values(enumObject).includes(value as string)) {
      return err(new ValidationError(`${field} is not a valid ${field} value.`));
    }
    return ok(undefined);
  },

  /** Run several guards, returning the first failure or success. */
  all(...guards: ReadonlyArray<Result<void, ValidationError>>): Result<void, ValidationError> {
    for (const guard of guards) {
      if (!guard.ok) {
        return guard;
      }
    }
    return ok(undefined);
  },
} as const;
