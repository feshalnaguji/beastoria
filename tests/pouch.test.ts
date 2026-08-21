/**
 * M12 Task 4: the joey really rides.
 *
 * Before this task a kangaroo baby was an ordinary Creature merely leashed
 * near its home. That could never work: an adult kangaroo moves 9 units/tick
 * (the valley's fastest) and the baby stage multiplier is 0.55, so a joey
 * manages 4.95 — it crossed the 140-unit baby leash in about 1.6 seconds
 * every time its mother set off. This file pins the real thing: it mounts
 * when it is near her, its position IS hers while it rides, it hops out on a
 * deterministic graze window and climbs back in, it is put down when it grows
 * up, and — the load-bearing constraint — none of those transitions ever
 * touches the sim's RNG stream.
 *
 * Pinned numeric contract (same convention as tests/feeding.test.ts): the
 * constants below are literal copies of the module-private ones in
 * src/sim/family.ts, not imports of them, so an accidental change to those
 * fails a test here instead of silently reshaping the game.
 */
import { describe, expect, it } from 'vitest';
import { applyActivity, decayNeeds, idHash, selectBehavior } from '../src/sim/behaviors';
import { getClock } from '../src/sim/clock';
import { familySystem } from '../src/sim/family';
import { ageCreatures } from '../src/sim/lifecycle';
import { tick } from '../src/sim/Sim';
import { speedFor } from '../src/sim/species';
import {
  createWorld,
  spawnCreature,
  type Creature,
  type Family,
  type WorldState,
} from '../src/sim/state';

/** How close a joey must be to its mother to climb in (family.ts). */
const MOUNT_RANGE = 60;
/** The graze window: POUCH_GRAZE_TICKS out of every POUCH_GRAZE_PERIOD. */
const POUCH_GRAZE_PERIOD = 600;
const POUCH_GRAZE_TICKS = 120;
/** How far a grazing joey may potter from its mother (= BABY_LEASH). */
const GRAZE_LEASH = 140;
/** Ticks a passing takes to complete (family.ts's PASS_GATHER_TICKS). */
const PASS_GATHER_TICKS = 200;

/**
 * The graze window as family.ts computes it — pure arithmetic on the tick
 * count and the joey's own id, phased by `idHash` so two joeys never hop out
 * on the same tick. Reproduced here (using the same exported `idHash`) so the
 * tests can predict transitions exactly.
 */
function predictGraze(tick: number, joeyId: number): boolean {
  return (tick + idHash(joeyId)) % POUCH_GRAZE_PERIOD < POUCH_GRAZE_TICKS;
}

/**
 * Sim.tick's pipeline minus regulatePopulation. The wanderer failsafe would
 * otherwise flood these deliberately-tiny worlds with one arrival per species
 * (every species is below its floor once the starting cast is cleared), which
 * has nothing to do with the pouch and buries the signal. Order is otherwise
 * identical to src/sim/Sim.ts, including familySystem running BEFORE
 * applyActivity — the ordering the position derivation depends on.
 */
function localTick(state: WorldState): void {
  state.tick++;
  const clock = getClock(state.tick);
  decayNeeds(state);
  ageCreatures(state);
  for (const c of state.creatures) selectBehavior(state, c, clock);
  familySystem(state);
  for (const c of state.creatures) applyActivity(state, c, clock);
}

interface JoeyWorld {
  state: WorldState;
  mother: Creature;
  joey: Creature;
  fam: Family;
}

/**
 * A valley containing exactly one kangaroo family in 'rearing': a mother at
 * her shade scrape and one joey a few paces away, well inside MOUNT_RANGE.
 * `idBump` burns that many ids before the joey is spawned, which shifts its
 * `idHash` phase — the handle the phasing test pulls on.
 */
function joeyWorld(seed: number, idBump = 0): JoeyWorld {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  for (const h of state.homes) h.familyId = null;
  const home = state.homes.find((h) => h.kind === 'shadeScrape');
  if (!home) throw new Error('no shade scrape');

  const mother = spawnCreature(state, 'kangaroo', { ...home.pos }, 0.5);
  mother.sex = 'f';
  state.nextId += idBump;
  const joey = spawnCreature(state, 'kangaroo', { x: home.pos.x + 20, y: home.pos.y }, 0.02);
  joey.sex = 'm';

  // The array is sorted ascending by id and the mother is always born first,
  // so applyActivity reaches her before the joey and the joey reads THIS
  // tick's position, never a stale one. Asserted rather than assumed — the
  // whole position-derivation design rests on it.
  expect(joey.id).toBeGreaterThan(mother.id);
  expect(state.creatures.indexOf(joey)).toBeGreaterThan(state.creatures.indexOf(mother));
  expect(mother.stage).toBe('adult');
  expect(joey.stage).toBe('baby');

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
  return { state, mother, joey, fam };
}

function dist(a: Creature, b: Creature): number {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
}

describe('a) the joey mounts, and rides exactly where its mother goes', () => {
  it('climbs in within a handful of ticks and its position is hers, every tick, while she travels', () => {
    const { state, mother, joey } = joeyWorld(3);
    expect(dist(joey, mother)).toBeLessThanOrEqual(MOUNT_RANGE); // starts in reach

    let mounted = -1;
    for (let t = 0; t < 30 && mounted < 0; t++) {
      localTick(state);
      if (joey.carriedBy === mother.id) mounted = state.tick;
    }
    expect(mounted).toBeGreaterThan(0);

    // Now watch a long stretch of her day. Every tick the joey is aboard, its
    // position must be hers EXACTLY — this is the assertion that fails today,
    // when a joey at 4.95 units/tick simply cannot follow a mother at 9.
    let carriedTicks = 0;
    let travelled = 0;
    let prev = { ...mother.pos };
    for (let t = 0; t < 400; t++) {
      localTick(state);
      travelled += Math.hypot(mother.pos.x - prev.x, mother.pos.y - prev.y);
      prev = { ...mother.pos };
      if (joey.carriedBy === mother.id) {
        carriedTicks++;
        expect(joey.pos.x).toBe(mother.pos.x);
        expect(joey.pos.y).toBe(mother.pos.y);
        expect(joey.heading).toBe(mother.heading);
      }
    }
    expect(carriedTicks).toBeGreaterThan(200); // it really did spend the day aboard
    expect(travelled).toBeGreaterThan(200); // and she really did go somewhere
  });

  it('does not alias positions: the two creatures keep their own Vec2 objects', () => {
    // `joey.pos = mother.pos` would look identical to the test above and be a
    // real bug — one shared object across two creatures, silently duplicated
    // by the save's JSON round-trip and moved by either one's next step.
    const { state, mother, joey } = joeyWorld(3);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);
    expect(joey.pos).not.toBe(mother.pos);
    mother.pos.x += 500;
    expect(joey.pos.x).not.toBe(mother.pos.x);
  });

  it('a riding joey still gets hungry and is still nursed', () => {
    const { state, mother, joey } = joeyWorld(3);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);

    // Needs keep decaying aboard (decayNeeds is its own pass, untouched by
    // the movement bypass), and activity.ticks keeps counting.
    joey.needs.hunger = 0.2;
    const ticksBefore = joey.activity.ticks;
    for (let t = 0; t < 40; t++) localTick(state);
    expect(joey.needs.hunger).toBeGreaterThan(0.2);
    expect(joey.activity.ticks).toBeGreaterThan(ticksBefore);

    // And a hungry joey in the pouch is fed: at distance 0 it is comfortably
    // inside FEED_CONTACT_RANGE, so the nursing step relieves it.
    joey.needs.hunger = 0.95;
    let relieved = false;
    let peak = joey.needs.hunger;
    for (let t = 0; t < 1200 && !relieved; t++) {
      localTick(state);
      if (joey.needs.hunger < peak - 0.01) relieved = true;
      peak = Math.max(peak, joey.needs.hunger);
    }
    expect(relieved).toBe(true);
  });
});

describe('b) the joey is put down when it grows up', () => {
  it('dismounts on reaching juvenile and moves on its own feet again', () => {
    const { state, mother, joey } = joeyWorld(3);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);

    // Two ticks short of the baby/juvenile boundary.
    joey.ageTicks = Math.floor(joey.lifespanTicks * 0.1) - 2;
    for (let t = 0; t < 5; t++) localTick(state);
    expect(joey.stage).toBe('juvenile');
    expect(joey.carriedBy).toBeNull();

    // Ordinary movement resumed: it goes its own way rather than sitting
    // frozen wherever it was set down.
    const setDownAt = { ...joey.pos };
    let ownMovement = 0;
    let prev = { ...joey.pos };
    for (let t = 0; t < 150; t++) {
      localTick(state);
      ownMovement += Math.hypot(joey.pos.x - prev.x, joey.pos.y - prev.y);
      prev = { ...joey.pos };
      expect(joey.carriedBy).toBeNull(); // never climbs back in as a juvenile
    }
    expect(ownMovement).toBeGreaterThan(20);
    expect(Math.hypot(joey.pos.x - setDownAt.x, joey.pos.y - setDownAt.y)).toBeGreaterThan(0);
  });
});

describe('c) the graze window: it hops out to feed itself, then climbs back in', () => {
  it('dismounts exactly on its own idHash-phased window, and remounts after it', () => {
    const { state, mother, joey } = joeyWorld(3);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);

    let firstDismount = -1;
    for (let t = 0; t < POUCH_GRAZE_PERIOD + 50 && firstDismount < 0; t++) {
      localTick(state);
      if (joey.carriedBy === null) firstDismount = state.tick;
    }
    expect(firstDismount).toBeGreaterThan(0);
    // It hopped out on precisely the tick the pinned formula says, phase and
    // all — not on some other cadence that merely happens to end the ride.
    expect(predictGraze(firstDismount, joey.id)).toBe(true);
    expect(predictGraze(firstDismount - 1, joey.id)).toBe(false);

    // It stays out for the window, then gets back in.
    let remounted = -1;
    for (let t = 0; t < POUCH_GRAZE_PERIOD && remounted < 0; t++) {
      localTick(state);
      if (joey.carriedBy === mother.id) remounted = state.tick;
    }
    expect(remounted).toBeGreaterThan(firstDismount);
    expect(remounted - firstDismount).toBeGreaterThanOrEqual(POUCH_GRAZE_TICKS);
  });

  it('is phased per joey — two joeys with different ids graze at different times', () => {
    const a = joeyWorld(3, 0);
    const b = joeyWorld(3, 7); // same world, a joey with a different id
    expect(b.joey.id).not.toBe(a.joey.id);

    const firstGrazeOf = (w: JoeyWorld): number => {
      for (let t = 0; t < 30 && w.joey.carriedBy === null; t++) localTick(w.state);
      expect(w.joey.carriedBy).toBe(w.mother.id);
      for (let t = 0; t < POUCH_GRAZE_PERIOD + 50; t++) {
        localTick(w.state);
        if (w.joey.carriedBy === null) return w.state.tick;
      }
      throw new Error('never grazed');
    };

    expect(firstGrazeOf(a)).not.toBe(firstGrazeOf(b));
  });

  it('a grazing joey stays within a leash of its mother rather than being left behind', () => {
    const { state, mother, joey } = joeyWorld(3);
    let sawGrazing = false;
    let worst = 0;
    for (let t = 0; t < 2500; t++) {
      localTick(state);
      if (joey.carriedBy === null && joey.stage === 'baby') {
        sawGrazing = true;
        worst = Math.max(worst, dist(joey, mother));
      }
    }
    expect(sawGrazing).toBe(true);
    // The leash pulls it back toward her every tick it is beyond the radius;
    // a mother at 9 units/tick can outrun a joey at 4.95 for a moment, so the
    // bound is the leash plus a generous overshoot allowance — the point is
    // that it is bounded at all, which the old nest-anchored leash was not.
    expect(worst).toBeLessThan(GRAZE_LEASH * 6);
  });
});

describe('d) the pouch draws nothing from the RNG stream', () => {
  it('2000 ticks of mounts, graze windows and remounts leave state.rng untouched', () => {
    const { state, mother, joey } = joeyWorld(5);
    joey.ageTicks = 0;
    joey.pos = { x: mother.pos.x, y: mother.pos.y }; // stationary: pure transition exercise

    // In this world familySystem itself is draw-free by construction — no
    // passings due, both members already in a family so formPairs finds
    // nobody eligible, no clutch to roll — so any movement in state.rng can
    // only have come from the pouch code under test.
    //
    // Task 7 (M13): the loop below starts from a fresh joeyWorld — joey is
    // not yet carried on the first iteration — so this window already covers
    // the very FIRST mount, not merely the re-mounts that follow subsequent
    // graze windows. `firstMountTick` makes that explicit rather than relying
    // on `mounts >= 3` to imply it: the eventual real mount/dismount errand
    // (not yet implemented — today's flip is instant) must stay draw-free
    // from its very first ride onward, and this is the assertion that holds
    // it to that standard immediately.
    const before = [...state.rng];
    let mounts = 0;
    let dismounts = 0;
    let carried = false;
    let firstMountTick = -1;
    for (let i = 0; i < 2000; i++) {
      state.tick++;
      familySystem(state);
      const now = joey.carriedBy !== null && joey.carriedBy !== undefined;
      if (now && !carried) {
        mounts++;
        if (firstMountTick < 0) firstMountTick = i;
      }
      if (!now && carried) dismounts++;
      carried = now;
    }
    // Not a vacuous pass: the run really did cycle through the transitions,
    // and the very first one of them is inside the window this test checks.
    expect(firstMountTick).toBeGreaterThanOrEqual(0);
    expect(mounts).toBeGreaterThanOrEqual(3);
    expect(dismounts).toBeGreaterThanOrEqual(3);
    expect([...state.rng]).toEqual(before);
  });

  it('the on-foot chase re-targets every tick and still draws nothing', () => {
    // Kills the obvious mutant: a chase target scattered with nextRange, the
    // way the ordinary nest leash's re-gather used to be.
    const { state, mother, joey } = joeyWorld(5);
    joey.ageTicks = 0;
    joey.pos = { x: mother.pos.x + 500, y: mother.pos.y }; // far out of reach, never arrives

    const before = [...state.rng];
    for (let i = 0; i < 500; i++) {
      state.tick++;
      familySystem(state);
    }
    expect(joey.activity.id).toBe('gather'); // it is being called back
    expect(joey.carriedBy).toBeNull();
    expect([...state.rng]).toEqual(before);
  });

  it('growing up and being stranded are draw-free too', () => {
    const { state, mother, joey } = joeyWorld(5);
    joey.pos = { x: mother.pos.x, y: mother.pos.y };
    state.tick++;
    familySystem(state);
    expect(joey.carriedBy).toBe(mother.id);

    const before = [...state.rng];
    joey.stage = 'juvenile';
    state.tick++;
    familySystem(state);
    expect(joey.carriedBy).toBeNull();

    // ...and the stranded-rider backstop (family gone out from under it).
    joey.stage = 'baby';
    joey.carriedBy = mother.id;
    joey.familyId = null;
    state.tick++;
    familySystem(state);
    expect(joey.carriedBy).toBeNull();
    expect([...state.rng]).toEqual(before);
  });
});

describe('e) a carried joey always eventually gets out (no permanent freeze)', () => {
  it('never rides for longer than one graze period, and gets back in again', () => {
    const { state, mother, joey } = joeyWorld(9);
    let streak = 0;
    let longestStreak = 0;
    let mounts = 0;
    let carried = false;
    for (let t = 0; t < 4000; t++) {
      localTick(state);
      if (joey.stage !== 'baby') break; // grown up: no longer the case under test
      const now = joey.carriedBy === mother.id;
      if (now && !carried) mounts++;
      carried = now;
      streak = now ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    }
    expect(mounts).toBeGreaterThanOrEqual(2); // rides, gets out, rides again
    expect(longestStreak).toBeGreaterThan(0);
    expect(longestStreak).toBeLessThan(POUCH_GRAZE_PERIOD);
  });

  it('a joey whose mother passes is set down and walks again', () => {
    const { state, mother, joey } = joeyWorld(9);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);

    mother.ageTicks = mother.lifespanTicks + 1; // her time has come
    for (let t = 0; t < PASS_GATHER_TICKS + 20; t++) localTick(state);
    expect(state.creatures.some((c) => c.id === mother.id)).toBe(false);
    expect(joey.carriedBy).toBeNull();

    // A generous horizon on purpose: an orphaned baby is a free agent again,
    // and a free agent legitimately stands still for a long stretch while it
    // eats out a forage target. What is being ruled out is a PERMANENT
    // freeze, not stillness.
    let moved = 0;
    let prev = { ...joey.pos };
    for (let t = 0; t < 1000; t++) {
      localTick(state);
      moved += Math.hypot(joey.pos.x - prev.x, joey.pos.y - prev.y);
      prev = { ...joey.pos };
    }
    expect(moved).toBeGreaterThan(20); // not frozen where she left it
    expect(joey.activity.id).not.toBe('gather'); // and not stuck in a family duty
  });

  it('a carry link naming a creature that no longer exists is cut, not chased', () => {
    const { state, mother, joey } = joeyWorld(9);
    // Out of reach of its mother, so nothing can re-mount it this tick and
    // the assertion is about the ghost link alone.
    joey.pos = { x: mother.pos.x + 500, y: mother.pos.y };
    joey.carriedBy = 999999; // a ghost
    state.tick++;
    familySystem(state);
    expect(joey.carriedBy).toBeNull();
  });

  it('a ghost link on a joey standing right beside its mother resolves to HER, never the ghost', () => {
    const { state, mother, joey } = joeyWorld(9);
    joey.carriedBy = 999999;
    state.tick++;
    familySystem(state);
    expect(joey.carriedBy).not.toBe(999999);
    expect(joey.carriedBy).toBe(mother.id);
  });
});

describe('the pouch is hers alone — no father ever carries the joey', () => {
  it('a motherless joey never mounts its surviving father, and falls back to the nest leash', () => {
    // `rearing` only ends when there are no children left or every child has
    // grown up, so a family whose mother passes stays in `rearing` with the
    // father still on the parent list. A `?? parents[0]` fallback in the
    // carrier selection — the idiom the nurse-feeder and brood-sitter
    // selections in this file legitimately use — would have handed him the
    // pouch. A pouch is not a duty that can be handed over.
    const { state, mother, joey, fam } = joeyWorld(9);
    const home = state.homes.find((h) => h.id === fam.homeId);
    if (!home) throw new Error('no home');

    const father = spawnCreature(state, 'kangaroo', { x: mother.pos.x + 30, y: mother.pos.y }, 0.5);
    father.sex = 'm';
    father.familyId = fam.id;
    fam.parentIds.push(father.id);

    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id); // aboard, before we take her away

    mother.ageTicks = mother.lifespanTicks + 1;
    for (let t = 0; t < PASS_GATHER_TICKS + 20; t++) localTick(state);
    expect(state.creatures.some((c) => c.id === mother.id)).toBe(false);
    // The family survives him: still rearing, still holding the joey.
    expect(state.families.some((f) => f.id === fam.id)).toBe(true);
    expect(fam.parentIds).toEqual([father.id]);
    expect(joey.stage).toBe('baby');

    // Now keep the father glued to the joey's side — closer than MOUNT_RANGE
    // every single tick — so the test cannot pass merely because they never
    // happened to meet.
    let closeTicks = 0;
    for (let t = 0; t < 1500; t++) {
      father.pos = { x: joey.pos.x + 20, y: joey.pos.y };
      localTick(state);
      if (Math.hypot(father.pos.x - joey.pos.x, father.pos.y - joey.pos.y) <= MOUNT_RANGE) {
        closeTicks++;
      }
      expect(joey.carriedBy).toBeNull(); // never climbs into his pouch
    }
    expect(closeTicks).toBeGreaterThan(1000); // and it really was in reach throughout

    // Falls back to the ordinary nest leash, which is the right home for a
    // motherless baby: put it out past BABY_LEASH and the nest — not the
    // father — calls it back.
    joey.pos = { x: home.pos.x + 600, y: home.pos.y };
    joey.activity = { id: 'idle', ticks: 0, minTicks: 0 };
    localTick(state);
    expect(joey.activity.id).toBe('gather');
    const target = joey.activity.targetPos;
    if (!target) throw new Error('no leash target');
    expect(Math.hypot(target.x - home.pos.x, target.y - home.pos.y)).toBeLessThan(70);
  });
});

describe('and it happens in an ordinary valley, not just a hand-built one', () => {
  it('a joey is riding in a plain createWorld run, through the real Sim.tick pipeline', () => {
    // Everything above drives a deliberately-tiny world through a local
    // pipeline. This drives the real one, with all twelve species and the
    // population regulator running, to prove the feature is actually
    // reachable: the starting cast's kangaroo pair courts, nests, births a
    // joey, and it climbs in. (Measured across seeds 1/7/11/23/42, the first
    // ride happens between ticks 1400 and 1800; the 6000-tick budget here is
    // generous headroom, not a tight fit.)
    const state = createWorld(1);
    let rider: Creature | undefined;
    for (let t = 0; t < 6000 && !rider; t++) {
      tick(state, []);
      rider = state.creatures.find((c) => c.species === 'kangaroo' && c.carriedBy != null);
    }
    expect(rider).toBeDefined();
    if (!rider) throw new Error('nobody rode');
    const carrier = state.creatures.find((c) => c.id === rider.carriedBy);
    expect(carrier).toBeDefined();
    expect(carrier?.species).toBe('kangaroo');
    expect(carrier?.sex).toBe('f'); // her pouch, not his
    expect(rider.stage).toBe('baby');
    expect(rider.pos).toEqual(carrier?.pos);
  });
});

describe('the mechanical reason this exists', () => {
  it('a joey on foot cannot keep up with its own mother', () => {
    const mother = speedFor('kangaroo', 'adult');
    const joey = speedFor('kangaroo', 'baby');
    expect(joey).toBeLessThan(mother);
    // It falls out of the old 140-unit nest leash in well under two seconds
    // of a mother travelling flat out (10 ticks = 1s at 1x).
    expect((mother - joey) * 20).toBeGreaterThan(GRAZE_LEASH * 0.5);
  });
});

/**
 * M13 Task 7 (RED): a visible mount/dismount transition.
 *
 * Today `stepPouch` in src/sim/family.ts flips `joey.carriedBy` the instant
 * distance <= MOUNT_RANGE (mount) or the graze window opens (dismount) — no
 * intermediate state either way, so the joey appears to teleport into and
 * out of the pouch. The fix (a later task) gives both transitions a real,
 * multi-tick errand: an `'mount'` activity id that the joey occupies while
 * walking the last stretch in, pausing, and climbing aboard — and,
 * symmetrically, while climbing OUT before the actual release. `'mount'`
 * does not exist as an Activity id yet (see src/sim/behaviors.ts), so these
 * tests compare `activity.id` `as string` against it — the same type-safe
 * workaround tests/family.test.ts already uses for `'gestate'` before that
 * id existed.
 *
 * These tests encode the DESIRED behavior and are expected to fail against
 * today's sim (see the per-test comments for which ones and why). Task 8
 * (a different implementer) makes them pass; this task must not touch
 * src/sim/family.ts.
 */
const MOUNT_MAX_TICKS = 150;

describe('f) M13 Task 7: an intermediate "mount" errand replaces the instant flip', () => {
  it('7a: a "mount" errand is observed at some tick before the joey is ever aboard', () => {
    const { state, mother, joey } = joeyWorld(3);
    expect(dist(joey, mother)).toBeLessThanOrEqual(MOUNT_RANGE); // starts in reach

    let sawMountErrand = false;
    let mounted = -1;
    for (let t = 0; t < 30 && mounted < 0; t++) {
      localTick(state);
      // Checked against THIS tick's carriedBy directly (not a variable set
      // on a prior iteration): if carriedBy already reads as mother.id this
      // tick, it is the mount/release tick itself, and an activity id of
      // 'mount' on it is NOT counted as errand evidence — only a tick
      // strictly before the joey is ever aboard counts. Without this guard,
      // a future implementation could satisfy this test by relabeling the
      // same instant, same-tick, atomic carriedBy-flip's activity id to
      // 'mount' without ever building a real multi-tick "walk to flank,
      // pause, then mount" errand. This mirrors 7c's
      // `joey.carriedBy === mother.id` (definitely-still-riding) gate.
      if (joey.carriedBy === mother.id) {
        mounted = state.tick;
      } else if ((joey.activity.id as string) === 'mount') {
        sawMountErrand = true;
      }
    }
    // Sanity: it did mount today (just instantly) — this much still holds.
    expect(mounted).toBeGreaterThan(0);
    // EXPECTED TO FAIL today: stepPouch flips carriedBy directly from
    // whatever the joey was doing (typically 'idle') with no 'mount' step
    // ever appearing on any earlier tick.
    expect(sawMountErrand).toBe(true);
  });

  it('7b: no "mount" streak ever exceeds a generous ceiling (freeze guard, applied prospectively)', () => {
    // The same class of bug Thread 4 fixed for 'gather' (babies permanently
    // parked with no exit condition), guarded here BEFORE 'mount' is even
    // implemented. Note: this test cannot meaningfully fail yet — 'mount'
    // never occurs in today's sim, so the streak is always 0 and the bound
    // is trivially satisfied. It is a forward-looking guard, not a
    // bug-exposure test: once Task 8 lands, this is the test that would
    // catch a mount errand with no exit condition.
    const { state, joey } = joeyWorld(9);
    let streak = 0;
    let longestStreak = 0;
    for (let t = 0; t < 4000; t++) {
      localTick(state);
      if (joey.stage !== 'baby') break; // grown up: no longer the case under test
      if ((joey.activity.id as string) === 'mount') {
        streak++;
      } else {
        streak = 0;
      }
      longestStreak = Math.max(longestStreak, streak);
    }
    expect(longestStreak).toBeLessThan(MOUNT_MAX_TICKS);
  });

  it('7c: a climb-out lead-in precedes the release, which still lands on the exact idHash-phased tick', () => {
    const { state, mother, joey } = joeyWorld(3);
    for (let t = 0; t < 30 && joey.carriedBy === null; t++) localTick(state);
    expect(joey.carriedBy).toBe(mother.id);

    let firstDismount = -1;
    let sawLeadIn = false;
    for (let t = 0; t < POUCH_GRAZE_PERIOD + 50 && firstDismount < 0; t++) {
      localTick(state);
      // A lead-in tick: still aboard, but already in the 'mount' errand that
      // precedes the actual release.
      if (joey.carriedBy === mother.id && (joey.activity.id as string) === 'mount') {
        sawLeadIn = true;
      }
      if (joey.carriedBy === null) firstDismount = state.tick;
    }
    expect(firstDismount).toBeGreaterThan(0);
    // The pinned contract this must NOT weaken: the ACTUAL dismount — the
    // tick carriedBy really clears — still lands exactly on the idHash-
    // phased tick the existing test at pouch.test.ts:230-254 locks in. A
    // lead-in that fired but let the real release drift off-phase would
    // fail here just as surely as no lead-in at all.
    expect(predictGraze(firstDismount, joey.id)).toBe(true);
    expect(predictGraze(firstDismount - 1, joey.id)).toBe(false);
    // EXPECTED TO FAIL today: dismount is instant, so no 'mount' lead-in
    // ever appears on a tick before the release.
    expect(sawLeadIn).toBe(true);
  });
});
