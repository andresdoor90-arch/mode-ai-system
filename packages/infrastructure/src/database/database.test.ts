import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestSqlDatabase } from '../__testsupport__/sqlite';
import { MigrationError } from '../errors/InfrastructureError';
import { type Migration, MigrationRunner } from './MigrationRunner';
import { type SqlDatabase } from './SqlDatabase';

const migrations: Migration[] = [
  { id: '0001_a', sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY, v TEXT);' },
  { id: '0002_b', sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY);' },
];

describe('SqlDatabase adapter + MigrationRunner', () => {
  let db: SqlDatabase;
  beforeEach(async () => {
    db = await createTestSqlDatabase();
  });
  afterEach(() => {
    db.close();
  });

  it('applies pending migrations and records them', () => {
    const runner = new MigrationRunner(db);
    const applied = runner.migrate(migrations);
    expect(applied).toEqual(['0001_a', '0002_b']);
    expect(runner.appliedMigrations()).toEqual(['0001_a', '0002_b']);
  });

  it('is idempotent — re-running applies nothing', () => {
    const runner = new MigrationRunner(db);
    runner.migrate(migrations);
    const second = runner.migrate(migrations);
    expect(second).toEqual([]);
  });

  it('applies only newly-added migrations', () => {
    const runner = new MigrationRunner(db);
    runner.migrate([migrations[0] as Migration]);
    const applied = runner.migrate(migrations);
    expect(applied).toEqual(['0002_b']);
  });

  it('prepares, runs and reads rows through the port', () => {
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);');
    const insert = db.prepare('INSERT INTO t (id, name) VALUES (?, ?)');
    const r1 = insert.run(1, 'alice');
    expect(Number(r1.changes)).toBe(1);
    insert.run(2, 'bob');

    const all = db.prepare('SELECT * FROM t ORDER BY id').all<{ id: number; name: string }>();
    expect(all).toHaveLength(2);
    expect(all[0]?.name).toBe('alice');

    const one = db.prepare('SELECT name FROM t WHERE id = ?').get<{ name: string }>(2);
    expect(one?.name).toBe('bob');
  });

  it('rolls back a failing transaction', () => {
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY);');
    expect(() =>
      db.transaction(() => {
        db.prepare('INSERT INTO t (id) VALUES (?)').run(1);
        throw new Error('abort');
      }),
    ).toThrow();
    const count = db.prepare('SELECT COUNT(*) AS n FROM t').get<{ n: number }>();
    expect(Number(count?.n)).toBe(0);
  });

  it('wraps a broken migration in a MigrationError', () => {
    const runner = new MigrationRunner(db);
    expect(() => runner.migrate([{ id: '0001_bad', sql: 'CREATE TABLE (' }])).toThrow(
      MigrationError,
    );
  });
});
