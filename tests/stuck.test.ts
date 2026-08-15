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
import { idOffsetAngle, socializeRing } from '../src/sim/behaviors';
import { moveToward, wanderStep } from '../src/sim/movement';
import { speedFor } from '../src/sim/species';
import { createWorld, type Creature, type SpeciesId, type Vec2, type WorldState } from '../src/sim/state';
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
