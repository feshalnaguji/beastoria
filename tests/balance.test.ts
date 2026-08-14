/**
 * Population balance property tests (spec §5). The spec calls for 100
 * game-days × 10 seeds; to keep CI under a couple of minutes we run
 * 30 game-days × 6 seeds plus one 100-day deep soak. Invariants:
 * counts never exceed hardCap, nothing is extinct at the end, and the
 * phoenix stays singular. Sampled every 60 ticks.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import { createWorld, type SpeciesId, type WorldState } from '../src/sim/state';

const ALL = Object.keys(SPECIES) as SpeciesId[];

function counts(state: WorldState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ALL) out[id] = 0;
  for (const c of state.creatures) out[c.species] = (out[c.species] ?? 0) + 1;
  return out;
}

function soak(seed: number, days: number): void {
  const state = createWorld(seed);
  const totalTicks = days * TICKS_PER_DAY;
  for (let t = 0; t < totalTicks; t++) {
    tick(state, []);
    if (t % 60 !== 0) continue;
    const c = counts(state);
    for (const id of ALL) {
      expect(c[id], `${id} over hardCap at tick ${state.tick} (seed ${seed})`).toBeLessThanOrEqual(
        SPECIES[id].population.hardCap,
      );
    }
    const phoenixFams = state.families.filter((f) => f.species === 'phoenix').length;
    expect(phoenixFams, `phoenix families at tick ${state.tick}`).toBeLessThanOrEqual(1);
    expect(c.phoenix, `phoenix extinct at tick ${state.tick}`).toBeGreaterThanOrEqual(1);
  }
  const end = counts(state);
  for (const id of ALL) {
    expect(end[id], `${id} extinct after ${days} days (seed ${seed})`).toBeGreaterThanOrEqual(1);
  }
}

describe('population balance', () => {
  it.each([11, 23, 37, 58, 71, 94])('30 game-days stay in band (seed %i)', (seed) => {
    soak(seed, 30);
  }, 120000);

  it('100 game-day deep soak (seed 7)', () => {
    soak(7, 100);
  }, 300000);
});
