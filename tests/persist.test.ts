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
import { clearSave, loadSave, resumeSaves, saveWorld, suppressSaves } from '../src/persist/store';
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
    // toEqual (value equality) rather than a raw JSON string compare: an
    // object field reset to `undefined` (e.g. Activity.targetPos when a
    // creature has no target) is a real, present key on a live object, but
    // JSON.stringify silently drops undefined-valued keys — so a save/load
    // round trip can leave a semantically-identical object with a different
    // *key insertion order* than one that was never serialized. toEqual
    // treats `{x: undefined}` and `{}` as equal and ignores key order,
    // matching what "resumes exactly like an unsaved one" actually means;
    // JSON.stringify equality was an accidentally-over-strict proxy for it
    // (same landmine diagnosed in tests/determinism.test.ts).
    expect(resumed).toEqual(straight);
  });

  it('clearSave leaves nothing behind', async () => {
    await saveWorld(createWorld(1), 0);
    await clearSave();
    expect(await loadSave()).toBeNull();
  });
});

describe('migrations', () => {
  it('accepts the frozen v1 fixture', () => {
    // Cloned rather than passed directly: migrate() writes onto its argument
    // in place (defensive defaulting/top-up further down), and fixtureV1 is
    // a shared module-level import reused by every test in this file — a
    // direct call here would permanently mutate it for tests that run after.
    const save = migrate(JSON.parse(JSON.stringify(fixtureV1)));
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

  // migrate() writes onto its argument's nested arrays/objects in place
  // (see the lastWandererTick default above and the homes top-up below) —
  // fine for its real caller (a freshly-parsed, one-shot object from
  // idb-keyval), but fixtureV1 is a shared module-level import reused by
  // every test in this file, so each test here must deep-clone it first to
  // avoid leaking mutations into tests that run after it (including the
  // earlier 'accepts the frozen v1 fixture' test, which calls migrate()
  // with the fixture directly and would otherwise permanently pollute it
  // for the rest of the suite).
  // Also strips any of the three new kinds so the "save predates them"
  // precondition holds regardless of the fixed fixture's own baseline
  // content or of migrate()'s in-place mutation making a prior test's clone
  // outlive its test — this test's precondition doesn't depend on any other
  // test's ordering or behavior.
  const NEW_HOME_KINDS = new Set(['drey', 'spawnClump', 'sandNest']);
  function cloneFixtureWithoutNewHomeKinds(): { version: number; savedAtEpochMs: number; sim: { homes: { id: number; kind: string }[]; nextId: number } } {
    const clone = JSON.parse(JSON.stringify(fixtureV1));
    clone.sim.homes = clone.sim.homes.filter((h: { kind: string }) => !NEW_HOME_KINDS.has(h.kind));
    return clone;
  }

  it('tops up pre-M10 saves with the new drey/spawnClump/sandNest homes', () => {
    // The frozen v1 fixture predates M10's three new home kinds — it has
    // none of them (real regression: squirrel/frog/turtle are wandersIn
    // species that get brought into any loaded world by the population
    // regulator regardless of save age, pair up, and then stick forever in
    // 'nesting' because claimHome finds no home of their kind).
    const base = cloneFixtureWithoutNewHomeKinds();
    const priorKinds = new Set(base.sim.homes.map((h) => h.kind));
    expect(priorKinds.has('drey')).toBe(false);
    expect(priorKinds.has('spawnClump')).toBe(false);
    expect(priorKinds.has('sandNest')).toBe(false);
    const priorIds = new Set(base.sim.homes.map((h) => h.id));
    const priorNextId = base.sim.nextId;

    const save = migrate(cloneFixtureWithoutNewHomeKinds());
    expect(save).not.toBeNull();
    if (!save) throw new Error('save missing');

    for (const kind of ['drey', 'spawnClump', 'sandNest'] as const) {
      const homesOfKind = save.sim.homes.filter((h) => h.kind === kind);
      expect(homesOfKind.length).toBeGreaterThan(0);
      for (const h of homesOfKind) {
        expect(priorIds.has(h.id)).toBe(false); // no id collision with pre-existing homes
        expect(h.id).toBeGreaterThanOrEqual(priorNextId); // allocated from nextId onward
        expect(h.familyId).toBeNull();
      }
    }
    // Every added id was actually consumed from nextId, so it advanced too.
    expect(save.sim.nextId).toBeGreaterThan(priorNextId);
    // ids stay unique across the whole homes array.
    const allIds = save.sim.homes.map((h) => h.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('is idempotent: re-migrating an already-topped-up save adds nothing new', () => {
    const once = migrate(cloneFixtureWithoutNewHomeKinds());
    expect(once).not.toBeNull();
    if (!once) throw new Error('save missing');
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).not.toBeNull();
    expect(twice?.sim.homes).toEqual(once.sim.homes);
    expect(twice?.sim.nextId).toBe(once.sim.nextId);
  });

  it('loadSave survives a corrupt stored value', async () => {
    const { set } = await import('idb-keyval');
    await set('beastoria.save', { junk: true });
    expect(await loadSave()).toBeNull();
  });
});

// Regression for the reset-resurrection race: DevPanel's reset button calls
// suppressSaves() before clearSave()+reload(), so a saveWorld triggered by the
// reload's visibilitychange/pagehide handlers can't re-persist the cleared
// world. suppressSaves() is module-level latch state — kept last in the file
// and unlatched immediately after so it can't bleed into earlier tests.
describe('suppressSaves latch', () => {
  it('saveWorld is a no-op while suppressed', async () => {
    suppressSaves();
    await saveWorld(createWorld(1), 0);
    expect(await loadSave()).toBeNull();
    resumeSaves();
  });
});
