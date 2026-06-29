/**
 * AI-assisted tagging flow (Module 5).
 *
 * `SuggestGarmentTagsQuery` runs the provider-agnostic suggester and RETURNS
 * suggestions — it never mutates the garment. `ConfirmGarmentTagsCommand`
 * applies ONLY the values the user explicitly approved. This guarantees the
 * user always has the final say and nothing is auto-applied.
 */
import { type GarmentId, type CategoryId } from '../../shared/Identifier';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError } from '../../shared/errors';
import { type Color } from '../../domain/value-objects/Color';
import { type Season } from '../../domain/value-objects/Season';
import { type CategoryMetadata } from '../../domain/value-objects/CategoryMetadata';
import { type IGarmentRepository } from '../../domain/repositories/IGarmentRepository';
import { WardrobeEvents } from '../../domain/events/wardrobeEvents';
import { type Command, type Query, type RequestHandler } from '../bus/types';
import { type IDomainEventPublisher } from '../sync/ports';
import { buildGarmentSnapshot } from '../sync/snapshot';
import {
  type GarmentTagSuggestion,
  type IGarmentTagSuggester,
  type RgbSample,
} from '../tagging/ports';

/* --------------------------- SuggestGarmentTags --------------------------- */

export const SUGGEST_GARMENT_TAGS = 'garment.tags.suggest';

export class SuggestGarmentTagsQuery implements Query<GarmentTagSuggestion> {
  public readonly type = SUGGEST_GARMENT_TAGS;
  public constructor(
    public readonly garmentId: GarmentId,
    public readonly colorSamples?: readonly RgbSample[],
  ) {}
}

export class SuggestGarmentTagsHandler implements RequestHandler<
  SuggestGarmentTagsQuery,
  GarmentTagSuggestion
> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly suggester: IGarmentTagSuggester,
  ) {}

  public async handle(query: SuggestGarmentTagsQuery): Promise<Result<GarmentTagSuggestion>> {
    const garment = await this.garments.findById(query.garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${query.garmentId} not found.`) };
    }
    const suggestion = await this.suggester.suggest({
      photoKeys: garment.photos.map((p) => p.storageKey),
      ...(query.colorSamples !== undefined ? { colorSamples: query.colorSamples } : {}),
      hints: { category: garment.category, subcategory: garment.subcategory },
    });
    // NOTE: suggestion is returned to the UI for confirmation — never applied here.
    return ok(suggestion);
  }
}

/* --------------------------- ConfirmGarmentTags --------------------------- */

export const CONFIRM_GARMENT_TAGS = 'garment.tags.confirm';

/**
 * The user-approved subset of tags to apply. Only present fields are written;
 * absent fields are left untouched — i.e. the user chose not to accept them.
 */
export interface ConfirmGarmentTagsInput {
  readonly garmentId: GarmentId;
  readonly name?: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly categoryId?: CategoryId;
  readonly categoryMetadata?: CategoryMetadata;
  readonly primaryColor?: Color;
  readonly secondaryColors?: readonly Color[];
  readonly material?: string;
  readonly seasons?: readonly Season[];
  readonly tags?: readonly string[];
  /** Rich attribute metadata to merge (pattern, sleeve, style, …). */
  readonly metadataPatch?: Readonly<Record<string, string>>;
}

export class ConfirmGarmentTagsCommand implements Command<void> {
  public readonly type = CONFIRM_GARMENT_TAGS;
  public constructor(public readonly input: ConfirmGarmentTagsInput) {}
}

export class ConfirmGarmentTagsHandler implements RequestHandler<ConfirmGarmentTagsCommand, void> {
  public constructor(
    private readonly garments: IGarmentRepository,
    private readonly events?: IDomainEventPublisher,
  ) {}

  public async handle(command: ConfirmGarmentTagsCommand): Promise<Result<void>> {
    const input = command.input;
    const garment = await this.garments.findById(input.garmentId);
    if (garment === null) {
      return { ok: false, error: new NotFoundError(`Garment ${input.garmentId} not found.`) };
    }

    if (input.category !== undefined) {
      const reassigned = garment.reassignCategory({
        category: input.category,
        ...(input.subcategory !== undefined ? { subcategory: input.subcategory } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.categoryMetadata !== undefined
          ? { categoryMetadata: input.categoryMetadata }
          : {}),
      });
      if (!reassigned.ok) {
        return reassigned;
      }
    }
    if (input.name !== undefined) {
      const renamed = garment.rename(input.name);
      if (!renamed.ok) {
        return renamed;
      }
    }
    if (input.primaryColor !== undefined) {
      garment.recolor(input.primaryColor);
    }
    if (input.secondaryColors !== undefined) {
      garment.setSecondaryColors(input.secondaryColors);
    }
    if (input.material !== undefined) {
      garment.setMaterial(input.material);
    }
    if (input.seasons !== undefined) {
      const reseasoned = garment.setSeasons(input.seasons);
      if (!reseasoned.ok) {
        return reseasoned;
      }
    }
    if (input.tags !== undefined) {
      garment.retag(input.tags);
    }

    if (input.metadataPatch !== undefined) {
      garment.mergeMetadata(input.metadataPatch);
    }

    await this.garments.save(garment);
    await this.events?.publish(WardrobeEvents.GarmentUpdated, {
      garment: buildGarmentSnapshot(garment),
    });
    return ok(undefined);
  }
}
