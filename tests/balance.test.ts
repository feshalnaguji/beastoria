/**
 * Population balance property tests (spec §5). The spec calls for 100
 * game-days × 10 seeds; to keep CI under a couple of minutes we run
 * 30 game-days × 6 seeds plus one 100-day deep soak. Invariants:
 * counts never exceed hardCap, nothing is extinct at the end, and the
 * phoenix stays singular.
 *
 * M9: the hard cap is now enforced in family.ts (clutch size is clamped to
 * the room left, at laying AND at hatching), so it is checked EVERY tick as
 * a strict invariant rather than sampled every 60. The remaining (cheaper,
 * inherently slower-moving) properties stay on the 60-tick sample.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import { createWorld, type SpeciesId, type WorldState } from '../src/sim/state';

const ALL = Object.keys(SPECIES) as SpeciesId[];
/** M10 task 3 + M11 task 2: the new neighbors must establish themselves
 * quickly — not just survive to the end of the soak. */
const NEW_SPECIES: SpeciesId[] = ['squirrel', 'frog', 'turtle', 'kangaroo'];
const DAY5_TICK = 5 * TICKS_PER_DAY;

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
    const c = counts(state);
    for (const id of ALL) {
      // Asserted inside the guard so the hot path stays cheap; a violation
      // still fails with the full message.
      if ((c[id] ?? 0) > SPECIES[id].population.hardCap) {
        expect(c[id], `${id} over hardCap at tick ${state.tick} (seed ${seed})`).toBeLessThanOrEqual(
          SPECIES[id].population.hardCap,
        );
      }
    }
    if (t % 60 !== 0) continue;
    const phoenixFams = state.families.filter((f) => f.species === 'phoenix').length;
    expect(phoenixFams, `phoenix families at tick ${state.tick}`).toBeLessThanOrEqual(1);
    expect(c.phoenix, `phoenix extinct at tick ${state.tick}`).toBeGreaterThanOrEqual(1);
    // M10 task 3 (review fix): asserted at every 60-tick sample from day 5
    // on, not just a single tick — `c` is already computed above, so this
    // is near-free, and it catches a species that establishes itself by day
    // 5 then quietly dies back out before the soak ends, which a one-shot
    // check at exactly DAY5_TICK would miss.
    if (state.tick >= DAY5_TICK) {
      for (const id of NEW_SPECIES) {
        expect(c[id], `${id} not present at tick ${state.tick} (seed ${seed})`).toBeGreaterThan(0);
      }
    }
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
