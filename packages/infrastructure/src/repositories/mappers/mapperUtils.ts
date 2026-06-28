import { type DomainError, type Result } from '@mas/core';

import { MappingError } from '../../errors/InfrastructureError';

/**
 * Unwrap a domain {@link Result}, converting an unexpected failure into a
 * {@link MappingError}. A failure here means stored data could not be turned
 * back into a valid domain object — i.e. the row is corrupt — which is an
 * infrastructure-level problem, not a domain one.
 */
export const mustOk = <T>(result: Result<T, DomainError>, context: string): T => {
  if (result.ok) {
    return result.value;
  }
  throw new MappingError(`${context}: ${result.error.message}`, result.error);
};

/** Parse a JSON column into a typed value, raising a MappingError on failure. */
export const parseJson = <T>(raw: string | null | undefined, fallback: T, context: string): T => {
  if (raw === null || raw === undefined || raw === '') {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (cause) {
    throw new MappingError(`${context}: invalid JSON column.`, cause);
  }
};

/** Serialise a value to a JSON string for storage. */
export const toJson = (value: unknown): string => JSON.stringify(value);

/** Convert a SQLite integer/boolean column to a real boolean. */
export const toBool = (value: unknown): boolean => value === 1 || value === true || value === '1';

/** Normalise an optional string column to `string | undefined` (never null). */
export const orUndefined = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined ? undefined : value;
