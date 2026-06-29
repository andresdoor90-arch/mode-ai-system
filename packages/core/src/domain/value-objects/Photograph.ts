import { Guard } from '../../shared/Guard';
import { type PhotoId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';

/**
 * A normalised crop rectangle expressed as fractions of the source image
 * (0–1 on each axis), so it is resolution-independent. `width`/`height` of 1
 * mean "no crop".
 */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The identity crop (the whole image). */
export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

/** Allowed clockwise rotations, in degrees. */
export type RotationDegrees = 0 | 90 | 180 | 270;

/**
 * Status of the (future) automatic image-processing pipeline for this photo.
 * Phase 6.5 only wires the *architecture*; the actual algorithms are deferred.
 * Every photo starts `original` and stages can mark progress without the domain
 * knowing how any algorithm works.
 */
export type PhotoProcessingStage = 'original' | 'background-removed' | 'segmented' | 'enhanced';

export interface PhotographProps {
  readonly id: PhotoId;
  /** Opaque storage key/URI resolved by the infrastructure storage port. */
  readonly storageKey: string;
  /** Display/sort order within a garment's photo set (lower first). */
  readonly order: number;
  readonly rotation: RotationDegrees;
  readonly crop: CropRect;
  /** True when this is the garment's primary/cover photo. */
  readonly isPrimary: boolean;
  /** Latest processing stage reached (extension point, not yet computed). */
  readonly stage: PhotoProcessingStage;
  /** Free-form, forward-compatible extension bag (e.g. width/height, hash). */
  readonly attributes: Readonly<Record<string, string>>;
}

export interface CreatePhotographInput {
  id: PhotoId;
  storageKey: string;
  order?: number;
  rotation?: RotationDegrees;
  crop?: CropRect;
  isPrimary?: boolean;
  stage?: PhotoProcessingStage;
  attributes?: Record<string, string>;
}

const isValidCrop = (c: CropRect): boolean =>
  [c.x, c.y, c.width, c.height].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
  c.width > 0 &&
  c.height > 0 &&
  c.x + c.width <= 1.000001 &&
  c.y + c.height <= 1.000001;

/**
 * Immutable description of a single garment photograph plus the *non-destructive*
 * transforms applied to it (rotation, crop, ordering). Transforms are metadata:
 * the original bytes are never mutated, so edits are reversible and the future
 * processing pipeline can re-derive outputs from the original.
 */
export class Photograph {
  public readonly id: PhotoId;
  public readonly storageKey: string;
  public readonly order: number;
  public readonly rotation: RotationDegrees;
  public readonly crop: CropRect;
  public readonly isPrimary: boolean;
  public readonly stage: PhotoProcessingStage;
  public readonly attributes: Readonly<Record<string, string>>;

  private constructor(props: PhotographProps) {
    this.id = props.id;
    this.storageKey = props.storageKey;
    this.order = props.order;
    this.rotation = props.rotation;
    this.crop = props.crop;
    this.isPrimary = props.isPrimary;
    this.stage = props.stage;
    this.attributes = Object.freeze({ ...props.attributes });
  }

  public static create(input: CreatePhotographInput): Result<Photograph, ValidationError> {
    const keyCheck = Guard.nonEmptyString(input.storageKey, 'Photo storageKey');
    if (!keyCheck.ok) {
      return keyCheck;
    }
    const order = input.order ?? 0;
    if (!Number.isInteger(order) || order < 0) {
      return err(new ValidationError('Photo order must be a non-negative integer.'));
    }
    const rotation = input.rotation ?? 0;
    if (![0, 90, 180, 270].includes(rotation)) {
      return err(new ValidationError('Photo rotation must be 0, 90, 180 or 270 degrees.'));
    }
    const crop = input.crop ?? FULL_CROP;
    if (!isValidCrop(crop)) {
      return err(
        new ValidationError('Photo crop rectangle is out of bounds (expect 0–1 fractions).'),
      );
    }
    return ok(
      new Photograph({
        id: input.id,
        storageKey: input.storageKey,
        order,
        rotation,
        crop,
        isPrimary: input.isPrimary ?? false,
        stage: input.stage ?? 'original',
        attributes: input.attributes ?? {},
      }),
    );
  }

  /** Return a copy with selected fields changed (immutable update). */
  public with(
    changes: Partial<Omit<CreatePhotographInput, 'id'>>,
  ): Result<Photograph, ValidationError> {
    return Photograph.create({
      id: this.id,
      storageKey: changes.storageKey ?? this.storageKey,
      order: changes.order ?? this.order,
      rotation: changes.rotation ?? this.rotation,
      crop: changes.crop ?? this.crop,
      isPrimary: changes.isPrimary ?? this.isPrimary,
      stage: changes.stage ?? this.stage,
      attributes: changes.attributes ?? { ...this.attributes },
    });
  }

  /** Rotate clockwise by 90° (non-destructive). */
  public rotateClockwise(): Photograph {
    const next = ((this.rotation + 90) % 360) as RotationDegrees;
    // create cannot fail here (rotation is always valid), so unwrap inline.
    return new Photograph({ ...this.toJSON(), rotation: next });
  }

  public toJSON(): PhotographProps {
    return {
      id: this.id,
      storageKey: this.storageKey,
      order: this.order,
      rotation: this.rotation,
      crop: this.crop,
      isPrimary: this.isPrimary,
      stage: this.stage,
      attributes: { ...this.attributes },
    };
  }
}
