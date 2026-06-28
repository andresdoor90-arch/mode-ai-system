/**
 * @mas/core — Domain layer entry point.
 *
 * This package holds the framework-agnostic domain model for M-A-S:
 * entities, value objects, repository interfaces, domain services and the
 * application use cases (CQRS-lite commands and queries).
 *
 * Phase 1 ships only the package scaffold; domain logic is added in Phase 2.
 */

/** Package name, useful for diagnostics and logging. */
export const CORE_PACKAGE_NAME = '@mas/core' as const;

/** Semantic version of the core package. */
export const CORE_VERSION = '0.1.0' as const;
