import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { DatabaseError } from '../errors/InfrastructureError';
import { BetterSqliteDatabase } from './BetterSqliteDatabase';
import { type BetterSqlite3Like, type SqlDatabase } from './SqlDatabase';

/** Tuning options applied to a freshly opened SQLite connection. */
export interface ConnectionOptions {
  /** Enable Write-Ahead Logging for better concurrent read performance. */
  readonly wal?: boolean;
  /** Enforce foreign-key constraints (off by default in SQLite). */
  readonly foreignKeys?: boolean;
  /** `synchronous` pragma value. `NORMAL` pairs well with WAL. */
  readonly synchronous?: 'OFF' | 'NORMAL' | 'FULL';
  /** Busy timeout in milliseconds. */
  readonly busyTimeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionOptions> = {
  wal: true,
  foreignKeys: true,
  synchronous: 'NORMAL',
  busyTimeoutMs: 5_000,
};

/**
 * Apply the standard pragma set to a raw better-sqlite3 handle. Exposed
 * separately so it can be reused/tested against any pragma-capable handle.
 */
export const applyPragmas = (
  db: BetterSqlite3Like,
  options: ConnectionOptions = {},
): void => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.wal) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma(`synchronous = ${opts.synchronous}`);
  db.pragma(`foreign_keys = ${opts.foreignKeys ? 'ON' : 'OFF'}`);
  db.pragma(`busy_timeout = ${opts.busyTimeoutMs}`);
};

/**
 * Open a production SQLite connection backed by `better-sqlite3`.
 *
 * The driver is imported lazily through a computed specifier so this module
 * carries no static dependency on the native package — it loads only when
 * actually opening a database (i.e. at runtime / in CI where the package is
 * installed), keeping the rest of the layer buildable offline.
 */
export const createSqliteDatabase = async (
  filename: string,
  options: ConnectionOptions = {},
): Promise<SqlDatabase> => {
  try {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true });
    }
    // Computed specifier prevents static module resolution at build time.
    const specifier = 'better-sqlite3';
    const mod = (await import(specifier)) as { default: new (path: string) => BetterSqlite3Like };
    const Driver = mod.default;
    const handle = new Driver(filename);
    applyPragmas(handle, options);
    return new BetterSqliteDatabase(handle);
  } catch (cause) {
    throw new DatabaseError(`Failed to open SQLite database at "${filename}".`, cause);
  }
};
