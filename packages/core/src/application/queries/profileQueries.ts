import { type UserProfile } from '../../domain/entities/UserProfile';
import { type IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { type Result, ok } from '../../shared/Result';
import { type Query, type RequestHandler } from '../bus/types';

/* -------------------------------------------------------------------------- */
/* GetCurrentProfile                                                          */
/* -------------------------------------------------------------------------- */

export const GET_CURRENT_PROFILE = 'profile.get-current';

/**
 * Read the single current user profile for this install, or `null` when none
 * exists yet (i.e. the first-run onboarding has not completed).
 */
export class GetCurrentProfileQuery implements Query<UserProfile | null> {
  public readonly type = GET_CURRENT_PROFILE;
}

export class GetCurrentProfileHandler implements RequestHandler<
  GetCurrentProfileQuery,
  UserProfile | null
> {
  public constructor(private readonly profiles: IUserProfileRepository) {}

  public async handle(): Promise<Result<UserProfile | null>> {
    return ok(await this.profiles.getCurrent());
  }
}
