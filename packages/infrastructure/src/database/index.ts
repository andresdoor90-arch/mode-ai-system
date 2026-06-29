export * from './SqlDatabase';
export * from './BetterSqliteDatabase';
export * from './BunSqliteDatabase';
export * from './connection';
export * from './MigrationRunner';
export * from './embeddedMigrations';
export * from './seed';
// NOTE: `./schema` (Drizzle table definitions) is intentionally NOT re-exported
// here. It statically imports `drizzle-orm`, which is only present in CI; the
// runtime persistence path (migrations + repositories) does not depend on it.
// Import `@mas/infrastructure/database/schema` directly where Drizzle is needed.
