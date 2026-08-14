/**
 * The phoenix (spec §4.3 layer 3): exactly one family ever, and an elder's
 * passing IS the rebirth — a new chick left in soft embers at the grove.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { GROVE_NEST } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

function phoenixes(state: WorldState) {
  return state.creatures.filter((c) => c.species === 'phoenix');
}

describe('phoenix rebirth', () => {
  it('a passing elder leaves a new chick at the grove', () => {
    const state = createWorld(55);
    for (const p of phoenixes(state)) p.ageTicks = p.lifespanTicks - 20;
    runTicks(state, 600);
    expect(state.eventLog.some((e) => e.kind === 'reborn')).toBe(true);
    const flock = phoenixes(state);
    expect(flock.length).toBeGreaterThan(0);
    const chick = flock.find((c) => c.stage === 'baby');
    expect(chick).toBeDefined();
    if (chick) {
      expect(Math.hypot(chick.pos.x - GROVE_NEST.x, chick.pos.y - GROVE_NEST.y)).toBeLessThan(200);
    }
  });

  it('the world never has more than one phoenix family', () => {
    const state = createWorld(55);
    // Tempt fate: four extra unattached adults right at the grove.
    for (let i = 0; i < 4; i++) {
      spawnCreature(state, 'phoenix', { x: 2280 + i * 20, y: 460 }, 0.4);
    }
    for (let i = 0; i < 8000; i++) {
      tick(state, []);
      const fams = state.families.filter((f) => f.species === 'phoenix').length;
      expect(fams).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('phoenixes never disappear from an untouched world', () => {
    const state = createWorld(55);
    for (let s = 0; s < 100; s++) {
      runTicks(state, 240);
      expect(phoenixes(state).length).toBeGreaterThan(0);
    }
  }, 60000);
});
