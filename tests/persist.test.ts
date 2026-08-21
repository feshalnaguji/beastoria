/**
 * Persistence: versioned SaveFile round-trip through (fake) IndexedDB,
 * migration chain from frozen fixtures, corrupt-data resilience.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type Family, type WorldState } from '../src/sim/state';
import { migrate } from '../src/persist/migrations';
import { SAVE_VERSION } from '../src/persist/schema';
import { clearSave, loadSave, resumeSaves, saveWorld, suppressSaves } from '../src/persist/store';
import fixtureV1 from './fixtures/save-v1.json';

function runTicks(state: ReturnType<typeof createWorld>, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

/**
 * A world holding one kangaroo family in 'rearing', the mother and her joey
 * standing together at the shade scrape — everything the pouch (M12) needs to
 * be mid-ride. Used only by the carriedBy round-trip tests below; the full
 * behavioral coverage lives in tests/pouch.test.ts.
 */
function midRideWorld(seed: number): { state: WorldState; motherId: number; joeyId: number } {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  for (const h of state.homes) h.familyId = null;
  const home = state.homes.find((h) => h.kind === 'shadeScrape');
  if (!home) throw new Error('no shade scrape');
  const mother = spawnCreature(state, 'kangaroo', { ...home.pos }, 0.5);
  mother.sex = 'f';
  const joey = spawnCreature(state, 'kangaroo', { x: home.pos.x + 15, y: home.pos.y }, 0.02);
  const fam: Family = {
    id: state.nextId++,
    species: 'kangaroo',
    parentIds: [mother.id],
    childIds: [joey.id],
    homeId: home.id,
    phase: 'rearing',
    phaseTicks: 0,
    dutyParent: 0,
  };
  state.families.push(fam);
  mother.familyId = fam.id;
  joey.familyId = fam.id;
  home.familyId = fam.id;
  for (let i = 0; i < 30 && joey.carriedBy === null; i++) tick(state, []);
  if (joey.carriedBy !== mother.id) throw new Error('joey never mounted');
  return { state, motherId: mother.id, joeyId: joey.id };
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
    // Deep-cloned (not a shallow `{ ...base.sim }`): migrate() pushes onto
    // save.sim.homes in place (see the top-up below), and a shallow copy's
    // `homes` array still aliases fixtureV1's own — a real bug this task
    // (M11 task 2) found, where that alias let this test permanently
    // corrupt the shared frozen fixture (extra homes, stale nextId) for
    // every test running after it in this file.
    const base = JSON.parse(JSON.stringify(fixtureV1)) as {
      version: number;
      savedAtEpochMs: number;
      sim: Record<string, unknown>;
    };
    const sim = base.sim;
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

  it('tops up a v1.2 save with the new shadeScrape homes — the df20058 regression, caught by a test this time', () => {
    // Simulate a genuine v1.2 save (post-M10, pre-M11): migrate the frozen
    // pre-M10 fixture once so it already has drey/spawnClump/sandNest — the
    // shape of a real save from the M10-through-M11 window — but it predates
    // M11's kangaroo, so it has no shadeScrape homes at all. This is exactly
    // the M10 regression class (commit df20058: a new home kind added to
    // createWorld()'s siteGroups but not to this migration, so pairing
    // kangaroos would find no home of their kind and stick forever) —
    // caught here by a test instead of shipping and being found by a user.
    const migratedOnce = migrate(JSON.parse(JSON.stringify(fixtureV1)));
    expect(migratedOnce).not.toBeNull();
    if (!migratedOnce) throw new Error('save missing');
    // The frozen fixture predates every M10/M11 home kind, so a single
    // migrate() tops up drey/spawnClump/sandNest AND shadeScrape all at
    // once — stripping shadeScrape back out models a genuine v1.2 save:
    // real history with M10's three kinds already present, but predating
    // M11's kangaroo.
    const v12 = {
      ...migratedOnce,
      sim: { ...migratedOnce.sim, homes: migratedOnce.sim.homes.filter((h) => h.kind !== 'shadeScrape') },
    };
    expect(v12.sim.homes.some((h) => h.kind === 'shadeScrape')).toBe(false);
    const priorIds = new Set(v12.sim.homes.map((h) => h.id));
    const priorNextId = v12.sim.nextId;

    const save = migrate(JSON.parse(JSON.stringify(v12)));
    expect(save).not.toBeNull();
    if (!save) throw new Error('save missing');

    const scrapes = save.sim.homes.filter((h) => h.kind === 'shadeScrape');
    expect(scrapes.length).toBeGreaterThan(0);
    for (const h of scrapes) {
      expect(priorIds.has(h.id)).toBe(false); // no id collision with pre-existing homes
      expect(h.id).toBeGreaterThanOrEqual(priorNextId); // allocated from nextId onward
      expect(h.familyId).toBeNull();
    }
    expect(save.sim.nextId).toBeGreaterThan(priorNextId);
    const allIds = save.sim.homes.map((h) => h.id);
    expect(new Set(allIds).size).toBe(allIds.length); // ids stay unique across the whole array
  });

  it('M12: normalises a missing carriedBy to null rather than rejecting', () => {
    // The frozen v1 fixture predates the pouch entirely — not one of its
    // creatures carries the key. Same defensive shape as the
    // lastWandererTick default above: a save written before the field
    // existed must load, not be thrown away.
    const raw = JSON.parse(JSON.stringify(fixtureV1)) as {
      sim: { creatures: { carriedBy?: number | null }[] };
    };
    expect(raw.sim.creatures.length).toBeGreaterThan(0);
    expect(raw.sim.creatures.every((c) => c.carriedBy === undefined)).toBe(true);

    const save = migrate(raw);
    expect(save).not.toBeNull();
    if (!save) throw new Error('save missing');
    for (const c of save.sim.creatures) expect(c.carriedBy).toBeNull();
  });

  it('M12: cuts a carriedBy naming an id that is no longer in creatures', () => {
    // The orphaned-reference guard. A dangling carrier id would leave the
    // rider with its behavior selection switched off and nothing to derive a
    // position from — frozen where it stood, forever.
    const raw = JSON.parse(JSON.stringify(fixtureV1)) as {
      sim: { creatures: { id: number; carriedBy?: number | null }[] };
    };
    const [first, second] = raw.sim.creatures;
    if (!first || !second) throw new Error('fixture needs two creatures');
    first.carriedBy = 987654321; // nobody
    second.carriedBy = second.id; // itself, which is nobody either

    const save = migrate(raw);
    expect(save).not.toBeNull();
    if (!save) throw new Error('save missing');
    expect(save.sim.creatures[0]?.carriedBy).toBeNull();
    expect(save.sim.creatures[1]?.carriedBy).toBeNull();
  });

  it('M12: a carriedBy naming a creature that IS in the save is left alone', () => {
    // Kills the mutant that "guards" by clearing every link unconditionally,
    // which would silently unload every pouch on every load.
    const raw = JSON.parse(JSON.stringify(fixtureV1)) as {
      sim: { creatures: { id: number; carriedBy?: number | null }[] };
    };
    const [carrier, rider] = raw.sim.creatures;
    if (!carrier || !rider) throw new Error('fixture needs two creatures');
    rider.carriedBy = carrier.id;

    const save = migrate(raw);
    expect(save?.sim.creatures[1]?.carriedBy).toBe(carrier.id);
  });

  it('M12: a save taken mid-ride loads and the joey is still being carried', async () => {
    const { state, motherId, joeyId } = midRideWorld(4);
    await saveWorld(state, 0);
    const save = await loadSave();
    if (!save) throw new Error('save missing');

    const resumed = save.sim;
    const loadedJoey = resumed.creatures.find((c) => c.id === joeyId);
    const loadedMother = resumed.creatures.find((c) => c.id === motherId);
    expect(loadedJoey?.carriedBy).toBe(motherId); // the link survived JSON
    if (!loadedJoey || !loadedMother) throw new Error('lost a kangaroo');

    // ...and the ride continues from where it left off: still aboard, still
    // exactly where she is.
    for (let i = 0; i < 20; i++) tick(resumed, []);
    expect(loadedJoey.carriedBy).toBe(motherId);
    expect(loadedJoey.pos).toEqual(loadedMother.pos);
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
