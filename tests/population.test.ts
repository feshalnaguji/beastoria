/**
 * The wanderer failsafe (spec §4.3 layer 2): when a species falls below its
 * floor — or its singles are all one sex — a new adult wanders in from the
 * map edge. Canonically, this is how dodos keep finding the valley.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { isWater } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

function count(state: WorldState, species: string): number {
  return state.creatures.filter((c) => c.species === species).length;
}

describe('wanderer arrivals', () => {
  it('a vanished dodo population is refounded from the map edge', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'dodo');
    runTicks(state, 2500);
    expect(count(state, 'dodo')).toBeGreaterThan(0);
    expect(state.eventLog.some((e) => e.kind === 'wandererArrived' && e.species === 'dodo')).toBe(true);
  });

  it('arrivals trickle in on a cooldown, never a flood', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'dodo');
    runTicks(state, 1900);
    const arrivals = state.eventLog.filter(
      (e) => e.kind === 'wandererArrived' && e.species === 'dodo',
    ).length;
    expect(arrivals).toBe(1);
  });

  it('two bachelor ducks attract a female wanderer', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'duck');
    state.families = state.families.filter((f) => f.species !== 'duck');
    for (let i = 0; i < 3; i++) {
      const d = spawnCreature(state, 'duck', { x: 2850 + i * 30, y: 2000 }, 0.4);
      d.sex = 'm';
    }
    runTicks(state, 2500);
    expect(state.creatures.some((c) => c.species === 'duck' && c.sex === 'f')).toBe(true);
  });

  it('a koi wanderer arrives in the water, not on a hilltop', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'koi');
    runTicks(state, 2500);
    const koi = state.creatures.filter((c) => c.species === 'koi');
    expect(koi.length).toBeGreaterThan(0);
    for (const k of koi) expect(isWater(k.pos)).toBe(true);
  });

  it('the phoenix never wanders in', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'phoenix');
    state.families = state.families.filter((f) => f.species !== 'phoenix');
    runTicks(state, 5000);
    expect(state.eventLog.some((e) => e.kind === 'wandererArrived' && e.species === 'phoenix')).toBe(false);
  });
});
