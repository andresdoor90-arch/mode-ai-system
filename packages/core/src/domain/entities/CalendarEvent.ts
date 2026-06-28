import { Entity } from '../../shared/Entity';
import { type CalendarEventId, type OutfitId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { type Occasion } from '../value-objects/Occasion';

/** Dress code attached to an event, ordered from least to most formal. */
export enum DressCode {
  Casual = 'casual',
  SmartCasual = 'smart-casual',
  BusinessCasual = 'business-casual',
  Business = 'business',
  CocktailAttire = 'cocktail',
  BlackTie = 'black-tie',
}

export interface CalendarEventProps {
  readonly title: string;
  readonly date: string;
  readonly occasion: Occasion;
  readonly dressCode: DressCode | undefined;
  readonly suggestedOutfitIds: readonly OutfitId[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar event that an outfit can be planned around. Validates its date and
 * keeps an ordered list of suggested outfits.
 */
export class CalendarEvent extends Entity<'CalendarEvent'> {
  private _title: string;
  private _date: string;
  private _occasion: Occasion;
  private _dressCode: DressCode | undefined;
  private _suggestedOutfitIds: OutfitId[];

  private constructor(id: CalendarEventId, props: CalendarEventProps) {
    super(id);
    this._title = props.title;
    this._date = props.date;
    this._occasion = props.occasion;
    this._dressCode = props.dressCode;
    this._suggestedOutfitIds = [...props.suggestedOutfitIds];
  }

  public static create(
    id: CalendarEventId,
    input: {
      title: string;
      date: string;
      occasion: Occasion;
      dressCode?: DressCode;
      suggestedOutfitIds?: OutfitId[];
    },
  ): Result<CalendarEvent, ValidationError> {
    if (typeof input.title !== 'string' || input.title.trim().length === 0) {
      return err(new ValidationError('Event title must be a non-empty string.'));
    }
    if (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) {
      return err(new ValidationError('Event date must be a valid ISO date (YYYY-MM-DD).'));
    }
    return ok(
      new CalendarEvent(id, {
        title: input.title.trim(),
        date: input.date,
        occasion: input.occasion,
        dressCode: input.dressCode,
        suggestedOutfitIds: [...new Set(input.suggestedOutfitIds ?? [])],
      }),
    );
  }

  public get title(): string {
    return this._title;
  }
  public get date(): string {
    return this._date;
  }
  public get occasion(): Occasion {
    return this._occasion;
  }
  public get dressCode(): DressCode | undefined {
    return this._dressCode;
  }
  public get suggestedOutfitIds(): readonly OutfitId[] {
    return this._suggestedOutfitIds;
  }

  public suggestOutfit(outfitId: OutfitId): void {
    if (!this._suggestedOutfitIds.includes(outfitId)) {
      this._suggestedOutfitIds = [...this._suggestedOutfitIds, outfitId];
    }
  }

  public clearSuggestions(): void {
    this._suggestedOutfitIds = [];
  }
}
