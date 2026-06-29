import { AggregateRoot } from '../../shared/Entity';
import { type UserProfileId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { type BodyMeasurements } from '../value-objects/BodyMeasurements';
import { type ColorPalette } from '../value-objects/ColorPalette';
import { type StylePreference } from '../value-objects/StylePreference';

export interface UserProfileProps {
  readonly name: string;
  readonly bodyMeasurements: BodyMeasurements | undefined;
  readonly stylePreference: StylePreference | undefined;
  readonly colorPalette: ColorPalette | undefined;
}

/**
 * Aggregate root for everything the system knows about a user's body, taste and
 * signature colours. Owns its preferences and measurements; mutations go
 * through intention-revealing methods that keep the profile consistent.
 */
export class UserProfile extends AggregateRoot<'UserProfile'> {
  private _name: string;
  private _bodyMeasurements: BodyMeasurements | undefined;
  private _stylePreference: StylePreference | undefined;
  private _colorPalette: ColorPalette | undefined;

  private constructor(id: UserProfileId, props: UserProfileProps) {
    super(id);
    this._name = props.name;
    this._bodyMeasurements = props.bodyMeasurements;
    this._stylePreference = props.stylePreference;
    this._colorPalette = props.colorPalette;
  }

  public static create(
    id: UserProfileId,
    input: {
      name: string;
      bodyMeasurements?: BodyMeasurements;
      stylePreference?: StylePreference;
      colorPalette?: ColorPalette;
    },
  ): Result<UserProfile, ValidationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Profile name must be a non-empty string.'));
    }
    return ok(
      new UserProfile(id, {
        name: input.name.trim(),
        bodyMeasurements: input.bodyMeasurements,
        stylePreference: input.stylePreference,
        colorPalette: input.colorPalette,
      }),
    );
  }

  public get name(): string {
    return this._name;
  }
  public get bodyMeasurements(): BodyMeasurements | undefined {
    return this._bodyMeasurements;
  }
  public get stylePreference(): StylePreference | undefined {
    return this._stylePreference;
  }
  public get colorPalette(): ColorPalette | undefined {
    return this._colorPalette;
  }

  public rename(name: string): Result<void, ValidationError> {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return err(new ValidationError('Profile name must be a non-empty string.'));
    }
    this._name = name.trim();
    return ok(undefined);
  }

  public updateMeasurements(measurements: BodyMeasurements): void {
    this._bodyMeasurements = measurements;
  }

  public setPreferences(preference: StylePreference): void {
    this._stylePreference = preference;
  }

  public setColorPalette(palette: ColorPalette): void {
    this._colorPalette = palette;
  }
}
