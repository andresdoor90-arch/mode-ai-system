import { type UserProfileId } from '../../shared/Identifier';
import { type UserProfile } from '../entities/UserProfile';

/**
 * Persistence contract for {@link UserProfile} aggregates.
 */
export interface IUserProfileRepository {
  save(profile: UserProfile): Promise<void>;
  findById(id: UserProfileId): Promise<UserProfile | null>;
  /** Convenience accessor for single-user desktop installs. */
  getCurrent(): Promise<UserProfile | null>;
  delete(id: UserProfileId): Promise<void>;
}
