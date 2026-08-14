/**
 * Persistence: versioned SaveFile round-trip through (fake) IndexedDB,
 * migration chain from frozen fixtures, corrupt-data resilience.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';
import { migrate } from '../src/persist/migrations';
import { SAVE_VERSION } from '../src/persist/schema';
import { clearSave, loadSave, saveWorld } from '../src/persist/store';
import fixtureV1 from './fixtures/save-v1.json';

function runTicks(state: ReturnType<typeof createWorld>, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

beforeEach(async () => {
  await clearSave();
});

describe('save round-trip', () => {
  it('saves and loads an identical world', async () => {
    const state = createWorld(42);
    runTicks(state, 500);
    await saveWorld(state, 1_755_000_000_000);
    const save = await loadSave();
    expect(save).not.toBeNull();
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.savedAtEpochMs).toBe(1_755_000_000_000);
    expect(JSON.stringify(save?.sim)).toBe(JSON.stringify(state));
  });

  it('a loaded world resumes exactly like an unsaved one', async () => {
    const straight = createWorld(7);
    runTicks(straight, 2000);

    const first = createWorld(7);
    runTicks(first, 1000);
    await saveWorld(first, 0);
    const save = await loadSave();
    if (!save) throw new Error('save missing');
    const resumed = save.sim;
    runTicks(resumed, 1000);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(straight));
  });

  it('clearSave leaves nothing behind', async () => {
    await saveWorld(createWorld(1), 0);
    await clearSave();
    expect(await loadSave()).toBeNull();
  });
});

describe('migrations', () => {
  it('accepts the frozen v1 fixture', () => {
    const save = migrate(fixtureV1);
    expect(save).not.toBeNull();
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.sim.creatures.length).toBeGreaterThan(0);
  });

  it('rejects garbage without throwing', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(42)).toBeNull();
    expect(migrate({ version: 999, sim: {} })).toBeNull();
    expect(migrate({ hello: 'world' })).toBeNull();
  });

  it('rejects version-1-shaped objects with a malformed sim body', () => {
    const base = fixtureV1 as { version: number; savedAtEpochMs: number; sim: object };

    const missingRng = { ...base, sim: { ...base.sim, rng: undefined } };
    expect(migrate(missingRng)).toBeNull();

    const shortRng = { ...base, sim: { ...base.sim, rng: [1, 2, 3] } };
    expect(migrate(shortRng)).toBeNull();

    const nonNumericRng = { ...base, sim: { ...base.sim, rng: [1, 2, 3, 'x'] } };
    expect(migrate(nonNumericRng)).toBeNull();

    const familiesNotArray = { ...base, sim: { ...base.sim, families: {} } };
    expect(migrate(familiesNotArray)).toBeNull();
  });

  it('defaults a missing lastWandererTick to {} instead of rejecting', () => {
    const base = fixtureV1 as { version: number; savedAtEpochMs: number; sim: object };
    const sim = { ...base.sim } as Record<string, unknown>;
    delete sim.lastWandererTick;
    const save = migrate({ ...base, sim });
    expect(save).not.toBeNull();
    expect(save?.sim.lastWandererTick).toEqual({});
  });

  it('loadSave survives a corrupt stored value', async () => {
    const { set } = await import('idb-keyval');
    await set('beastoria.save', { junk: true });
    expect(await loadSave()).toBeNull();
  });
});
