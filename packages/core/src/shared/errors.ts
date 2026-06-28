/**
 * Domain error hierarchy.
 *
 * These errors are framework-agnostic: they carry a stable machine-readable
 * `code` so the application/infrastructure layers can map them to transport
 * specific representations (HTTP status, IPC error payloads, etc.) without the
 * domain knowing anything about those transports.
 */

/** Base class for every error originating from the domain layer. */
export class DomainError extends Error {
  /** Stable, machine-readable error code. */
  public readonly code: string;

  public constructor(message: string, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    // Maintains a proper prototype chain when targeting ES2022 down-levelled output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when input fails validation while constructing a value object/entity. */
export class ValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** Raised when an aggregate invariant would be violated by an operation. */
export class InvariantViolationError extends DomainError {
  public constructor(message: string) {
    super(message, 'INVARIANT_VIOLATION');
    this.name = 'InvariantViolationError';
  }
}

/** Raised when a referenced entity cannot be located. */
export class NotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** Raised when no handler is registered for a command/query on the bus. */
export class HandlerNotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, 'HANDLER_NOT_FOUND');
    this.name = 'HandlerNotFoundError';
  }
}
