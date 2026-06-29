/**
 * Test-only SQLite factory.
 *
 * Returns a {@link SqlDatabase} backed by the best available driver:
 *   - `better-sqlite3` — the production driver, used in CI where it is installed;
 *   - `bun:sqlite`     — Bun's built-in engine, used in the offline sandbox.
 *
 * Driver modules are loaded via computed specifiers so neither is statically
 * resolved at build time. This directory is excluded from the package build and
 * type-check (see tsconfig `exclude`); it exists solely so the canonical,
 * Vitest-style tests can exercise the real persistence layer in either
 * environment without code changes.
 */
import { BetterSqliteDatabase } from '../database/BetterSqliteDatabase';
import { BunSqliteDatabase } from '../database/BunSqliteDatabase';
import { type SqlDatabase } from '../database/SqlDatabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtor = new (path: string) => any;

export const createTestSqlDatabase = async (filename = ':memory:'): Promise<SqlDatabase> => {
  // Prefer the production driver (present in CI).
  try {
    const spec = 'better-sqlite3';
    const mod = (await import(spec)) as { default: AnyCtor };
    return new BetterSqliteDatabase(new mod.default(filename));
  } catch {
    // Not installed (offline sandbox) — fall through to Bun's engine.
  }

  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
  if (isBun) {
    const spec = 'bun:sqlite';
    const mod = (await import(spec)) as { Database: AnyCtor };
    return new BunSqliteDatabase(new mod.Database(filename));
  }

  throw new Error('No SQLite driver available for tests (need better-sqlite3 or Bun).');
};
