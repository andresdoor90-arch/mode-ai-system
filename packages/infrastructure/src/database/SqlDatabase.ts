/**
 * SQL database port.
 *
 * Repositories and the migration runner depend on this small, synchronous SQL
 * surface — never on a concrete driver. Two production-shaped drivers
 * (`better-sqlite3` and Bun's built-in SQLite) expose an almost identical
 * `prepare/run/get/all/exec` API, so wrapping either behind {@link SqlDatabase}
 * lets the persistence layer run unchanged across environments and makes the
 * storage engine genuinely swappable (the domain never sees any of this).
 */

/** A value that can be bound to a SQL parameter placeholder. */
export type SqlBindValue = string | number | bigint | boolean | null | Uint8Array;

/** Result of a mutating statement. */
export interface SqlRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

/** A prepared statement abstraction. */
export interface SqlStatement {
  run(...params: SqlBindValue[]): SqlRunResult;
  get<TRow = Record<string, unknown>>(...params: SqlBindValue[]): TRow | undefined;
  all<TRow = Record<string, unknown>>(...params: SqlBindValue[]): TRow[];
}

/** The database port repositories are written against. */
export interface SqlDatabase {
  /** Prepare a parameterised statement. */
  prepare(sql: string): SqlStatement;
  /** Execute one or more statements with no bound parameters (DDL, pragmas). */
  exec(sql: string): void;
  /** Run `fn` inside a transaction, rolling back if it throws. */
  transaction<T>(fn: () => T): T;
  /** Close the underlying connection. */
  close(): void;
}

/* --------------------------- raw driver shapes --------------------------- */

/**
 * The minimal shape of a raw prepared statement exposed by both
 * `better-sqlite3` and Bun's `bun:sqlite`. Declaring it structurally lets the
 * adapter classes type-check with no driver installed (the real module is only
 * imported by the connection factory, lazily).
 */
export interface RawStatementLike {
  run(...params: SqlBindValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlBindValue[]): unknown;
  all(...params: SqlBindValue[]): unknown[];
}

/** Structural shape of a `better-sqlite3` `Database` instance. */
export interface BetterSqlite3Like {
  prepare(sql: string): RawStatementLike;
  exec(sql: string): void;
  pragma(source: string): unknown;
  close(): void;
}

/** Structural shape of a `bun:sqlite` `Database` instance. */
export interface BunSqliteLike {
  query(sql: string): RawStatementLike;
  exec(sql: string): void;
  run(sql: string): unknown;
  close(): void;
}
