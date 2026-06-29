import { type UserProfileId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { type Result, ok } from '../../shared/Result';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { type BodyMeasurements } from '../../domain/value-objects/BodyMeasurements';
import { type ColorPalette } from '../../domain/value-objects/ColorPalette';
import { type StylePreference } from '../../domain/value-objects/StylePreference';
import { type IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { type Command, type RequestHandler } from '../bus/types';
import { UserProfile } from '../../domain/entities/UserProfile';

/* -------------------------------------------------------------------------- */
/* CreateProfile (first-run onboarding)                                       */
/* -------------------------------------------------------------------------- */

export const CREATE_PROFILE = 'profile.create';

export interface CreateProfileInput {
  readonly name: string;
}

/** Create the user's profile on first run. Returns the new profile id. */
export class CreateProfileCommand implements Command<UserProfileId> {
  public readonly type = CREATE_PROFILE;
  public constructor(public readonly input: CreateProfileInput) {}
}

export class CreateProfileHandler implements RequestHandler<CreateProfileCommand, UserProfileId> {
  public constructor(
    private readonly profiles: IUserProfileRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async handle(command: CreateProfileCommand): Promise<Result<UserProfileId>> {
    const id = this.ids.next<'UserProfile'>();
    const created = UserProfile.create(id, { name: command.input.name });
    if (!created.ok) {
      return created;
    }
    await this.profiles.save(created.value);
    return ok(id);
  }
}

const loadProfile = async (
  repo: IUserProfileRepository,
  id: UserProfileId | undefined,
): Promise<UserProfile | null> => (id !== undefined ? repo.findById(id) : repo.getCurrent());

/* -------------------------------------------------------------------------- */
/* UpdateProfile                                                              */
/* -------------------------------------------------------------------------- */

export const UPDATE_PROFILE = 'profile.update';

export interface UpdateProfileInput {
  readonly profileId?: UserProfileId;
  readonly name?: string;
  readonly bodyMeasurements?: BodyMeasurements;
}

/** Update a user's display name and/or body measurements. */
export class UpdateProfileCommand implements Command<void> {
  public readonly type = UPDATE_PROFILE;
  public constructor(public readonly input: UpdateProfileInput) {}
}

export class UpdateProfileHandler implements RequestHandler<UpdateProfileCommand, void> {
  public constructor(private readonly profiles: IUserProfileRepository) {}

  public async handle(command: UpdateProfileCommand): Promise<Result<void>> {
    const profile = await loadProfile(this.profiles, command.input.profileId);
    if (profile === null) {
      return { ok: false, error: new NotFoundError('User profile not found.') };
    }
    if (command.input.name !== undefined) {
      const renamed = profile.rename(command.input.name);
      if (!renamed.ok) {
        return renamed;
      }
    }
    if (command.input.bodyMeasurements !== undefined) {
      profile.updateMeasurements(command.input.bodyMeasurements);
    }
    await this.profiles.save(profile);
    return ok(undefined);
  }
}

/* -------------------------------------------------------------------------- */
/* SetPreferences                                                             */
/* -------------------------------------------------------------------------- */

export const SET_PREFERENCES = 'profile.set-preferences';

export interface SetPreferencesInput {
  readonly profileId?: UserProfileId;
  readonly stylePreference?: StylePreference;
  readonly colorPalette?: ColorPalette;
}

/** Set a user's style preferences and/or signature colour palette. */
export class SetPreferencesCommand implements Command<void> {
  public readonly type = SET_PREFERENCES;
  public constructor(public readonly input: SetPreferencesInput) {}
}

export class SetPreferencesHandler implements RequestHandler<SetPreferencesCommand, void> {
  public constructor(private readonly profiles: IUserProfileRepository) {}

  public async handle(command: SetPreferencesCommand): Promise<Result<void>> {
    if (command.input.stylePreference === undefined && command.input.colorPalette === undefined) {
      return {
        ok: false,
        error: new ValidationError('Nothing to set: provide preferences or a palette.'),
      };
    }
    const profile = await loadProfile(this.profiles, command.input.profileId);
    if (profile === null) {
      return { ok: false, error: new NotFoundError('User profile not found.') };
    }
    if (command.input.stylePreference !== undefined) {
      profile.setPreferences(command.input.stylePreference);
    }
    if (command.input.colorPalette !== undefined) {
      profile.setColorPalette(command.input.colorPalette);
    }
    await this.profiles.save(profile);
    return ok(undefined);
  }
}
