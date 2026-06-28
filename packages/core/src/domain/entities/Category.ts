import { AggregateRoot } from '../../shared/Entity';
import { type CategoryId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { Guard } from '../../shared/Guard';
import {
  CategoryMetadata,
  type CategoryMetadataInput,
} from '../value-objects/CategoryMetadata';

/**
 * Derive a stable, machine-friendly slug from a human name. Slugs are used as
 * the persistent, human-readable key a {@link Garment} references, so they stay
 * valid even when the display name is edited.
 */
export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export interface CategoryProps {
  readonly name: string;
  readonly slug: string;
  /** Parent category id, or `null` for a top-level category. Enables unlimited
   * subcategories (a subcategory is simply a category whose parent is set). */
  readonly parentId: CategoryId | null;
  /** Optional free-form grouping key (e.g. "formal", "casual") for the UI. */
  readonly group: string | null;
  /** Sort index within its sibling set; lower sorts first. */
  readonly order: number;
  /** System metadata (layer slot, formality, comfort, …). */
  readonly metadata: CategoryMetadata;
  /** True for built-in seed defaults; user-created categories are false. The
   * flag is informational only — seeded categories remain fully editable. */
  readonly seeded: boolean;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: CategoryId | null;
  group?: string | null;
  order?: number;
  metadata?: CategoryMetadataInput | CategoryMetadata;
  seeded?: boolean;
}

/** Maximum length of a category name. */
export const MAX_CATEGORY_NAME = 80;

/**
 * A user-defined taxonomy node. Categories are *data*, not hardcoded enums:
 * the user can create, rename, regroup, reorder, nest (subcategories) and
 * delete them freely. Each category carries the {@link CategoryMetadata} the
 * scoring and rendering layers need, so migrating from enums to data does not
 * break any downstream service.
 */
export class Category extends AggregateRoot<'Category'> {
  private _name: string;
  private _slug: string;
  private _parentId: CategoryId | null;
  private _group: string | null;
  private _order: number;
  private _metadata: CategoryMetadata;
  private readonly _seeded: boolean;

  private constructor(id: CategoryId, props: CategoryProps) {
    super(id);
    this._name = props.name;
    this._slug = props.slug;
    this._parentId = props.parentId;
    this._group = props.group;
    this._order = props.order;
    this._metadata = props.metadata;
    this._seeded = props.seeded;
  }

  public static create(
    id: CategoryId,
    input: CreateCategoryInput,
  ): Result<Category, ValidationError> {
    const nameCheck = Guard.all(
      Guard.nonEmptyString(input.name, 'Category name'),
      Guard.maxLength(input.name ?? '', MAX_CATEGORY_NAME, 'Category name'),
    );
    if (!nameCheck.ok) {
      return nameCheck;
    }

    const name = input.name.trim();
    const slug = (input.slug ?? slugify(name)).trim();
    if (slug.length === 0) {
      return err(new ValidationError('Category slug must be a non-empty string.'));
    }

    const order = input.order ?? 0;
    if (!Number.isInteger(order) || order < 0) {
      return err(new ValidationError('Category order must be a non-negative integer.'));
    }

    let metadata: CategoryMetadata;
    if (input.metadata instanceof CategoryMetadata) {
      metadata = input.metadata;
    } else {
      const built = CategoryMetadata.create(input.metadata ?? {});
      if (!built.ok) {
        return built;
      }
      metadata = built.value;
    }

    return ok(
      new Category(id, {
        name,
        slug,
        parentId: input.parentId ?? null,
        group: input.group ?? null,
        order,
        metadata,
        seeded: input.seeded ?? false,
      }),
    );
  }

  public get name(): string {
    return this._name;
  }
  public get slug(): string {
    return this._slug;
  }
  public get parentId(): CategoryId | null {
    return this._parentId;
  }
  public get group(): string | null {
    return this._group;
  }
  public get order(): number {
    return this._order;
  }
  public get metadata(): CategoryMetadata {
    return this._metadata;
  }
  public get seeded(): boolean {
    return this._seeded;
  }
  /** A subcategory is any category that has a parent. */
  public get isSubcategory(): boolean {
    return this._parentId !== null;
  }

  public rename(name: string): Result<void, ValidationError> {
    const check = Guard.all(
      Guard.nonEmptyString(name, 'Category name'),
      Guard.maxLength(name ?? '', MAX_CATEGORY_NAME, 'Category name'),
    );
    if (!check.ok) {
      return check;
    }
    this._name = name.trim();
    return ok(undefined);
  }

  /** Move this category under a new parent (or to the top level with `null`). */
  public moveTo(parentId: CategoryId | null): Result<void, ValidationError> {
    if (parentId !== null && (parentId as string) === this.id) {
      return err(new ValidationError('A category cannot be its own parent.'));
    }
    this._parentId = parentId;
    return ok(undefined);
  }

  /** Assign or clear the grouping key. */
  public regroup(group: string | null): void {
    this._group = group === null ? null : group.trim() || null;
  }

  public reorder(order: number): Result<void, ValidationError> {
    if (!Number.isInteger(order) || order < 0) {
      return err(new ValidationError('Category order must be a non-negative integer.'));
    }
    this._order = order;
    return ok(undefined);
  }

  public updateMetadata(input: CategoryMetadataInput): Result<void, ValidationError> {
    const next = this._metadata.with(input);
    if (!next.ok) {
      return next;
    }
    this._metadata = next.value;
    return ok(undefined);
  }
}
