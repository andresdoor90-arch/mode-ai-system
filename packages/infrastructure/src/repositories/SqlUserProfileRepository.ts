import {
  type IUserProfileRepository,
  type UserProfile,
  type UserProfileId,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type UserProfileRow,
  userProfileToDomain,
  userProfileToRow,
} from './mappers/userProfileMapper';

/**
 * SQLite-backed {@link IUserProfileRepository}. Tracks a single "current"
 * profile via an `is_current` flag for the single-user desktop scenario: the
 * first profile saved becomes current and stays so until explicitly changed.
 */
export class SqlUserProfileRepository implements IUserProfileRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(profile: UserProfile): Promise<void> {
    wrapSync(
      () =>
        this.db.transaction(() => {
          const currentId =
            this.db
              .prepare('SELECT id FROM user_profiles WHERE is_current = 1 LIMIT 1')
              .get<{ id: string }>()?.id ?? null;
          const isCurrent = currentId === null || currentId === profile.id;
          const row = userProfileToRow(profile, isCurrent);
          this.db
            .prepare(
              'INSERT OR REPLACE INTO user_profiles (id, name, body_measurements, style_preference, color_palette, is_current) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .run(
              row.id,
              row.name,
              row.body_measurements,
              row.style_preference,
              row.color_palette,
              row.is_current,
            );
        }),
      (cause) => new DatabaseError(`Failed to save profile ${profile.id}.`, cause),
    );
  }

  public async findById(id: UserProfileId): Promise<UserProfile | null> {
    const row = wrapSync(
      () => this.db.prepare('SELECT * FROM user_profiles WHERE id = ?').get<UserProfileRow>(id),
      (cause) => new DatabaseError(`Failed to load profile ${id}.`, cause),
    );
    return row ? userProfileToDomain(row) : null;
  }

  public async getCurrent(): Promise<UserProfile | null> {
    const row = wrapSync(
      () =>
        this.db
          .prepare('SELECT * FROM user_profiles WHERE is_current = 1 LIMIT 1')
          .get<UserProfileRow>(),
      (cause) => new DatabaseError('Failed to load current profile.', cause),
    );
    return row ? userProfileToDomain(row) : null;
  }

  public async delete(id: UserProfileId): Promise<void> {
    wrapSync(
      () => this.db.prepare('DELETE FROM user_profiles WHERE id = ?').run(id),
      (cause) => new DatabaseError(`Failed to delete profile ${id}.`, cause),
    );
  }
}
