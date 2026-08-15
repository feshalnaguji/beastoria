/**
 * Movement media: koi never leave the pond, land creatures never enter it,
 * and amphibious ducks can walk right in.
 */
import { describe, expect, it } from 'vitest';
import { moveToward } from '../src/sim/movement';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { isWater, POND } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

/** Activities in which a creature holds still — it must be standing on something. */
const STOPPED = new Set(['idle', 'nap']);

/** Empty world (keeps homes) ready for hand-placed casts. */
function bareWorld(seed = 3): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  return state;
}

describe('movement media', () => {
  it('koi stay in the pond for days on end', () => {
    const state = bareWorld();
    for (let i = 0; i < 4; i++) {
      spawnCreature(state, 'koi', { x: POND.x - 100 + i * 60, y: POND.y + 40 }, 0.4);
    }
    // bareWorld() empties every species, so the population regulator (M5)
    // will wander in creatures of other, non-water species over a long run;
    // this test only cares about koi's own water-medium invariant.
    for (let s = 0; s < 80; s++) {
      runTicks(state, 50);
      for (const c of state.creatures.filter((c) => c.species === 'koi')) {
        expect(isWater(c.pos)).toBe(true);
      }
    }
  });

  it('land creatures never end up in the water; fliers only ever cross it', () => {
    const state = bareWorld();
    spawnCreature(state, 'rabbit', { x: 2500, y: 2000 }, 0.4); // near the shore
    spawnCreature(state, 'deer', { x: 2600, y: 1900 }, 0.4);
    // bareWorld() empties every species, so the population regulator (M5)
    // may wander in creatures of other species (including amphibious ducks,
    // which may legitimately enter the pond).
    for (let s = 0; s < 60; s++) {
      runTicks(state, 50);
      for (const c of state.creatures) {
        const p = SPECIES[c.species];
        if (p.medium === 'land') {
          expect(isWater(c.pos)).toBe(false);
        } else if (p.medium === 'air') {
          // M9: robins/owls/phoenixes fly over the pond, but they may never
          // come to rest on it — a stopped flier is always over dry land.
          if (STOPPED.has(c.activity.id)) expect(isWater(c.pos)).toBe(false);
        }
      }
    }
  });

  it('an amphibious duck walks into the pond; a land rabbit cannot', () => {
    const state = bareWorld();
    const duck = spawnCreature(state, 'duck', { x: 2400, y: 2300 }, 0.4);
    const rabbit = spawnCreature(state, 'rabbit', { x: 2400, y: 2250 }, 0.4);
    const target = { x: POND.x, y: POND.y };
    for (let i = 0; i < 500; i++) moveToward(duck, target, 6, 'amphibious');
    for (let i = 0; i < 500; i++) moveToward(rabbit, target, 6, 'land');
    expect(isWater(duck.pos)).toBe(true);
    expect(isWater(rabbit.pos)).toBe(false);
  });
});
