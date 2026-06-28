import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MigrationError } from '../errors/InfrastructureError';
import { type ILogger } from '../logging/Logger';
import { type SqlDatabase } from './SqlDatabase';

/** A single, idempotently-tracked migration. */
export interface Migration {
  /** Stable, sortable identifier (typically the filename without extension). */
  readonly id: string;
  /** The SQL to execute. May contain multiple statements. */
  readonly sql: string;
}

const TRACKING_TABLE = '_mas_migrations';

/**
 * Applies SQL migrations against a {@link SqlDatabase} and records which ones
 * have run in a tracking table, so re-running is a no-op. Each migration is
 * applied inside its own transaction: a failure rolls that migration back and
 * aborts the run, leaving the database in a consistent state.
 *
 * The runner depends only on the SQL port, so it is exercised end-to-end in
 * the offline test suite against a real (Bun) SQLite engine.
 */
export class MigrationRunner {
  public constructor(
    private readonly db: SqlDatabase,
    private readonly logger?: ILogger,
  ) {}

  /** Ensure the tracking table exists. */
  private ensureTrackingTable(): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );`,
    );
  }

  /** The ids of migrations already applied, in application order. */
  public appliedMigrations(): readonly string[] {
    this.ensureTrackingTable();
    return this.db
      .prepare(`SELECT id FROM ${TRACKING_TABLE} ORDER BY id ASC`)
      .all<{ id: string }>()
      .map((row) => row.id);
  }

  /**
   * Apply every migration not yet recorded, in id order. Returns the ids that
   * were applied during this call.
   */
  public migrate(migrations: readonly Migration[]): readonly string[] {
    this.ensureTrackingTable();
    const done = new Set(this.appliedMigrations());
    const pending = [...migrations]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((m) => !done.has(m.id));

    const applied: string[] = [];
    for (const migration of pending) {
      try {
        this.db.transaction(() => {
          this.db.exec(migration.sql);
          this.db
            .prepare(`INSERT INTO ${TRACKING_TABLE} (id, applied_at) VALUES (?, ?)`)
            .run(migration.id, new Date().toISOString());
        });
        applied.push(migration.id);
        this.logger?.info('Applied migration', { id: migration.id });
      } catch (cause) {
        throw new MigrationError(`Migration "${migration.id}" failed.`, cause);
      }
    }
    return applied;
  }
}

/**
 * Read `*.sql` migration files from a directory, sorted by filename. The id of
 * each migration is its filename without the `.sql` extension.
 */
export const loadMigrations = async (dir: string): Promise<Migration[]> => {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.sql'));
  } catch (cause) {
    throw new MigrationError(`Failed to list migrations in "${dir}".`, cause);
  }
  files.sort((a, b) => a.localeCompare(b));
  const migrations: Migration[] = [];
  for (const file of files) {
    const sql = await readFile(join(dir, file), 'utf8');
    migrations.push({ id: file.replace(/\.sql$/, ''), sql });
  }
  return migrations;
};

/** Absolute path to the migrations directory shipped with this package. */
export const defaultMigrationsDir = (): string =>
  fileURLToPath(new URL('./migrations', import.meta.url));
