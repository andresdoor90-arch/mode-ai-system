import { DatabaseError } from '../errors/InfrastructureError';
import {
  type BetterSqlite3Like,
  type SqlBindValue,
  type SqlDatabase,
  type SqlRunResult,
  type SqlStatement,
} from './SqlDatabase';

/**
 * {@link SqlDatabase} adapter over a `better-sqlite3` connection — the
 * production SQLite driver for the desktop app.
 *
 * The class wraps an already-constructed driver handle (dependency injection)
 * rather than importing `better-sqlite3` itself, so it type-checks and unit
 * tests without the native module installed; the actual `require` happens in
 * the connection factory.
 */
export class BetterSqliteDatabase implements SqlDatabase {
  public constructor(private readonly db: BetterSqlite3Like) {}

  public prepare(sql: string): SqlStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: SqlBindValue[]): SqlRunResult => {
        const result = stmt.run(...normalise(params));
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      },
      get: <TRow = Record<string, unknown>>(...params: SqlBindValue[]): TRow | undefined =>
        (stmt.get(...normalise(params)) as TRow | undefined) ?? undefined,
      all: <TRow = Record<string, unknown>>(...params: SqlBindValue[]): TRow[] =>
        stmt.all(...normalise(params)) as TRow[],
    };
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failures; surface the original error below.
      }
      throw error instanceof DatabaseError
        ? error
        : new DatabaseError('Transaction failed and was rolled back.', error);
    }
  }

  public close(): void {
    this.db.close();
  }
}

/**
 * `better-sqlite3` rejects `boolean` and `undefined` bind values. Coerce
 * booleans to 0/1 and leave everything else untouched.
 */
const normalise = (params: SqlBindValue[]): Array<Exclude<SqlBindValue, boolean>> =>
  params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
