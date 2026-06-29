import { describe, expect, it } from 'vitest';

import { CreateProfileCommand, GetCurrentProfileQuery, UpdateProfileCommand } from '@mas/core';
import { createTestSqlDatabase } from '@mas/infrastructure/__testsupport__/sqlite';

import { AppContainer } from './AppContainer';

/**
 * Verifies the first-run onboarding backend end-to-end against a real SQLite
 * engine (bun:sqlite offline / better-sqlite3 in CI): a fresh install has no
 * profile, onboarding creates one with the real name, a rename persists, and
 * the data survives an app "restart" (a new container on the same database).
 */
describe('Profile persistence (offline, bun:sqlite injected)', () => {
  it('starts with no profile, creates one, renames it and survives a restart', async () => {
    const db = await createTestSqlDatabase();
    const container = await AppContainer.create({ database: db, skipDemoSeed: true });

    // Fresh install → no profile yet (the app shows onboarding).
    const before = await container.queries.ask(new GetCurrentProfileQuery());
    expect(before.ok).toBe(true);
    expect(before.ok ? before.value : undefined).toBeNull();

    // Onboarding: create the profile with the user's real name.
    const created = await container.commands.send(new CreateProfileCommand({ name: 'Andrés' }));
    expect(created.ok).toBe(true);

    const after = await container.queries.ask(new GetCurrentProfileQuery());
    expect(after.ok ? after.value?.name : null).toBe('Andrés');

    // Rename persists.
    const renamed = await container.commands.send(new UpdateProfileCommand({ name: 'Andrea' }));
    expect(renamed.ok).toBe(true);
    const afterRename = await container.queries.ask(new GetCurrentProfileQuery());
    expect(afterRename.ok ? afterRename.value?.name : null).toBe('Andrea');

    // Simulate an app restart: a brand-new container on the SAME database.
    const reopened = await AppContainer.create({ database: db, skipDemoSeed: true });
    const current = await reopened.queries.ask(new GetCurrentProfileQuery());
    expect(current.ok ? current.value?.name : null).toBe('Andrea');

    reopened.dispose();
  });
});
