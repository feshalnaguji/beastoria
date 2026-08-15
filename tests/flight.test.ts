/**
 * Birds own the sky (M9): robins, owls and the phoenix move through the 'air'
 * medium — a straight line over the pond is legal — but they only ever come
 * to rest on ground their landing medium allows.
 */
import { describe, expect, it } from 'vitest';
import { moveToward } from '../src/sim/movement';
import { tick } from '../src/sim/Sim';
import { SPECIES, speedFor } from '../src/sim/species';
import { createWorld, spawnCreature, type SpeciesId, type WorldState } from '../src/sim/state';
import { canOccupy, isWater, POND } from '../src/sim/valley';

const ALL = Object.keys(SPECIES) as SpeciesId[];
/** Activities in which a creature holds still — it must be standing on something. */
const STOPPED = new Set(['idle', 'nap']);

/** Empty world (keeps homes) ready for hand-placed casts. */
function bareWorld(seed: number): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  return state;
}

describe('the air medium', () => {
  it('canOccupy("air") is true everywhere, the pond included', () => {
    expect(canOccupy('air', { x: POND.x, y: POND.y })).toBe(true);
    expect(canOccupy('air', { x: 2048, y: 1536 })).toBe(true);
  });

  it('robin, owl and phoenix fly; everyone else keeps their medium', () => {
    for (const id of ['robin', 'owl', 'phoenix'] as const) {
      expect(SPECIES[id].medium).toBe('air');
      expect(SPECIES[id].landingMedium).toBe('land');
    }
    expect(ALL.filter((id) => SPECIES[id].medium === 'air').sort()).toEqual([
      'owl',
      'phoenix',
      'robin',
    ]);
    expect(SPECIES.koi.medium).toBe('water');
    expect(SPECIES.duck.medium).toBe('amphibious');
    expect(SPECIES.rabbit.medium).toBe('land');
  });

  it('a robin crosses the pond in a straight line; a rabbit cannot', () => {
    const state = bareWorld(17);
    // West shore, clearly dry (a safe margin outside the pond ellipse — not
    // razor's-edge on the boundary, which made this scenario sensitive to
    // the spawned creature's random initial heading; see M10 task 3's
    // justification table for why that heading now differs for seed 17).
    const robin = spawnCreature(state, 'robin', { x: 2500, y: 2300 }, 0.4);
    const target = { x: 3700, y: 2300 }; // dry land due east — straight through the water
    const speed = speedFor('robin', 'adult');
    let ticksTaken = -1;
    let crossedWater = false;
    for (let i = 0; i < 400; i++) {
      moveToward(robin, target, speed, 'air', 'land');
      if (isWater(robin.pos)) crossedWater = true;
      if (Math.hypot(robin.pos.x - target.x, robin.pos.y - target.y) <= 60) {
        ticksTaken = i + 1;
        break;
      }
    }
    expect(crossedWater).toBe(true); // it flew over, it did not detour
    expect(ticksTaken).toBeGreaterThan(0);
    expect(ticksTaken).toBeLessThan(400);

    const rabbit = spawnCreature(state, 'rabbit', { x: 2500, y: 2300 }, 0.4);
    for (let i = 0; i < 400; i++) {
      moveToward(rabbit, target, speedFor('rabbit', 'adult'), 'land');
      expect(isWater(rabbit.pos)).toBe(false);
    }
  });

  it('an air creature never comes to rest over water, and never forages into it', () => {
    const state = bareWorld(23);
    // Dry shores either side of the pond: their nearest food spots are the
    // reeds all round it, so foraging means real crossings.
    const shores = [
      { x: 2400, y: 2050 },
      { x: 2440, y: 2050 },
      { x: 2480, y: 2050 },
      { x: 3760, y: 2300 },
      { x: 3800, y: 2300 },
    ];
    for (const pos of shores) {
      const robin = spawnCreature(state, 'robin', pos, 0.4);
      expect(isWater(robin.pos)).toBe(false);
    }
    let overWaterTicks = 0;
    for (let t = 0; t < 8000; t++) {
      tick(state, []);
      for (const c of state.creatures) {
        if (SPECIES[c.species].medium !== 'air') continue;
        if (isWater(c.pos)) overWaterTicks++;
        if (STOPPED.has(c.activity.id)) expect(isWater(c.pos)).toBe(false);
        const target = c.activity.targetPos;
        if (c.activity.id === 'forage' && target) expect(isWater(target)).toBe(false);
      }
    }
    // …and the invariant isn't vacuous: they really do fly out over the pond.
    expect(overWaterTicks).toBeGreaterThan(0);
  }, 20000);

  it('a lone owl stranded over the pond gets itself ashore instead of parking', () => {
    // The hole this covers: a flier with NO same-species neighbour (owl floor
    // is 2; the phoenix is routinely singular after a passing) and every
    // reason to stop — pinned rest at midday makes 'nap' the runaway winner,
    // and it has no partner, so the socialize fallback fires too. Stopped
    // activities must be dropped from the running, not merely blocked.
    const state = bareWorld(41);
    state.tick = 2400 * 10 + 720; // midday: an owl's deepest sleep pressure
    const owl = spawnCreature(state, 'owl', { x: POND.x, y: POND.y }, 0.4);
    owl.activity = { id: 'idle', ticks: 0, minTicks: 80 }; // parked on open water
    expect(isWater(owl.pos)).toBe(true);

    let ashoreAt = -1;
    for (let t = 0; t < 600; t++) {
      // Keep it a genuine singleton: hold off the wanderer failsafe so no
      // second owl ever arrives to be its partner.
      state.lastWandererTick.owl = state.tick;
      owl.needs = { hunger: 1, rest: 1, social: 1 };
      tick(state, []);
      if (ashoreAt < 0 && !isWater(owl.pos)) ashoreAt = t;
      // Never at rest over the water — from the very first tick onwards.
      if (STOPPED.has(owl.activity.id)) expect(isWater(owl.pos)).toBe(false);
    }
    expect(ashoreAt).toBeGreaterThanOrEqual(0);
    expect(ashoreAt).toBeLessThan(400);
  }, 20000);
});
