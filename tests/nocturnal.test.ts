/**
 * The owl keeps night hours: with identical mild needs, an owl naps at midday
 * and is out and about at midnight — exactly opposite the diurnal robin.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { isWater } from '../src/sim/valley';

function soloWorld(species: 'owl' | 'robin', atDayFrac: number): WorldState {
  const state = createWorld(9);
  state.creatures = [];
  state.families = [];
  state.tick = Math.floor(TICKS_PER_DAY * 10 + TICKS_PER_DAY * atDayFrac);
  const c = spawnCreature(state, species, { x: 2000, y: 1500 }, 0.4);
  c.needs = { hunger: 0.3, rest: 0.3, social: 0 };
  return state;
}

function activitiesOver(state: WorldState, n: number): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    tick(state, []);
    const c = state.creatures[0];
    if (c) seen.add(c.activity.id);
  }
  return seen;
}

describe('nocturnal owls', () => {
  it('owl naps at midday', () => {
    expect(activitiesOver(soloWorld('owl', 0.3), 40).has('nap')).toBe(true);
  });
  it('owl is active (never naps) at midnight', () => {
    expect(activitiesOver(soloWorld('owl', 0.8), 40).has('nap')).toBe(false);
  });
  it('robin does the reverse: active at midday, napping at midnight', () => {
    expect(activitiesOver(soloWorld('robin', 0.3), 40).has('nap')).toBe(false);
    expect(activitiesOver(soloWorld('robin', 0.8), 40).has('nap')).toBe(true);
  });
});

describe('starting world', () => {
  it('koi start in the pond; every creature starts somewhere it can be', () => {
    const state = createWorld(1234);
    for (const c of state.creatures) {
      if (c.species === 'koi') expect(isWater(c.pos)).toBe(true);
      else expect(isWater(c.pos)).toBe(false);
    }
  });
  it('homes exist for every home kind', () => {
    const state = createWorld(1);
    const kinds = new Set(state.homes.map((h) => h.kind));
    for (const k of ['burrow', 'treeNest', 'reedNest', 'lilyPatch', 'treeHollow', 'glade', 'groundNest', 'groveNest']) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });
});
