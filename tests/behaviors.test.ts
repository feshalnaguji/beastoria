/**
 * Needs + utility behavior selection: creatures forage when hungry (by day),
 * nap when tired (especially at night), socialize when lonely, and never
 * flicker between activities thanks to hysteresis.
 */
import { describe, expect, it } from 'vitest';
import { isMourningGather } from '../src/sim/behaviors';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { createWorld, type Creature, type Family, type WorldState } from '../src/sim/state';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

/** A world trimmed to `n` creatures for focused tests. */
function worldWith(n: number, seed = 5): WorldState {
  const state = createWorld(seed);
  state.creatures = state.creatures.slice(0, n);
  return state;
}

function firstCreature(state: WorldState): Creature {
  const c = state.creatures[0];
  if (!c) throw new Error('world has no creatures');
  return c;
}

describe('needs', () => {
  it('creatures have hunger/rest/social needs that stay in [0,1]', () => {
    const state = worldWith(1);
    runTicks(state, TICKS_PER_DAY * 2);
    const c = firstCreature(state);
    for (const value of [c.needs.hunger, c.needs.rest, c.needs.social]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('hunger rises over time when not eating', () => {
    const state = worldWith(1);
    const c = firstCreature(state);
    c.needs.hunger = 0;
    c.needs.rest = 0;
    c.needs.social = 0;
    runTicks(state, 200);
    expect(c.needs.hunger).toBeGreaterThan(0);
  });
});

describe('behavior selection', () => {
  it('a very hungry creature forages during the day and its hunger falls', () => {
    const state = worldWith(1);
    state.tick = Math.floor(TICKS_PER_DAY * 0.2); // midday
    const c = firstCreature(state);
    c.needs.hunger = 1;
    c.needs.rest = 0;
    c.needs.social = 0;
    runTicks(state, 400);
    expect(c.needs.hunger).toBeLessThan(1);
  });

  it('a tired creature at night naps and its rest need falls', () => {
    const state = worldWith(1);
    state.tick = Math.floor(TICKS_PER_DAY * 0.8); // deep night
    const c = firstCreature(state);
    c.needs.hunger = 0;
    c.needs.rest = 1;
    c.needs.social = 0;
    runTicks(state, 60);
    expect(c.activity.id).toBe('nap');
    runTicks(state, 400);
    expect(c.needs.rest).toBeLessThan(1);
  });

  it('napping creatures do not move', () => {
    const state = worldWith(1);
    state.tick = Math.floor(TICKS_PER_DAY * 0.8);
    const c = firstCreature(state);
    c.needs.hunger = 0;
    c.needs.rest = 1;
    c.needs.social = 0;
    runTicks(state, 60);
    expect(c.activity.id).toBe('nap');
    const before = { x: c.pos.x, y: c.pos.y };
    runTicks(state, 100);
    expect(c.pos.x).toBe(before.x);
    expect(c.pos.y).toBe(before.y);
  });

  it('two lonely creatures move toward each other and social need falls', () => {
    const state = worldWith(2);
    state.tick = Math.floor(TICKS_PER_DAY * 0.2); // midday
    const [a, b] = state.creatures;
    if (!a || !b) throw new Error('need two creatures');
    a.pos = { x: 1500, y: 1500 };
    b.pos = { x: 2100, y: 1900 };
    for (const c of [a, b]) {
      c.needs.hunger = 0;
      c.needs.rest = 0;
      c.needs.social = 1;
    }
    const distBefore = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    runTicks(state, 300);
    const distAfter = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    expect(distAfter).toBeLessThan(distBefore);
    runTicks(state, 500);
    expect(a.needs.social).toBeLessThan(1);
  });

  it('hysteresis: activities do not flicker (few switches per simulated hour)', () => {
    const state = worldWith(1, 11);
    const c = firstCreature(state);
    let switches = 0;
    let last = c.activity.id;
    const oneHour = 600; // 1 sim hour = 1/24 day × 2400 ticks... generous window
    for (let i = 0; i < oneHour; i++) {
      tick(state, []);
      if (c.activity.id !== last) {
        switches++;
        last = c.activity.id;
      }
    }
    expect(switches).toBeLessThan(12);
  });
});

/**
 * M13 Task 2 (2a): a live regression pin for the shared discriminator.
 * `isMourningGather` and family.ts's `PASS_GATHER_TICKS` are defined from the
 * same `MOURNING_GATHER_MIN_TICKS` constant already, so they cannot drift
 * apart in the source — but nothing previously asserted that the discriminator
 * actually recognizes what `handlePassings` (family.ts) really assigns to a
 * mourning kin. This drives the real code path (Sim.tick, not a hand-built
 * activity literal) so a future change to either side — the vigil's own
 * `minTicks`, or the discriminator's threshold — fails here first.
 */
describe('isMourningGather (M13): matches what handlePassings actually assigns', () => {
  it('is true for the mourning vigil a kin is latched into when an elder passes', () => {
    const state = createWorld(9);
    state.creatures = [];
    state.families = [];

    const elder: Creature = {
      id: state.nextId++,
      species: 'rabbit',
      sex: 'f',
      familyId: null,
      pos: { x: 2000, y: 1500 },
      heading: 0,
      stage: 'adult',
      ageTicks: 20001,
      lifespanTicks: 20000, // already past its lifespan: passes on the next tick
      needs: { hunger: 0.2, rest: 0.2, social: 0.2 },
      activity: { id: 'idle', ticks: 0, minTicks: 0 },
    };
    const kin: Creature = {
      id: state.nextId++,
      species: 'rabbit',
      sex: 'm',
      familyId: null,
      pos: { x: 2050, y: 1500 }, // well within family.ts's PASS_GATHER_RANGE
      heading: 0,
      stage: 'adult',
      ageTicks: 5000,
      lifespanTicks: 20000,
      needs: { hunger: 0.2, rest: 0.2, social: 0.2 },
      activity: { id: 'idle', ticks: 0, minTicks: 0 },
    };
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

    tick(state, []); // elder crosses the passing threshold; kin latches into the vigil

    expect(elder.activity.id).toBe('pass');
    expect(kin.activity.id).toBe('gather');
    // The live check: exactly what handlePassings assigned reads as a
    // mourning vigil, not one of 'gather's two other, much shorter reuses.
    expect(isMourningGather(kin.activity)).toBe(true);
  });

  it('is false for a fresh idle activity and for gather\'s two other, much shorter reuses', () => {
    expect(isMourningGather({ id: 'idle', ticks: 0, minTicks: 1000 })).toBe(false);
    // Nest-building potter / baby leash minTicks (30 and 0) — both well
    // under MOURNING_GATHER_MIN_TICKS (200).
    expect(isMourningGather({ id: 'gather', ticks: 0, minTicks: 30 })).toBe(false);
    expect(isMourningGather({ id: 'gather', ticks: 0, minTicks: 0 })).toBe(false);
  });
});
