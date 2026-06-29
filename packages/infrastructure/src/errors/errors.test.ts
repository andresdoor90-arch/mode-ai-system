import { describe, expect, it } from 'vitest';

import {
  AIProviderError,
  BackupError,
  ConfigurationError,
  DatabaseError,
  InfrastructureError,
  MappingError,
  MigrationError,
  StorageError,
  TransferError,
  VectorStoreError,
  wrapAsync,
  wrapSync,
} from './InfrastructureError';

describe('InfrastructureError hierarchy', () => {
  it('carries a stable code and preserves the cause', () => {
    const cause = new Error('disk full');
    const error = new StorageError('write failed', cause);
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe('STORAGE_ERROR');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('StorageError');
  });

  it('assigns a distinct code per subtype', () => {
    const cases: Array<[InfrastructureError, string]> = [
      [new DatabaseError('x'), 'DATABASE_ERROR'],
      [new MigrationError('x'), 'MIGRATION_ERROR'],
      [new MappingError('x'), 'MAPPING_ERROR'],
      [new ConfigurationError('x'), 'CONFIGURATION_ERROR'],
      [new VectorStoreError('x'), 'VECTOR_STORE_ERROR'],
      [new AIProviderError('x'), 'AI_PROVIDER_ERROR'],
      [new BackupError('x'), 'BACKUP_ERROR'],
      [new TransferError('x'), 'TRANSFER_ERROR'],
    ];
    for (const [error, code] of cases) {
      expect(error.code).toBe(code);
      expect(error).toBeInstanceOf(InfrastructureError);
    }
  });

  it('is distinct from the JS Error name but still an Error', () => {
    const error = new DatabaseError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
  });
});

describe('wrapSync / wrapAsync', () => {
  it('returns the value when the operation succeeds', () => {
    expect(
      wrapSync(
        () => 42,
        () => new StorageError('nope'),
      ),
    ).toBe(42);
  });

  it('wraps a thrown error in the requested type', () => {
    expect(() =>
      wrapSync(
        () => {
          throw new Error('low-level');
        },
        (cause) => new StorageError('high-level', cause),
      ),
    ).toThrow(StorageError);
  });

  it('does not double-wrap an existing InfrastructureError', () => {
    const original = new DatabaseError('original');
    try {
      wrapSync(
        () => {
          throw original;
        },
        () => new StorageError('wrapper'),
      );
    } catch (caught) {
      expect(caught).toBe(original);
    }
  });

  it('wraps async rejections', async () => {
    await expect(
      wrapAsync(
        async () => {
          throw new Error('async boom');
        },
        (cause) => new TransferError('wrapped', cause),
      ),
    ).rejects.toBeInstanceOf(TransferError);
  });
});
