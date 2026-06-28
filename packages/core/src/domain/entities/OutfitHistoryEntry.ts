import { Entity } from '../../shared/Entity';
import {
  type GarmentId,
  type OutfitHistoryEntryId,
  type OutfitId,
} from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { signatureOfIds } from '../services/OutfitScoringService';
import { type Occasion } from '../value-objects/Occasion';

/**
 * How a history entry came to exist. `accepted-recommendation` is the automatic
 * record created when the user accepts an AI recommendation; `manual` is a
 * user-entered record; `repeat` is produced by re-issuing a past outfit.
 */
export type OutfitUsageSource = 'accepted-recommendation' | 'manual' | 'repeat';

/** Satisfaction is captured on a simple 1–5 scale (extensible, optional). */
export const MIN_SATISFACTION = 1;
export const MAX_SATISFACTION = 5;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface OutfitHistoryEntryProps {
  /** The garments that made up the worn outfit. */
  readonly garmentIds: readonly GarmentId[];
  /** Order-independent combination signature (feeds freshness/repetition). */
  readonly signature: string;
  /** Optional link to a persisted {@link Outfit}, when the usage came from one. */
  readonly outfitId: OutfitId | undefined;
  /** Optional human label for the outfit (e.g. the recommendation kind/name). */
  readonly label: string | undefined;
  /** ISO date the outfit was worn (YYYY-MM-DD). */
  readonly wornOn: string;
  /** Optional 24h time (HH:MM) the outfit was worn. */
  readonly time: string | undefined;
  /** Optional place/location. */
  readonly place: string | undefined;
  /** Free-text event description (e.g. "wedding", "Sunday service"). */
  readonly event: string | undefined;
  /** Optional structured occasion, when known. */
  readonly occasion: Occasion | undefined;
  /** Free-text weather description (e.g. "light rain"). */
  readonly weather: string | undefined;
  /** Optional temperature in °C. */
  readonly temperatureC: number | undefined;
  /**
   * Role performed while wearing the outfit — a deliberately FREE/extensible
   * field (e.g. "musician", "drummer", "pianist", "preacher", "guest").
   */
  readonly role: string | undefined;
  /** Optional user comments. */
  readonly comments: string | undefined;
  /** Optional satisfaction level (1–5). */
  readonly satisfaction: number | undefined;
  /** How this record was created. */
  readonly source: OutfitUsageSource;
  /** ISO timestamp the record was created. */
  readonly createdAt: string;
  /** Forward-compatible extension bag for future structured metadata. */
  readonly attributes: Readonly<Record<string, string>>;
}

export interface CreateOutfitHistoryEntryInput {
  garmentIds: readonly GarmentId[];
  wornOn: string;
  outfitId?: OutfitId;
  label?: string;
  time?: string;
  place?: string;
  event?: string;
  occasion?: Occasion;
  weather?: string;
  temperatureC?: number;
  role?: string;
  comments?: string;
  satisfaction?: number;
  source?: OutfitUsageSource;
  createdAt: string;
  attributes?: Record<string, string>;
}

/**
 * A definitive record of one outfit USAGE. Stores the outfit worn plus the rich,
 * extensible context the product requires (date, time, place, event, weather,
 * temperature, role performed, comments, satisfaction). It is a domain entity so
 * its invariants live with the model and never leak into infrastructure; the
 * combination {@link signature} reuses the same canonical definition as the
 * scoring service so freshness / recent-repetition detection needs no duplicated
 * rule.
 */
export class OutfitHistoryEntry extends Entity<'OutfitHistoryEntry'> {
  private _label: string | undefined;
  private _place: string | undefined;
  private _event: string | undefined;
  private _role: string | undefined;
  private _comments: string | undefined;
  private _satisfaction: number | undefined;
  private readonly props: OutfitHistoryEntryProps;

  private constructor(id: OutfitHistoryEntryId, props: OutfitHistoryEntryProps) {
    super(id);
    this.props = props;
    this._label = props.label;
    this._place = props.place;
    this._event = props.event;
    this._role = props.role;
    this._comments = props.comments;
    this._satisfaction = props.satisfaction;
  }

  public static create(
    id: OutfitHistoryEntryId,
    input: CreateOutfitHistoryEntryInput,
  ): Result<OutfitHistoryEntry, ValidationError> {
    const garmentIds = input.garmentIds ?? [];
    if (garmentIds.length === 0) {
      return err(new ValidationError('A history entry must reference at least one garment.'));
    }
    if (!ISO_DATE.test(input.wornOn)) {
      return err(new ValidationError('wornOn must be an ISO date (YYYY-MM-DD).'));
    }
    if (input.time !== undefined && !TIME_24H.test(input.time)) {
      return err(new ValidationError('time must be a 24h time (HH:MM).'));
    }
    if (
      input.temperatureC !== undefined &&
      (!Number.isFinite(input.temperatureC) || input.temperatureC < -90 || input.temperatureC > 60)
    ) {
      return err(new ValidationError('temperatureC must be between -90 and 60.'));
    }
    if (
      input.satisfaction !== undefined &&
      (!Number.isInteger(input.satisfaction) ||
        input.satisfaction < MIN_SATISFACTION ||
        input.satisfaction > MAX_SATISFACTION)
    ) {
      return err(
        new ValidationError(
          `satisfaction must be an integer in [${MIN_SATISFACTION}, ${MAX_SATISFACTION}].`,
        ),
      );
    }

    return ok(
      new OutfitHistoryEntry(id, {
        garmentIds: [...garmentIds],
        signature: signatureOfIds(garmentIds),
        outfitId: input.outfitId,
        label: input.label?.trim() || undefined,
        wornOn: input.wornOn,
        time: input.time,
        place: input.place?.trim() || undefined,
        event: input.event?.trim() || undefined,
        occasion: input.occasion,
        weather: input.weather?.trim() || undefined,
        temperatureC: input.temperatureC,
        role: input.role?.trim() || undefined,
        comments: input.comments?.trim() || undefined,
        satisfaction: input.satisfaction,
        source: input.source ?? 'manual',
        createdAt: input.createdAt,
        attributes: input.attributes ?? {},
      }),
    );
  }

  public get garmentIds(): readonly GarmentId[] {
    return this.props.garmentIds;
  }
  public get signature(): string {
    return this.props.signature;
  }
  public get outfitId(): OutfitId | undefined {
    return this.props.outfitId;
  }
  public get label(): string | undefined {
    return this._label;
  }
  public get wornOn(): string {
    return this.props.wornOn;
  }
  public get time(): string | undefined {
    return this.props.time;
  }
  public get place(): string | undefined {
    return this._place;
  }
  public get event(): string | undefined {
    return this._event;
  }
  public get occasion(): Occasion | undefined {
    return this.props.occasion;
  }
  public get weather(): string | undefined {
    return this.props.weather;
  }
  public get temperatureC(): number | undefined {
    return this.props.temperatureC;
  }
  public get role(): string | undefined {
    return this._role;
  }
  public get comments(): string | undefined {
    return this._comments;
  }
  public get satisfaction(): number | undefined {
    return this._satisfaction;
  }
  public get source(): OutfitUsageSource {
    return this.props.source;
  }
  public get createdAt(): string {
    return this.props.createdAt;
  }
  public get attributes(): Readonly<Record<string, string>> {
    return this.props.attributes;
  }

  /** Free-text searchable haystack (lower-cased) for the history search. */
  public get searchText(): string {
    return [
      this._label,
      this._place,
      this._event,
      this._role,
      this._comments,
      this.props.weather,
      this.props.occasion,
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' ')
      .toLowerCase();
  }

  /** Amend the user-editable annotations of a record (immutably guarded). */
  public annotate(input: {
    place?: string | null;
    event?: string | null;
    role?: string | null;
    comments?: string | null;
    label?: string | null;
    satisfaction?: number | null;
  }): Result<void, ValidationError> {
    if (input.satisfaction !== undefined && input.satisfaction !== null) {
      if (
        !Number.isInteger(input.satisfaction) ||
        input.satisfaction < MIN_SATISFACTION ||
        input.satisfaction > MAX_SATISFACTION
      ) {
        return err(
          new ValidationError(
            `satisfaction must be an integer in [${MIN_SATISFACTION}, ${MAX_SATISFACTION}].`,
          ),
        );
      }
      this._satisfaction = input.satisfaction;
    } else if (input.satisfaction === null) {
      this._satisfaction = undefined;
    }
    if (input.place !== undefined) {
      this._place = input.place === null ? undefined : input.place.trim() || undefined;
    }
    if (input.event !== undefined) {
      this._event = input.event === null ? undefined : input.event.trim() || undefined;
    }
    if (input.role !== undefined) {
      this._role = input.role === null ? undefined : input.role.trim() || undefined;
    }
    if (input.comments !== undefined) {
      this._comments = input.comments === null ? undefined : input.comments.trim() || undefined;
    }
    if (input.label !== undefined) {
      this._label = input.label === null ? undefined : input.label.trim() || undefined;
    }
    return ok(undefined);
  }
}
