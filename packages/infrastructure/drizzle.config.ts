import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * Generates SQL migrations under `src/database/migrations` from the typed
 * schema in `src/database/schema.ts`. Run via `pnpm --filter @mas/infrastructure
 * db:generate`. This file (and `drizzle-kit`) is only needed in CI / dev where
 * the toolchain is installed; the runtime does not depend on it.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  strict: true,
  verbose: true,
});
