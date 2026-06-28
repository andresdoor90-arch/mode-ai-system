import { type Category, type CategoryId, type ICategoryRepository } from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import { type CategoryRow, categoryToDomain, categoryToRow } from './mappers/categoryMapper';

const COLUMNS = 'id, name, slug, parent_id, "group", "order", seeded, metadata';
const PLACEHOLDERS = COLUMNS.split(',')
  .map(() => '?')
  .join(', ');

/**
 * SQLite-backed {@link ICategoryRepository}. The user-owned, fully dynamic
 * taxonomy is persisted here as ordinary rows (no hardcoded categories). Speaks
 * only through the {@link SqlDatabase} port and the category mapper; it holds no
 * business rules.
 */
export class SqlCategoryRepository implements ICategoryRepository {
  public constructor(private readonly db: SqlDatabase) {}

  private insert(row: CategoryRow): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO categories (${COLUMNS}) VALUES (${PLACEHOLDERS})`)
      .run(
        row.id,
        row.name,
        row.slug,
        row.parent_id,
        row.group,
        row.order,
        row.seeded,
        row.metadata,
      );
  }

  public async save(category: Category): Promise<void> {
    const row = categoryToRow(category);
    wrapSync(
      () => this.insert(row),
      (cause) => new DatabaseError(`Failed to save category ${category.id}.`, cause),
    );
  }

  public async saveMany(categories: readonly Category[]): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          for (const category of categories) {
            this.insert(categoryToRow(category));
          }
        }),
      (cause) => new DatabaseError('Failed to save categories.', cause),
    );
  }

  public async findById(id: CategoryId): Promise<Category | null> {
    const row = wrapSync(
      () => this.db.prepare(`SELECT ${COLUMNS} FROM categories WHERE id = ?`).get<CategoryRow>(id),
      (cause) => new DatabaseError(`Failed to load category ${id}.`, cause),
    );
    return row ? categoryToDomain(row) : null;
  }

  public async findBySlug(slug: string): Promise<Category | null> {
    const row = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${COLUMNS} FROM categories WHERE slug = ? ORDER BY "order" ASC LIMIT 1`)
          .get<CategoryRow>(slug),
      (cause) => new DatabaseError(`Failed to load category by slug ${slug}.`, cause),
    );
    return row ? categoryToDomain(row) : null;
  }

  public async findAll(): Promise<readonly Category[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare(`SELECT ${COLUMNS} FROM categories ORDER BY "order" ASC, name ASC`)
          .all<CategoryRow>(),
      (cause) => new DatabaseError('Failed to load categories.', cause),
    );
    return rows.map(categoryToDomain);
  }

  public async findRoots(): Promise<readonly Category[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS} FROM categories WHERE parent_id IS NULL ORDER BY "order" ASC, name ASC`,
          )
          .all<CategoryRow>(),
      (cause) => new DatabaseError('Failed to load root categories.', cause),
    );
    return rows.map(categoryToDomain);
  }

  public async findChildren(parentId: CategoryId): Promise<readonly Category[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare(
            `SELECT ${COLUMNS} FROM categories WHERE parent_id = ? ORDER BY "order" ASC, name ASC`,
          )
          .all<CategoryRow>(parentId),
      (cause) => new DatabaseError(`Failed to load children of category ${parentId}.`, cause),
    );
    return rows.map(categoryToDomain);
  }

  public async delete(id: CategoryId): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          // Explicitly cascade to direct children (FK cascade is not enabled on
          // every driver/connection, so make the behaviour deterministic).
          this.db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id);
          this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        }),
      (cause) => new DatabaseError(`Failed to delete category ${id}.`, cause),
    );
  }

  public async count(): Promise<number> {
    const row = wrapSync(
      () => this.db.prepare('SELECT COUNT(*) AS n FROM categories').get<{ n: number }>(),
      (cause) => new DatabaseError('Failed to count categories.', cause),
    );
    return Number(row?.n ?? 0);
  }
}
