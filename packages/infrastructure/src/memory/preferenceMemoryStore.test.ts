import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { EMPTY_PREFERENCE_MEMORY, type PreferenceMemorySnapshot } from '@mas/core';

import { FilePreferenceMemoryStore, InMemoryPreferenceMemoryStore } from './PreferenceMemoryStore';

const sample: PreferenceMemorySnapshot = {
  version: 1,
  colorAffinity: { navy: 0.45, beige: -0.3 },
  subcategoryAffinity: { sneakers: 0.6 },
  acceptCount: 3,
  rejectCount: 1,
  updatedAt: '2026-07-02T10:00:00.000Z',
};

describe('InMemoryPreferenceMemoryStore', () => {
  it('returns null before a save and the snapshot after', async () => {
    const store = new InMemoryPreferenceMemoryStore();
    expect(await store.load()).toBeNull();
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
  });
});

describe('FilePreferenceMemoryStore', () => {
  const dirs: string[] = [];
  const makeStore = async (): Promise<FilePreferenceMemoryStore> => {
    const dir = await mkdtemp(join(tmpdir(), 'mas-mem-'));
    dirs.push(dir);
    return new FilePreferenceMemoryStore(join(dir, 'memory.json'));
  };

  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  it('returns null on first run (missing file)', async () => {
    const store = await makeStore();
    expect(await store.load()).toBeNull();
  });

  it('round-trips a snapshot through disk', async () => {
    const store = await makeStore();
    await store.save(sample);
    const loaded = await store.load();
    expect(loaded).toEqual(sample);
  });

  it('normalises a partial/empty snapshot on load', async () => {
    const store = await makeStore();
    await store.save(EMPTY_PREFERENCE_MEMORY);
    const loaded = await store.load();
    expect(loaded?.colorAffinity).toEqual({});
    expect(loaded?.acceptCount).toBe(0);
    expect(loaded?.updatedAt).toBeNull();
  });
});
