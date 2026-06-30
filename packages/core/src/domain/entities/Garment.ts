import { Entity } from '../../shared/Entity';
import { type CategoryId, type GarmentId, type PhotoId } from '../../shared/Identifier';
import { type Result, ok, err, unwrapOr } from '../../shared/Result';
import { ValidationError, InvariantViolationError, NotFoundError } from '../../shared/errors';
import { type Color } from '../value-objects/Color';
import { type CategoryMetadata } from '../value-objects/CategoryMetadata';
import { categoryLayerSlot, LayerSlot } from '../value-objects/GarmentCategory';
import { isSubcategoryOf } from '../value-objects/GarmentSubcategory';
import { Photograph } from '../value-objects/Photograph';
import { Season } from '../value-objects/Season';
import { type Size } from '../value-objects/Size';
import { garmentFormality } from '../services/formality';
import { defaultComfort, isDefaultHeavyOuterwear } from '../taxonomy/defaultTaxonomy';

/**
 * Lifecycle status of a garment. The recommendation engine must never propose a
 * garment that is damaged, in the laundry or archived.
 */
export enum GarmentStatus {
  Available = 'available',
  InLaundry = 'in-laundry',
  Damaged = 'damaged',
  Archived = 'archived',
}

export interface GarmentProps {
  readonly name: string;
  /** Dynamic category reference (slug/value). No longer a fixed enum. */
  readonly category: string;
  readonly subcategory: string;
  /** Stable id of the user-defined {@link Category} this garment belongs to. */
  readonly categoryId: CategoryId | undefined;
  /** Denormalised category metadata (formality/slot/comfort) so the pure
   * scoring/rendering services need no repository. When absent, defaults are
   * resolved from the seed taxonomy by category/subcategory. */
  readonly categoryMetadata: CategoryMetadata | undefined;
  readonly color: Color;
  readonly secondaryColors: readonly Color[];
  readonly brand: string | undefined;
  readonly size: Size | undefined;
  readonly material: string | undefined;
  readonly seasons: readonly Season[];
  /** Legacy flat image keys (kept for backwards compatibility). */
  readonly images: readonly string[];
  /** Rich photo set with non-destructive transform metadata. */
  readonly photos: readonly Photograph[];
  readonly tags: readonly string[];
  readonly status: GarmentStatus;
  /** Number of times the garment has been worn — feeds freshness scoring. */
  readonly wearCount: number;
  /** ISO date (YYYY-MM-DD) the garment was last worn, if ever. */
  readonly lastWornAt: string | undefined;
  /** ISO date (YYYY-MM-DD) the garment was purchased, if known. */
  readonly purchaseDate: string | undefined;
  readonly notes: string | undefined;
  /** Forward-compatible extension bag for future structured metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

export interface CreateGarmentInput {
  name: string;
  category: string;
  subcategory: string;
  categoryId?: CategoryId;
  categoryMetadata?: CategoryMetadata;
  color: Color;
  secondaryColors?: Color[];
  seasons: Season[];
  brand?: string;
  size?: Size;
  material?: string;
  images?: string[];
  photos?: Photograph[];
  tags?: string[];
  status?: GarmentStatus;
  wearCount?: number;
  lastWornAt?: string;
  purchaseDate?: string;
  notes?: string;
  metadata?: Record<string, string>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Known {@link LayerSlot} values, for validating a persisted metadata string. */
const LAYER_SLOT_VALUES: ReadonlySet<string> = new Set(Object.values(LayerSlot));
const isLayerSlot = (value: string): value is LayerSlot => LAYER_SLOT_VALUES.has(value);

/**
 * A single wearable item. Entity (identity = a stable, persistent id). Mutating
 * operations return a `Result` and protect the garment's invariants.
 *
 * Phase 6.5: the category is now a reference to user-defined {@link Category}
 * data rather than a fixed enum. A garment may carry denormalised
 * {@link CategoryMetadata}; when it does, the formality/layer-slot/comfort the
 * scoring and rendering layers read come from that metadata. When it does not
 * (legacy or quick-add path), they fall back to the seed taxonomy keyed by
 * category/subcategory — preserving every prior behaviour.
 */
export class Garment extends Entity<'Garment'> {
  private _name: string;
  private _category: string;
  private _subcategory: string;
  private _categoryId: CategoryId | undefined;
  private _categoryMetadata: CategoryMetadata | undefined;
  private _color: Color;
  private _secondaryColors: Color[];
  private _brand: string | undefined;
  private _size: Size | undefined;
  private _material: string | undefined;
  private _seasons: Season[];
  private _images: string[];
  private _photos: Photograph[];
  private _tags: string[];
  private _status: GarmentStatus;
  private _wearCount: number;
  private _lastWornAt: string | undefined;
  private _purchaseDate: string | undefined;
  private _notes: string | undefined;
  private _metadata: Record<string, string>;

  private constructor(id: GarmentId, props: GarmentProps) {
    super(id);
    this._name = props.name;
    this._category = props.category;
    this._subcategory = props.subcategory;
    this._categoryId = props.categoryId;
    this._categoryMetadata = props.categoryMetadata;
    this._color = props.color;
    this._secondaryColors = [...props.secondaryColors];
    this._brand = props.brand;
    this._size = props.size;
    this._material = props.material;
    this._seasons = [...props.seasons];
    this._images = [...props.images];
    this._photos = [...props.photos];
    this._tags = [...props.tags];
    this._status = props.status;
    this._wearCount = props.wearCount;
    this._lastWornAt = props.lastWornAt;
    this._purchaseDate = props.purchaseDate;
    this._notes = props.notes;
    this._metadata = { ...props.metadata };
  }

  public static create(id: GarmentId, input: CreateGarmentInput): Result<Garment, ValidationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Garment name must be a non-empty string.'));
    }
    if (typeof input.category !== 'string' || input.category.trim().length === 0) {
      return err(new ValidationError('Garment category must be a non-empty string.'));
    }
    // Backwards-compatible default-taxonomy validation: only enforced when the
    // garment is NOT carrying explicit dynamic-category metadata. For
    // user-defined categories the application layer validates against the
    // category repository instead, keeping the domain free of a fixed taxonomy.
    if (input.categoryMetadata === undefined && input.categoryId === undefined) {
      if (!isSubcategoryOf(input.category, input.subcategory)) {
        return err(
          new ValidationError(
            `"${input.subcategory}" is not a valid subcategory of ${input.category}.`,
          ),
        );
      }
    }
    const seasons = input.seasons ?? [];
    if (seasons.length === 0) {
      return err(new ValidationError('A garment must declare at least one season.'));
    }
    const wearCount = input.wearCount ?? 0;
    if (!Number.isInteger(wearCount) || wearCount < 0) {
      return err(new ValidationError('wearCount must be a non-negative integer.'));
    }
    if (input.purchaseDate !== undefined && !ISO_DATE.test(input.purchaseDate)) {
      return err(new ValidationError('purchaseDate must be an ISO date (YYYY-MM-DD).'));
    }

    return ok(
      new Garment(id, {
        name: input.name.trim(),
        category: input.category,
        subcategory: input.subcategory,
        categoryId: input.categoryId,
        categoryMetadata: input.categoryMetadata,
        color: input.color,
        secondaryColors: input.secondaryColors ?? [],
        brand: input.brand,
        size: input.size,
        material: input.material,
        seasons: [...new Set(seasons)],
        images: input.images ?? [],
        photos: Garment.normalisePhotos(input.photos ?? []),
        tags: (input.tags ?? []).map((t) => t.toLowerCase()),
        status: input.status ?? GarmentStatus.Available,
        wearCount,
        lastWornAt: input.lastWornAt,
        purchaseDate: input.purchaseDate,
        notes: input.notes,
        metadata: input.metadata ?? {},
      }),
    );
  }

  /* ------------------------------ accessors ------------------------------ */

  public get name(): string {
    return this._name;
  }
  public get category(): string {
    return this._category;
  }
  public get subcategory(): string {
    return this._subcategory;
  }
  public get categoryId(): CategoryId | undefined {
    return this._categoryId;
  }
  public get categoryMetadata(): CategoryMetadata | undefined {
    return this._categoryMetadata;
  }
  public get color(): Color {
    return this._color;
  }
  public get secondaryColors(): readonly Color[] {
    return this._secondaryColors;
  }
  public get brand(): string | undefined {
    return this._brand;
  }
  public get size(): Size | undefined {
    return this._size;
  }
  public get material(): string | undefined {
    return this._material;
  }
  public get seasons(): readonly Season[] {
    return this._seasons;
  }
  public get images(): readonly string[] {
    return this._images;
  }
  public get photos(): readonly Photograph[] {
    return this._photos;
  }
  public get tags(): readonly string[] {
    return this._tags;
  }
  public get status(): GarmentStatus {
    return this._status;
  }
  public get wearCount(): number {
    return this._wearCount;
  }
  /** Usage frequency — alias of {@link wearCount} for metadata clarity. */
  public get usageFrequency(): number {
    return this._wearCount;
  }
  public get lastWornAt(): string | undefined {
    return this._lastWornAt;
  }
  public get purchaseDate(): string | undefined {
    return this._purchaseDate;
  }
  public get notes(): string | undefined {
    return this._notes;
  }
  public get metadata(): Readonly<Record<string, string>> {
    return this._metadata;
  }

  /* -------- system metadata (from category, with seed fallback) ---------- */

  /** Formality (0–10): from category metadata, else the seed taxonomy. */
  public get formality(): number {
    return this._categoryMetadata?.formality ?? garmentFormality(this._subcategory);
  }
  /** Body layer slot: from category metadata, then the photo-flow metadata bag,
   * then the seed taxonomy. The metadata bag holds the structural zone the user
   * assigned to their OWN category, so user-defined categories resolve to the
   * right slot (not the seed fallback) for recommendations and the try-on. */
  public get layerSlot(): LayerSlot {
    if (this._categoryMetadata?.layerSlot !== undefined) {
      return this._categoryMetadata.layerSlot;
    }
    const fromMetadata = this._metadata['layerSlot'];
    if (fromMetadata !== undefined && isLayerSlot(fromMetadata)) {
      return fromMetadata;
    }
    return categoryLayerSlot(this._category);
  }
  /** Comfort/mobility (0–1): from category metadata, else the seed taxonomy. */
  public get comfort(): number {
    return this._categoryMetadata?.comfort ?? defaultComfort(this._subcategory);
  }
  /** Whether this garment is heavy cold-weather outerwear. */
  public get isHeavyOuterwear(): boolean {
    return this._categoryMetadata?.heavyOuterwear ?? isDefaultHeavyOuterwear(this._subcategory);
  }

  /** Whether the garment is eligible to appear in recommendations. */
  public get isWearable(): boolean {
    return this._status === GarmentStatus.Available;
  }

  /** Whether the garment has been archived (soft-deleted). */
  public get isArchived(): boolean {
    return this._status === GarmentStatus.Archived;
  }

  /** Does this garment cover the given season? */
  public supportsSeason(season: Season): boolean {
    return (
      this._seasons.includes(Season.AllSeason) ||
      season === Season.AllSeason ||
      this._seasons.includes(season)
    );
  }

  /* ------------------------------ mutations ------------------------------ */

  public rename(name: string): Result<void, ValidationError> {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return err(new ValidationError('Garment name must be a non-empty string.'));
    }
    this._name = name.trim();
    return ok(undefined);
  }

  public recolor(color: Color): void {
    this._color = color;
  }

  public setSecondaryColors(colors: readonly Color[]): void {
    this._secondaryColors = [...colors];
  }

  public retag(tags: readonly string[]): void {
    this._tags = [...new Set(tags.map((t) => t.toLowerCase()))];
  }

  public setNotes(notes: string | undefined): void {
    this._notes = notes;
  }

  public setMaterial(material: string | undefined): void {
    this._material = material;
  }

  /** Replace the garment's seasons (must declare at least one). */
  public setSeasons(seasons: readonly Season[]): Result<void, ValidationError> {
    if (seasons.length === 0) {
      return err(new ValidationError('A garment must declare at least one season.'));
    }
    this._seasons = [...new Set(seasons)];
    return ok(undefined);
  }

  public setBrand(brand: string | undefined): void {
    this._brand = brand;
  }

  /** Reassign the garment to a different (user-defined) category + metadata. */
  public reassignCategory(input: {
    category: string;
    subcategory?: string;
    categoryId?: CategoryId;
    categoryMetadata?: CategoryMetadata;
  }): Result<void, ValidationError> {
    if (typeof input.category !== 'string' || input.category.trim().length === 0) {
      return err(new ValidationError('Garment category must be a non-empty string.'));
    }
    this._category = input.category;
    if (input.subcategory !== undefined) {
      this._subcategory = input.subcategory;
    }
    this._categoryId = input.categoryId ?? this._categoryId;
    this._categoryMetadata = input.categoryMetadata ?? this._categoryMetadata;
    return ok(undefined);
  }

  /** Replace arbitrary extension metadata keys (merge semantics). */
  public mergeMetadata(patch: Readonly<Record<string, string>>): void {
    this._metadata = { ...this._metadata, ...patch };
  }

  public changeStatus(status: GarmentStatus): Result<void, InvariantViolationError> {
    if (!Object.values(GarmentStatus).includes(status)) {
      return err(new InvariantViolationError(`"${status}" is not a valid garment status.`));
    }
    this._status = status;
    return ok(undefined);
  }

  /** Soft-delete: archive the garment (recoverable via {@link restore}). */
  public archive(): Result<void, InvariantViolationError> {
    return this.changeStatus(GarmentStatus.Archived);
  }

  /** Restore an archived garment back to Available. */
  public restore(): Result<void, InvariantViolationError> {
    if (this._status !== GarmentStatus.Archived) {
      return err(new InvariantViolationError('Only an archived garment can be restored.'));
    }
    this._status = GarmentStatus.Available;
    return ok(undefined);
  }

  /** Record that the garment was worn on the given ISO date. */
  public markWorn(isoDate: string): Result<void, ValidationError> {
    if (!ISO_DATE.test(isoDate)) {
      return err(new ValidationError('markWorn expects an ISO date (YYYY-MM-DD).'));
    }
    this._wearCount += 1;
    this._lastWornAt = isoDate;
    return ok(undefined);
  }

  /* ------------------------------- photos -------------------------------- */

  public addPhoto(photo: Photograph): Result<void, ValidationError> {
    if (this._photos.some((p) => p.id === photo.id)) {
      return err(new ValidationError(`Photo ${photo.id} already exists on this garment.`));
    }
    this._photos = Garment.normalisePhotos([...this._photos, photo]);
    return ok(undefined);
  }

  public removePhoto(photoId: PhotoId): Result<void, NotFoundError> {
    if (!this._photos.some((p) => p.id === photoId)) {
      return err(new NotFoundError(`Photo ${photoId} not found on this garment.`));
    }
    this._photos = Garment.normalisePhotos(this._photos.filter((p) => p.id !== photoId));
    return ok(undefined);
  }

  public replacePhoto(photo: Photograph): Result<void, NotFoundError> {
    if (!this._photos.some((p) => p.id === photo.id)) {
      return err(new NotFoundError(`Photo ${photo.id} not found on this garment.`));
    }
    this._photos = Garment.normalisePhotos(
      this._photos.map((p) => (p.id === photo.id ? photo : p)),
    );
    return ok(undefined);
  }

  /** Reorder photos to match the given id order; unknown ids are ignored. */
  public reorderPhotos(orderedIds: readonly PhotoId[]): Result<void, ValidationError> {
    const byId = new Map(this._photos.map((p) => [p.id, p]));
    const reordered: Photograph[] = [];
    let idx = 0;
    for (const id of orderedIds) {
      const photo = byId.get(id);
      if (photo !== undefined) {
        reordered.push(unwrapOr(photo.with({ order: idx }), photo));
        byId.delete(id);
        idx += 1;
      }
    }
    // Append any photos not referenced in the order list, preserving sequence.
    for (const photo of this._photos) {
      if (byId.has(photo.id)) {
        reordered.push(unwrapOr(photo.with({ order: idx }), photo));
        idx += 1;
      }
    }
    this._photos = Garment.normalisePhotos(reordered);
    return ok(undefined);
  }

  /** Mark a photo as the primary/cover image. */
  public setPrimaryPhoto(photoId: PhotoId): Result<void, NotFoundError> {
    if (!this._photos.some((p) => p.id === photoId)) {
      return err(new NotFoundError(`Photo ${photoId} not found on this garment.`));
    }
    this._photos = this._photos.map((p) => unwrapOr(p.with({ isPrimary: p.id === photoId }), p));
    return ok(undefined);
  }

  /** The cover photo: the one flagged primary, else the lowest-ordered. */
  public get primaryPhoto(): Photograph | undefined {
    return this._photos.find((p) => p.isPrimary) ?? this._photos[0];
  }

  /**
   * Normalise a photo set: sort by `order`, renumber sequentially and ensure
   * exactly one primary (defaulting to the first photo when none is flagged).
   */
  private static normalisePhotos(photos: readonly Photograph[]): Photograph[] {
    const sorted = [...photos].sort((a, b) => a.order - b.order);
    const hasPrimary = sorted.some((p) => p.isPrimary);
    return sorted.map((p, i) => {
      const isPrimary = hasPrimary ? p.isPrimary : i === 0;
      return unwrapOr(p.with({ order: i, isPrimary }), p);
    });
  }

  /**
   * Produce a {@link CreateGarmentInput} snapshot for duplication. The caller
   * assigns a fresh id; the copy starts with reset usage and no photos by
   * default (photos may be re-attached by the use case if desired).
   */
  public toSnapshot(): CreateGarmentInput {
    return {
      name: this._name,
      category: this._category,
      subcategory: this._subcategory,
      ...(this._categoryId !== undefined ? { categoryId: this._categoryId } : {}),
      ...(this._categoryMetadata !== undefined ? { categoryMetadata: this._categoryMetadata } : {}),
      color: this._color,
      secondaryColors: [...this._secondaryColors],
      seasons: [...this._seasons],
      ...(this._brand !== undefined ? { brand: this._brand } : {}),
      ...(this._size !== undefined ? { size: this._size } : {}),
      ...(this._material !== undefined ? { material: this._material } : {}),
      images: [...this._images],
      tags: [...this._tags],
      ...(this._purchaseDate !== undefined ? { purchaseDate: this._purchaseDate } : {}),
      ...(this._notes !== undefined ? { notes: this._notes } : {}),
      metadata: { ...this._metadata },
    };
  }
}
