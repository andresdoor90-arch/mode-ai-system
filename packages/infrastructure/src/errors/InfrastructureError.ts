/**
 * Infrastructure error hierarchy.
 *
 * These errors are *distinct* from the domain's `DomainError` family: the
 * domain expresses expected, business-level failures (validation, broken
 * invariants, not-found) and never knows about databases, files or networks.
 * The infrastructure layer, by contrast, deals with the messy outside world —
 * disk I/O, SQLite, vector stores, AI providers — and wraps the low-level
 * failures it encounters in this hierarchy so callers get a stable,
 * machine-readable `code` plus the original `cause` for diagnostics.
 *
 * Nothing here imports the domain: the two error families are deliberately
 * decoupled so the dependency only ever points domain ← infrastructure.
 */

/** Base class for every error originating from the infrastructure layer. */
export class InfrastructureError extends Error {
  /** Stable, machine-readable error code. */
  public readonly code: string;

  /** The underlying error (if any) that triggered this one. */
  public override readonly cause?: unknown;

  public constructor(message: string, code = 'INFRASTRUCTURE_ERROR', cause?: unknown) {
    super(message);
    this.name = 'InfrastructureError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
    // Preserve the prototype chain when down-levelling to ES2022.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when a database operation (connection, query, migration) fails. */
export class DatabaseError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseError';
  }
}

/** Raised when a database migration cannot be applied. */
export class MigrationError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'MIGRATION_ERROR', cause);
    this.name = 'MigrationError';
  }
}

/**
 * Raised when a persistence row cannot be mapped back into a valid domain
 * object — i.e. the stored data is corrupt or violates a domain invariant.
 */
export class MappingError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'MAPPING_ERROR', cause);
    this.name = 'MappingError';
  }
}

/** Raised when a file-system / local storage operation fails. */
export class StorageError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'STORAGE_ERROR', cause);
    this.name = 'StorageError';
  }
}

/** Raised when reading or writing the persistent configuration fails. */
export class ConfigurationError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'CONFIGURATION_ERROR', cause);
    this.name = 'ConfigurationError';
  }
}

/** Raised when the vector store (ChromaDB / in-memory) fails. */
export class VectorStoreError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'VECTOR_STORE_ERROR', cause);
    this.name = 'VectorStoreError';
  }
}

/** Raised when an external AI provider call fails or is misconfigured. */
export class AIProviderError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'AI_PROVIDER_ERROR', cause);
    this.name = 'AIProviderError';
  }
}

/** Raised when a backup or restore operation fails. */
export class BackupError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'BACKUP_ERROR', cause);
    this.name = 'BackupError';
  }
}

/** Raised when importing or exporting a portable data bundle fails. */
export class TransferError extends InfrastructureError {
  public constructor(message: string, cause?: unknown) {
    super(message, 'TRANSFER_ERROR', cause);
    this.name = 'TransferError';
  }
}

/**
 * Run a synchronous side-effecting operation, wrapping any thrown error in the
 * provided infrastructure error type. Keeps low-level `try/catch` noise out of
 * the call-sites and guarantees a typed, coded error surface.
 */
export const wrapSync = <T>(
  operation: () => T,
  wrap: (cause: unknown) => InfrastructureError,
): T => {
  try {
    return operation();
  } catch (cause) {
    if (cause instanceof InfrastructureError) {
      throw cause;
    }
    throw wrap(cause);
  }
};

/** Async counterpart of {@link wrapSync}. */
export const wrapAsync = async <T>(
  operation: () => Promise<T>,
  wrap: (cause: unknown) => InfrastructureError,
): Promise<T> => {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof InfrastructureError) {
      throw cause;
    }
    throw wrap(cause);
  }
};
