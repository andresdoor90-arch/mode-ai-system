/**
 * Category read models (Module 1). Flat list and a nested tree grouped for the
 * management UI.
 */
import { type CategoryId } from '../../shared/Identifier';
import { type Result, ok } from '../../shared/Result';
import { type Category } from '../../domain/entities/Category';
import { type ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { type Query, type RequestHandler } from '../bus/types';

/** A category plus its direct children (subcategories). */
export interface CategoryNode {
  readonly category: Category;
  readonly children: readonly Category[];
}

/** Build a parent → children tree from a flat list, sorted by order. */
export const buildCategoryTree = (categories: readonly Category[]): readonly CategoryNode[] => {
  const byParent = new Map<CategoryId | null, Category[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const sort = (list: Category[]): Category[] =>
    [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return sort(byParent.get(null) ?? []).map((root) => ({
    category: root,
    children: sort(byParent.get(root.id) ?? []),
  }));
};

export const GET_CATEGORIES = 'category.list';

export class GetCategoriesQuery implements Query<readonly Category[]> {
  public readonly type = GET_CATEGORIES;
}

export class GetCategoriesHandler
  implements RequestHandler<GetCategoriesQuery, readonly Category[]>
{
  public constructor(private readonly categories: ICategoryRepository) {}

  public async handle(): Promise<Result<readonly Category[]>> {
    return ok(await this.categories.findAll());
  }
}

export const GET_CATEGORY_TREE = 'category.tree';

export class GetCategoryTreeQuery implements Query<readonly CategoryNode[]> {
  public readonly type = GET_CATEGORY_TREE;
}

export class GetCategoryTreeHandler
  implements RequestHandler<GetCategoryTreeQuery, readonly CategoryNode[]>
{
  public constructor(private readonly categories: ICategoryRepository) {}

  public async handle(): Promise<Result<readonly CategoryNode[]>> {
    const all = await this.categories.findAll();
    return ok(buildCategoryTree(all));
  }
}
