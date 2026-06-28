import { Guard } from '../../shared/Guard';
import { type Result, ok } from '../../shared/Result';
import { type ValidationError } from '../../shared/errors';
import { LayerSlot } from './GarmentCategory';

/**
 * The system-facing metadata a {@link Category} carries.
 *
 * Phase 6.5 makes categories *data* (a user-editable {@link Category} aggregate)
 * rather than hardcoded enums. But the rest of M-A-S still needs structured
 * facts about a category to keep working:
 *
 *  - `layerSlot`     — which body slot the category occupies (rendering +
 *                      outfit-composition validity + visual-balance scoring).
 *  - `formality`     — default formality (0–10) for garments in this category,
 *                      consumed by the compatibility / occasion / scoring
 *                      services (previously a hardcoded map keyed by subcategory).
 *  - `comfort`       — default comfort/mobility rating (0–1) for scoring.
 *  - `heavyOuterwear`— marks heavy cold-weather outerwear for the
 *                      "no heavy coat when it is hot" smart rule.
 *  - `attributes`    — free-form, forward-compatible extension bag so new
 *                      metadata can be added later WITHOUT a schema/code change.
 *
 * Because this is plain, structural metadata attached to user-owned data, the
 * domain no longer hardcodes any taxonomy: the defaults are merely *seed* values
 * (see `defaultTaxonomy`) the user can edit, reorder or delete.
 */
export interface CategoryMetadataProps {
  readonly layerSlot: LayerSlot;
  readonly formality: number;
  readonly comfort: number;
  readonly heavyOuterwear: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface CategoryMetadataInput {
  layerSlot?: LayerSlot;
  formality?: number;
  comfort?: number;
  heavyOuterwear?: boolean;
  attributes?: Record<string, string>;
}

/** Sensible neutral defaults so partially-specified metadata stays valid. */
export const DEFAULT_CATEGORY_METADATA: CategoryMetadataProps = {
  layerSlot: LayerSlot.Accessory,
  formality: 5,
  comfort: 0.8,
  heavyOuterwear: false,
  attributes: {},
};

/**
 * Immutable value object describing the system metadata of a category. Compared
 * by value; constructed through a validating factory so invariants (formality
 * in 0–10, comfort in 0–1, a real layer slot) always hold.
 */
export class CategoryMetadata {
  public readonly layerSlot: LayerSlot;
  public readonly formality: number;
  public readonly comfort: number;
  public readonly heavyOuterwear: boolean;
  public readonly attributes: Readonly<Record<string, string>>;

  private constructor(props: CategoryMetadataProps) {
    this.layerSlot = props.layerSlot;
    this.formality = props.formality;
    this.comfort = props.comfort;
    this.heavyOuterwear = props.heavyOuterwear;
    this.attributes = Object.freeze({ ...props.attributes });
  }

  public static create(
    input: CategoryMetadataInput = {},
  ): Result<CategoryMetadata, ValidationError> {
    const layerSlot = input.layerSlot ?? DEFAULT_CATEGORY_METADATA.layerSlot;
    const formality = input.formality ?? DEFAULT_CATEGORY_METADATA.formality;
    const comfort = input.comfort ?? DEFAULT_CATEGORY_METADATA.comfort;

    const checks = Guard.all(
      Guard.isEnumMember(layerSlot, LayerSlot, 'layerSlot'),
      Guard.inRange(formality, 0, 10, 'formality'),
      Guard.inRange(comfort, 0, 1, 'comfort'),
    );
    if (!checks.ok) {
      return checks;
    }

    return ok(
      new CategoryMetadata({
        layerSlot,
        formality,
        comfort,
        heavyOuterwear: input.heavyOuterwear ?? DEFAULT_CATEGORY_METADATA.heavyOuterwear,
        attributes: input.attributes ?? {},
      }),
    );
  }

  /** Plain, serialisable snapshot (for persistence / DTO mapping). */
  public toJSON(): CategoryMetadataProps {
    return {
      layerSlot: this.layerSlot,
      formality: this.formality,
      comfort: this.comfort,
      heavyOuterwear: this.heavyOuterwear,
      attributes: { ...this.attributes },
    };
  }

  /** Return a copy with selected fields overridden (immutably). */
  public with(input: CategoryMetadataInput): Result<CategoryMetadata, ValidationError> {
    return CategoryMetadata.create({
      layerSlot: input.layerSlot ?? this.layerSlot,
      formality: input.formality ?? this.formality,
      comfort: input.comfort ?? this.comfort,
      heavyOuterwear: input.heavyOuterwear ?? this.heavyOuterwear,
      attributes: input.attributes ?? { ...this.attributes },
    });
  }
}
