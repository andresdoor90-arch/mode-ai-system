/**
 * @mas/infrastructure — Infrastructure layer public API.
 *
 * Concrete, swappable implementations of the ports declared in `@mas/core`,
 * plus the cross-cutting services the desktop app needs:
 *
 *  - `errors`        — infrastructure error hierarchy (distinct from domain errors)
 *  - `logging`       — structured logging port + console adapter
 *  - `events`        — in-memory pub/sub event bus
 *  - `config`        — typed, persisted application configuration
 *  - `storage`       — local file storage + image file management
 *  - `database`      — SQLite (better-sqlite3 / Bun) port, Drizzle schema,
 *                      migration runner and demo seeding
 *  - `repositories`  — SQLite-backed repository implementations + mappers
 *  - `vector`        — provider-agnostic vector store (ChromaDB + in-memory)
 *  - `ai`            — provider-agnostic AI text/embedding ports + base adapters
 *  - `memory`        — persistent preference-memory stores for the AI engine
 *  - `backup`        — backup & restore of database/images/config
 *  - `transfer`      — portable import/export bundles
 *  - `id`            — UUID-backed id generator
 *
 * The package contains NO business rules: all domain interaction goes through
 * the interfaces defined in `@mas/core`, and every external technology sits
 * behind a port so SQLite, ChromaDB or an AI provider can be replaced without
 * touching the domain.
 */

import { CORE_PACKAGE_NAME } from '@mas/core';

/** Package name, useful for diagnostics and logging. */
export const INFRASTRUCTURE_PACKAGE_NAME = '@mas/infrastructure' as const;

/** Semantic version of the infrastructure package. */
export const INFRASTRUCTURE_VERSION = '0.4.0' as const;

/** The core package this layer depends on (sanity check for workspace wiring). */
export const DEPENDS_ON = CORE_PACKAGE_NAME;

export * from './errors';
export * from './logging';
export * from './events';
export * from './config';
export * from './storage';
export * from './database';
export * from './repositories';
export * from './vector';
export * from './ai';
export * from './memory';
export * from './backup';
export * from './transfer';
export * from './id';
