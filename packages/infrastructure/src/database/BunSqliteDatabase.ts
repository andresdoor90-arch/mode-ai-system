import { DatabaseError } from '../errors/InfrastructureError';
import {
  type BunSqliteLike,
  type SqlBindValue,
  type SqlDatabase,
  type SqlRunResult,
  type SqlStatement,
} from './SqlDatabase';

/**
 * {@link SqlDatabase} adapter over Bun's built-in `bun:sqlite` connection.
 *
 * This adapter exists so the persistence layer can be exercised with a real,
 * zero-dependency SQLite engine in environments where the native
 * `better-sqlite3` module is unavailable (e.g. an offline sandbox). Like the
 * better-sqlite3 adapter it wraps an injected handle, so it carries no static
 * dependency on `bun:sqlite` and type-checks anywhere.
 */
export class BunSqliteDatabase implements SqlDatabase {
  public constructor(private readonly db: BunSqliteLike) {}

  public prepare(sql: string): SqlStatement {
    const stmt = this.db.query(sql);
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

/** Bun binds booleans fine, but normalise to integers for cross-driver parity. */
const normalise = (params: SqlBindValue[]): Array<Exclude<SqlBindValue, boolean>> =>
  params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
