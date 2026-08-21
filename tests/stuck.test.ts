/**
 * M10 Task 1: no creature freezes, none walks on water.
 *
 * (a) the socialize/court ring approach must never chase a point in the
 *     water forever: moveToward must not lie about a failed snap, and the
 *     ring point itself must always be clamped to legal ground.
 *
 *     Note on scope: an exhaustive sweep (thousands of partner/id/approach
 *     combinations, single- and mutual-approach) found that for this valley's
 *     geometry a stranded approacher's ring-radius (SOCIAL_RANGE*0.45 = 40.5)
 *     is always comfortably inside the social-relief radius
 *     (SOCIAL_RANGE*0.7 = 63) — so a creature that gets close enough to an
 *     illegal ring to trip the old bug is, by the triangle inequality,
 *     *already* within relief range of its partner, and the case statement's
 *     own dist check pulls it into relief before the freeze becomes visible
 *     as "stuck far from partner, forever." That makes a from-scratch 300-tick
 *     dynamic scenario an unreliable RED test — it can pass today by dumb
 *     luck of the geometry, for the wrong reason. So (a) tests the two exact
 *     code-level defects directly instead: moveToward's return-value lie, and
 *     the (till now unclamped) ring target. Both fail today for the precise
 *     documented reason and are exactly what the fix changes.
 * (b) a land creature hand-placed inside the pond must claw its way to shore
 *     without ever stepping deeper into the water.
 * (c) (foodspots reed-filter) lives in tests/foodspots.test.ts, alongside its
 *     sibling foraging tests.
 */
import { describe, expect, it } from 'vitest';
import { applyActivity, idOffsetAngle, socializeRing } from '../src/sim/behaviors';
import { getClock } from '../src/sim/clock';
import { familySystem } from '../src/sim/family';
import { moveToward, wanderStep } from '../src/sim/movement';
import { tick } from '../src/sim/Sim';
import { speedFor } from '../src/sim/species';
import {
  createWorld,
  type Creature,
  type Family,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../src/sim/state';
import { isWater, nearestRestable, POND } from '../src/sim/valley';

/** Mirrors the constant in behaviors.ts (module-private by design). */
const SOCIAL_RANGE = 90;

function bareWorld(seed: number): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  return state;
}

function makeCreature(id: number, species: SpeciesId, pos: Vec2): Creature {
  return {
    id,
    species,
    sex: 'f',
    familyId: null,
    pos: { ...pos },
    heading: 0,
    stage: 'adult',
    ageTicks: 1000,
    lifespanTicks: 20000,
    needs: { hunger: 0.2, rest: 0.2, social: 0.5 },
    activity: { id: 'idle', ticks: 0, minTicks: 0 },
  };
}

describe('no creature freezes mid-socialize', () => {
  it('a) moveToward never lies about a failed snap onto illegal ground', () => {
    const c = makeCreature(1, 'rabbit', { x: POND.x - 4, y: POND.y });
    // The pond centre: illegal for land, and within a rabbit's per-tick
    // speed of the creature's current (legal) position.
    const illegalNearbyTarget = { x: POND.x, y: POND.y };
    const speed = speedFor('rabbit', 'adult');
    expect(Math.hypot(illegalNearbyTarget.x - c.pos.x, illegalNearbyTarget.y - c.pos.y)).toBeLessThan(
      speed,
    );

    const remaining = moveToward(c, illegalNearbyTarget, speed, 'land', 'land');

    expect(remaining).toBeLessThan(0); // not a lying "arrived" (0)
    expect(c.pos).toEqual({ x: POND.x - 4, y: POND.y }); // never snapped onto the water
  });

  it('a) the socialize/court ring is always clamped to legal ground', () => {
    // North shore, just outside the pond's legal land margin.
    const bPos: Vec2 = { x: POND.x, y: POND.y - POND.ry * 1.08 };

    // Find an id whose deterministic ring-offset angle points roughly south
    // (toward the pond centre), so the RAW ring point around b would land in
    // water — the exact scenario the fix must clamp away.
    let aId = -1;
    let angle = 0;
    for (let id = 1; id < 20000; id++) {
      const ang = idOffsetAngle(id);
      if (Math.abs(ang - Math.PI / 2) < 0.05) {
        aId = id;
        angle = ang;
        break;
      }
    }
    expect(aId).toBeGreaterThan(0);

    const rawRing = {
      x: bPos.x + Math.cos(angle) * SOCIAL_RANGE * 0.45,
      y: bPos.y + Math.sin(angle) * SOCIAL_RANGE * 0.45,
    };
    // Sanity check: this scenario really is illegal, otherwise the test
    // below would not exercise the bug at all.
    expect(isWater(rawRing)).toBe(true);

    expect(isWater(socializeRing(bPos, aId, 'land'))).toBe(false);
  });

  it('a) the socialize call site actually targets the clamped ring, not the raw one', () => {
    // Same illegal-ring geometry as the test above, but this time driven
    // through the real call site (applyActivity) rather than the exported
    // helper in isolation — kills a mutant that keeps socializeRing correct
    // but stops calling it from the case block (e.g. reverts to an inline,
    // unclamped ring computation).
    const bPos: Vec2 = { x: POND.x, y: POND.y - POND.ry * 1.08 };
    let aId = -1;
    for (let id = 1; id < 20000; id++) {
      if (Math.abs(idOffsetAngle(id) - Math.PI / 2) < 0.05) {
        aId = id;
        break;
      }
    }
    expect(aId).toBeGreaterThan(0);

    const startPos: Vec2 = { x: bPos.x, y: bPos.y - 150 };
    const clampedRing = socializeRing(bPos, aId, 'land');
    const speed = speedFor('rabbit', 'adult');
    // Twelve ticks of real approach, well short of the ~17 it takes this
    // geometry to reach social relief (where the call site stops moving) —
    // a single tick isn't enough to discriminate: MAX_TURN caps how far the
    // heading turns per tick, so a raw vs. clamped target (close together,
    // same general direction) can still produce an identical FIRST step.
    const TICKS = 12;

    // What TICKS real approach ticks, driven through the actual call site,
    // produce:
    const state = bareWorld(1);
    const clock = getClock(0);
    const b = makeCreature(900, 'rabbit', bPos);
    const a = makeCreature(aId, 'rabbit', startPos);
    a.activity = { id: 'socialize', ticks: 0, minTicks: 60, targetId: b.id };
    state.creatures.push(a, b);
    for (let t = 0; t < TICKS; t++) applyActivity(state, a, clock);

    // What moveToward independently produces, over the same number of ticks,
    // aimed at the CLAMPED ring from the same starting position: if the call
    // site ever stopped using the clamp (e.g. reverted to an inline,
    // unclamped ring computation), the heading would diverge tick over tick
    // and the landed position after TICKS ticks would differ from this.
    const expected = makeCreature(aId, 'rabbit', startPos);
    for (let t = 0; t < TICKS; t++) moveToward(expected, clampedRing, speed, 'land', 'land');

    expect(a.pos).toEqual(expected.pos);
  });

  it('a) moveToward still snaps cleanly onto a legal nearby target', () => {
    // Kills a mutant that makes moveToward return -1 unconditionally: only
    // the illegal case should refuse the snap.
    const c = makeCreature(1, 'rabbit', { x: 100, y: 100 });
    const legalTarget = { x: 103, y: 100 }; // 3 units away, well within speed, far from any water
    const speed = speedFor('rabbit', 'adult');

    const remaining = moveToward(c, legalTarget, speed, 'land', 'land');

    expect(remaining).toBe(0);
    expect(c.pos).toEqual(legalTarget);
  });
});

describe('the socialize progress bail', () => {
  it('flips a stalled socialize approach to wander once a stall window shows no progress', () => {
    const clock = getClock(0);
    const bPos: Vec2 = { x: 2048, y: 1536 };
    const startPos: Vec2 = { x: bPos.x + 200, y: bPos.y }; // > SOCIAL_RANGE * 0.7 away

    // Learn exactly where one real approach tick lands, so the fabricated
    // checkpoint below matches it precisely (net progress ~0 for *this*
    // tick) — this exercises the bail's own displacement check directly,
    // without depending on ~200 real ticks of organic stalling, which (per
    // the note atop this file) the ring clamp makes essentially
    // unreproducible against a stationary partner.
    const dryState = bareWorld(1);
    const dryB = makeCreature(900, 'rabbit', bPos);
    const dryA = makeCreature(1, 'rabbit', startPos);
    dryA.activity = { id: 'socialize', ticks: 1, minTicks: 60, targetId: dryB.id };
    dryState.creatures.push(dryA, dryB);
    applyActivity(dryState, dryA, clock);
    const landedAt = { ...dryA.pos };

    const state = bareWorld(1);
    const b = makeCreature(900, 'rabbit', bPos);
    const a = makeCreature(1, 'rabbit', startPos);
    a.activity = {
      id: 'socialize',
      ticks: 99, // -> 100 after applyActivity's increment: trips the checkpoint window
      minTicks: 60,
      targetId: b.id,
      targetPos: landedAt, // fabricated: exactly where this tick's move lands
    };
    state.creatures.push(a, b);

    applyActivity(state, a, clock);

    expect(a.activity.id).toBe('wander');
  });

  it('clears the approach checkpoint on relief, so a stale checkpoint never causes a false bail', () => {
    const clock = getClock(0);
    const state = bareWorld(1);
    const b = makeCreature(900, 'rabbit', { x: 2048, y: 1536 });
    const a = makeCreature(1, 'rabbit', { x: 2048 + 40, y: 1536 }); // well inside relief range (40 < 63)
    a.needs.social = 0.9;
    // A stale checkpoint sitting right on top of a's current position, as if
    // left over from an earlier approach: if the relief branch failed to
    // clear it, the very next 100-tick boundary reached during a LATER
    // approach would see "no progress" against this leftover value and bail
    // incorrectly.
    a.activity = {
      id: 'socialize',
      ticks: 99,
      minTicks: 60,
      targetId: b.id,
      targetPos: { x: a.pos.x, y: a.pos.y },
    };
    state.creatures.push(a, b);

    applyActivity(state, a, clock); // relief branch: dist (40) <= SOCIAL_RANGE * 0.7 (63)

    expect(a.activity.id).toBe('socialize'); // no bail — relief never even consults the checkpoint
    expect(a.activity.targetPos).toBeUndefined(); // and it's cleared, not left stale
  });

  it('does not apply to court — familySystem re-imposes court the same tick, so COURT_TICKS governs', () => {
    const clock = getClock(0);
    const bPos: Vec2 = { x: 2048, y: 1536 };
    const startPos: Vec2 = { x: bPos.x + 200, y: bPos.y };

    const dryState = bareWorld(1);
    const dryB = makeCreature(900, 'rabbit', bPos);
    const dryA = makeCreature(1, 'rabbit', startPos);
    dryA.activity = { id: 'court', ticks: 1, minTicks: 60, targetId: dryB.id };
    dryState.creatures.push(dryA, dryB);
    applyActivity(dryState, dryA, clock);
    const landedAt = { ...dryA.pos };

    const state = bareWorld(1);
    const b = makeCreature(900, 'rabbit', bPos);
    const a = makeCreature(1, 'rabbit', startPos);
    a.activity = {
      id: 'court',
      ticks: 99,
      minTicks: 60,
      targetId: b.id,
      targetPos: landedAt, // same fabricated "no progress" setup as the socialize test above
    };
    state.creatures.push(a, b);

    applyActivity(state, a, clock);

    expect(a.activity.id).toBe('court'); // the id-gated bail never fires for court
  });
});

describe('no creature walks on water', () => {
  it('b) a land creature stranded in the pond never steps deeper, and reaches shore within 40 ticks', () => {
    const state = bareWorld(5);
    // ~55 world units inside the true west edge of the pond (illegal for land).
    const c = makeCreature(1, 'rabbit', { x: POND.x - POND.rx * 0.9, y: POND.y });
    state.creatures.push(c);
    expect(isWater(c.pos)).toBe(true); // sanity: genuinely stranded

    const speed = speedFor('rabbit', 'adult');
    const rOf = (p: Vec2) =>
      Math.hypot((p.x - POND.x) / POND.rx, (p.y - POND.y) / POND.ry);

    let prevR = rOf(c.pos);
    let escaped = false;
    for (let t = 0; t < 40 && !escaped; t++) {
      wanderStep(state.rng, c, speed, 'land');
      const r = rOf(c.pos);
      // Never move deeper into the pond (normalized radius must not shrink).
      expect(r).toBeGreaterThanOrEqual(prevR - 1e-9);
      prevR = r;
      if (!isWater(c.pos)) escaped = true;
    }
    expect(escaped).toBe(true);

    // And once ashore, nearestRestable confirms it is genuinely legal land.
    expect(isWater(nearestRestable('land', c.pos))).toBe(false);
  });
});

/**
 * M13 Task 1 (RED): the measured 'gather' freeze. `'gather'` (state.ts's
 * ActivityId union) serves three purposes: (1) a baby leashed back toward
 * its family's home/feeding parent, (2) parents pottering during 'nesting',
 * (3) kin keeping a mourning vigil around a passing elder. behaviors.ts's
 * `case 'gather'` (~707-713) just walks toward the target with no arrival
 * check, and family.ts's baby-leash assignment (~528-547) only ever WRITES
 * `'gather'` when the child isn't already in it — there is no counterpart
 * that ever reads "arrived, release" for cases (1)/(2). Case (3) is the one
 * deliberate exception: it is supposed to hold for the full
 * PASS_GATHER_TICKS and is released explicitly by removeCreature
 * (family.ts:291-296) once the memorial forms. A prior exploration (not
 * committed as a test) measured ~25% of the population permanently frozen
 * in 'gather' over a 30,000-tick run, with streaks up to ~28,000 ticks.
 *
 * 1a and 1c are expected to FAIL right now — that failure IS the bug this
 * task exists to pin down. Task 2 (a different implementer) makes them
 * green. 1b is a regression pin for the mourning vigil, which is NOT
 * broken, and is expected to PASS as-is.
 */
describe('M13: the gather freeze bug (Thread 4)', () => {
  /** Literal copy of family.ts's module-private constant (same convention
   * as tests/pouch.test.ts): an accidental change to the real value should
   * fail a test here, not silently reshape what "vigil" means. */
  const PASS_GATHER_TICKS = 200;
  /** Generous cap: a real cross-valley chase is a few hundred ticks; the
   * measured bug produced streaks up to ~28,000. */
  const MAX_GATHER_STREAK = 1200;

  function bareWorld(seed: number): WorldState {
    const state = createWorld(seed);
    state.creatures = [];
    state.families = [];
    for (const h of state.homes) h.familyId = null;
    return state;
  }

  /**
   * A minimal rabbit family already in 'rearing', its home claimed, with one
   * baby positioned WELL WITHIN BABY_LEASH of the home — i.e. already
   * "arrived" — for test 1a to latch into 'gather' by hand and watch whether
   * the family system ever lets it back out.
   */
  function rearingBabyWorld(seed: number): {
    state: WorldState;
    mother: Creature;
    father: Creature;
    baby: Creature;
    fam: Family;
  } {
    const state = bareWorld(seed);
    const home = state.homes.find((h) => h.kind === 'burrow');
    if (!home) throw new Error('no burrow home in this valley');

    const mother = makeCreature(1, 'rabbit', { ...home.pos });
    mother.sex = 'f';
    const father = makeCreature(2, 'rabbit', { x: home.pos.x + 10, y: home.pos.y });
    father.sex = 'm';
    // 20 units from home: comfortably inside BABY_LEASH (140) — "arrived".
    const baby = makeCreature(3, 'rabbit', { x: home.pos.x + 20, y: home.pos.y });
    baby.stage = 'baby';

    const fam: Family = {
      id: state.nextId++,
      species: 'rabbit',
      parentIds: [mother.id, father.id],
      childIds: [baby.id],
      homeId: home.id,
      phase: 'rearing',
      phaseTicks: 0,
      dutyParent: 0,
    };
    state.families.push(fam);
    mother.familyId = fam.id;
    father.familyId = fam.id;
    baby.familyId = fam.id;
    home.familyId = fam.id;
    state.creatures.push(mother, father, baby);
    return { state, mother, father, baby, fam };
  }

  /**
   * Two rabbits (one about to pass) sharing a real Family entry in
   * state.families — required for removeCreature's mourner-release loop
   * (family.ts:291-296) to have anything to look up: that loop is gated
   * behind `fam` actually being found in state.families, not merely on
   * matching familyId.
   */
  function mourningWorld(seed: number): { state: WorldState; elder: Creature; kin: Creature; fam: Family } {
    const state = bareWorld(seed);
    const elder = makeCreature(1, 'rabbit', { x: 2000, y: 1500 });
    elder.ageTicks = elder.lifespanTicks + 1; // crosses the passing threshold on the next tick
    const kin = makeCreature(2, 'rabbit', { x: 2050, y: 1500 }); // well inside PASS_GATHER_RANGE (700)

    const fam: Family = {
      id: state.nextId++,
      species: 'rabbit',
      parentIds: [elder.id, kin.id],
      childIds: [],
      homeId: null,
      phase: 'emptyNest',
      phaseTicks: 0,
      dutyParent: 0,
    };
    state.families.push(fam);
    elder.familyId = fam.id;
    kin.familyId = fam.id;
    state.creatures.push(elder, kin);
    return { state, elder, kin, fam };
  }

  it('1a) a baby already arrived within the leash stays latched in gather forever [EXPECTED RED]', () => {
    const { state, baby } = rearingBabyWorld(9);
    baby.activity = { id: 'gather', ticks: 5, minTicks: 30, targetPos: { ...baby.pos } };

    familySystem(state);

    // This is the bug: nothing in family.ts's baby-leash code (nor
    // behaviors.ts's 'gather' case) ever releases an already-arrived baby.
    // Once Task 2 fixes it, this assertion should pass.
    expect(baby.activity.id).not.toBe('gather');
  });

  it('1b) the mourning vigil latches for its full PASS_GATHER_TICKS and is released only when the memorial forms [PIN — must stay green]', () => {
    const { state, elder, kin } = mourningWorld(4);

    tick(state, []); // tick 1: elder crosses the passing threshold; kin latches into 'gather'
    expect(elder.activity.id).toBe('pass');
    expect(kin.activity.id).toBe('gather');
    expect(kin.activity.minTicks).toBe(PASS_GATHER_TICKS);

    // Well short of the full vigil: kin must still be latched.
    for (let t = 0; t < 150; t++) tick(state, []); // total 151 ticks: elder.activity.ticks = 151 < 200
    expect(state.creatures.includes(elder)).toBe(true);
    expect(kin.activity.id).toBe('gather');

    // Carry the vigil past PASS_GATHER_TICKS: the elder's passing completes
    // and removeCreature releases the mourner.
    for (let t = 0; t < 60; t++) tick(state, []); // total 211 ticks, past the 201 needed to complete
    expect(state.creatures.includes(elder)).toBe(false);
    expect(kin.activity.id).not.toBe('gather');
  });

  it(
    '1c) property: no creature spends an unbounded streak in a non-vigil gather over a long run [EXPECTED RED]',
    () => {
      const seeds = [11, 23, 37];
      const TICKS = 30000;
      const perSeedResults: { seed: number; maxStreak: number; endFraction: number }[] = [];

      for (const seed of seeds) {
        const state = createWorld(seed);
        const streaks = new Map<number, number>();
        let maxStreak = 0;

        for (let t = 0; t < TICKS; t++) {
          tick(state, []);
          for (const c of state.creatures) {
            const nonVigilGather = c.activity.id === 'gather' && c.activity.minTicks < PASS_GATHER_TICKS;
            if (nonVigilGather) {
              const next = (streaks.get(c.id) ?? 0) + 1;
              streaks.set(c.id, next);
              if (next > maxStreak) maxStreak = next;
            } else if (streaks.has(c.id)) {
              streaks.set(c.id, 0);
            }
          }
        }

        const total = state.creatures.length;
        const stuckAtEnd = state.creatures.filter(
          (c) => c.activity.id === 'gather' && c.activity.minTicks < PASS_GATHER_TICKS,
        ).length;
        const endFraction = total === 0 ? 0 : stuckAtEnd / total;
        perSeedResults.push({ seed, maxStreak, endFraction });
      }

      for (const { seed, maxStreak, endFraction } of perSeedResults) {
        expect(maxStreak, `seed ${seed}: max non-vigil gather streak`).toBeLessThan(MAX_GATHER_STREAK);
        expect(endFraction, `seed ${seed}: fraction still stuck in gather at the end`).toBeLessThan(0.05);
      }
    },
    120000,
  );
});
