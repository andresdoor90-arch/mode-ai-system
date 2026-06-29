/**
 * Category use cases (Module 1 — fully dynamic taxonomy).
 *
 * Create, rename, regroup, move (nest), reorder, delete categories and seed the
 * default taxonomy. No category is hardcoded anywhere: these commands operate on
 * {@link Category} data owned by the {@link ICategoryRepository}. Each mutation
 * publishes a domain event so dependent subsystems can react (Module 6).
 */
import { type CategoryId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import { Category, type CreateCategoryInput } from '../../domain/entities/Category';
import { type ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import {
  type CategoryMetadataInput,
} from '../../domain/value-objects/CategoryMetadata';
import { WardrobeEvents } from '../../domain/events/wardrobeEvents';
import { buildDefaultTaxonomy } from '../../domain/taxonomy/defaultTaxonomy';
import { type Command, type RequestHandler } from '../bus/types';
import { type IDomainEventPublisher } from '../sync/ports';

/* ------------------------------ CreateCategory ---------------------------- */

export const CREATE_CATEGORY = 'category.create';

export class CreateCategoryCommand implements Command<CategoryId> {
  public readonly type = CREATE_CATEGORY;
  public constructor(public readonly input: Omit<CreateCategoryInput, 'seeded'>) {}
}

export class CreateCategoryHandler
  implements RequestHandler<CreateCategoryCommand, CategoryId>
{
  public constructor(
    private readonly categories: ICategoryRepository,
    private readonly ids: IdGenerator,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: CreateCategoryCommand): Promise<Result<CategoryId>> {
    const id = this.ids.next<'Category'>();
    const created = Category.create(id, { ...command.input, seeded: false });
    if (!created.ok) {
      return created;
    }
    await this.categories.save(created.value);
    await this.events?.publish(WardrobeEvents.CategoryCreated, { categoryId: id });
    return ok(id);
  }
}

/* ------------------------------ UpdateCategory ---------------------------- */

export const UPDATE_CATEGORY = 'category.update';

export interface UpdateCategoryInput {
  readonly id: CategoryId;
  readonly name?: string;
  readonly group?: string | null;
  readonly parentId?: CategoryId | null;
  readonly metadata?: CategoryMetadataInput;
}

export class UpdateCategoryCommand implements Command<void> {
  public readonly type = UPDATE_CATEGORY;
  public constructor(public readonly input: UpdateCategoryInput) {}
}

export class UpdateCategoryHandler implements RequestHandler<UpdateCategoryCommand, void> {
  public constructor(
    private readonly categories: ICategoryRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: UpdateCategoryCommand): Promise<Result<void>> {
    const { id, name, group, parentId, metadata } = command.input;
    const category = await this.categories.findById(id);
    if (category === null) {
      return { ok: false, error: new NotFoundError(`Category ${id} not found.`) };
    }
    if (name !== undefined) {
      const renamed = category.rename(name);
      if (!renamed.ok) {
        return renamed;
      }
    }
    if (group !== undefined) {
      category.regroup(group);
    }
    if (parentId !== undefined) {
      const moved = category.moveTo(parentId);
      if (!moved.ok) {
        return moved;
      }
    }
    if (metadata !== undefined) {
      const updated = category.updateMetadata(metadata);
      if (!updated.ok) {
        return updated;
      }
    }
    await this.categories.save(category);
    await this.events?.publish(WardrobeEvents.CategoryUpdated, { categoryId: id });
    return ok(undefined);
  }
}

/* ----------------------------- ReorderCategories -------------------------- */

export const REORDER_CATEGORIES = 'category.reorder';

export class ReorderCategoriesCommand implements Command<void> {
  public readonly type = REORDER_CATEGORIES;
  /** Category ids in their new sibling order. */
  public constructor(public readonly orderedIds: readonly CategoryId[]) {}
}

export class ReorderCategoriesHandler
  implements RequestHandler<ReorderCategoriesCommand, void>
{
  public constructor(
    private readonly categories: ICategoryRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: ReorderCategoriesCommand): Promise<Result<void>> {
    const updated: Category[] = [];
    for (let i = 0; i < command.orderedIds.length; i += 1) {
      const id = command.orderedIds[i]!;
      const category = await this.categories.findById(id);
      if (category === null) {
        return { ok: false, error: new NotFoundError(`Category ${id} not found.`) };
      }
      const reordered = category.reorder(i);
      if (!reordered.ok) {
        return reordered;
      }
      updated.push(category);
    }
    await this.categories.saveMany(updated);
    await this.events?.publish(WardrobeEvents.CategoryReordered, {
      orderedIds: command.orderedIds,
    });
    return ok(undefined);
  }
}

/* ------------------------------ DeleteCategory ---------------------------- */

export const DELETE_CATEGORY = 'category.delete';

export class DeleteCategoryCommand implements Command<void> {
  public readonly type = DELETE_CATEGORY;
  public constructor(public readonly id: CategoryId) {}
}

export class DeleteCategoryHandler implements RequestHandler<DeleteCategoryCommand, void> {
  public constructor(
    private readonly categories: ICategoryRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: DeleteCategoryCommand): Promise<Result<void>> {
    const existing = await this.categories.findById(command.id);
    if (existing === null) {
      return { ok: false, error: new NotFoundError(`Category ${command.id} not found.`) };
    }
    // Cascade: delete direct subcategories too.
    const children = await this.categories.findChildren(command.id);
    for (const child of children) {
      await this.categories.delete(child.id);
    }
    await this.categories.delete(command.id);
    await this.events?.publish(WardrobeEvents.CategoryRemoved, { categoryId: command.id });
    return ok(undefined);
  }
}

/* --------------------------- SeedDefaultTaxonomy -------------------------- */

export const SEED_DEFAULT_TAXONOMY = 'category.seed-default';

/**
 * One-time migration/seed: if the taxonomy is empty, populate it with the
 * default (previously built-in) categories as ordinary, user-editable data.
 * Idempotent — does nothing when categories already exist.
 */
export class SeedDefaultTaxonomyCommand implements Command<number> {
  public readonly type = SEED_DEFAULT_TAXONOMY;
}

export class SeedDefaultTaxonomyHandler
  implements RequestHandler<SeedDefaultTaxonomyCommand, number>
{
  public constructor(
    private readonly categories: ICategoryRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async handle(): Promise<Result<number>> {
    const existing = await this.categories.count();
    if (existing > 0) {
      return ok(0);
    }
    const seeded = buildDefaultTaxonomy(this.ids);
    await this.categories.saveMany(seeded);
    return ok(seeded.length);
  }
}
