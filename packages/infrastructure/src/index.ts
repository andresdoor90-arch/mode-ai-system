/**
 * @mas/infrastructure — Infrastructure layer entry point.
 *
 * Concrete implementations of the interfaces declared in `@mas/core`:
 * SQLite repositories (Drizzle ORM), ChromaDB vector store, Sharp-based image
 * processing, local file storage and external service adapters.
 *
 * Phase 1 ships only the package scaffold; implementations land in Phase 3.
 */

import { CORE_PACKAGE_NAME } from '@mas/core';

/** Package name, useful for diagnostics and logging. */
export const INFRASTRUCTURE_PACKAGE_NAME = '@mas/infrastructure' as const;

/** Semantic version of the infrastructure package. */
export const INFRASTRUCTURE_VERSION = '0.1.0' as const;

/** The core package this layer depends on (sanity check for the workspace wiring). */
export const DEPENDS_ON = CORE_PACKAGE_NAME;
