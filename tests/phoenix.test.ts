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

/**
 * The grove leash (M9): an unattached phoenix that strays past GROVE_LEASH
 * (420) turns for the ancient tree. It can overshoot by at most one steering
 * arc — a few ticks at speed 7 while it comes about — so 500 is the analytic
 * hard bound, and it holds every tick rather than only at the end.
 */
const GROVE_BOUND = 500;

function distToNest(p: { x: number; y: number }): number {
  return Math.hypot(p.x - GROVE_NEST.x, p.y - GROVE_NEST.y);
}

describe('phoenix rebirth', () => {
  it('a passing elder leaves a new chick at the grove, and it stays there', () => {
    const state = createWorld(55);
    for (const p of phoenixes(state)) p.ageTicks = p.lifespanTicks - 20;
    let maxStray = 0;
    for (let i = 0; i < 600; i++) {
      tick(state, []);
      for (const c of phoenixes(state)) {
        if (c.familyId === null) maxStray = Math.max(maxStray, distToNest(c.pos));
      }
    }
    const reborn = state.eventLog.find((e) => e.kind === 'reborn');
    expect(reborn).toBeDefined();
    // Left in soft embers at the nest itself.
    if (reborn?.pos) expect(distToNest(reborn.pos)).toBeLessThan(40);
    const flock = phoenixes(state);
    expect(flock.length).toBeGreaterThan(0);
    const chick = flock.find((c) => c.stage === 'baby');
    expect(chick).toBeDefined();
    if (chick) expect(distToNest(chick.pos)).toBeLessThan(GROVE_BOUND);
    // The leash holds for the whole run, not just at the end.
    expect(maxStray).toBeGreaterThan(0);
    expect(maxStray).toBeLessThan(GROVE_BOUND);
  });

  it('unattached phoenixes never wander off across the valley', () => {
    const state = createWorld(12);
    for (const p of phoenixes(state)) p.ageTicks = p.lifespanTicks - 20;
    let maxStray = 0;
    for (let i = 0; i < 8000; i++) {
      tick(state, []);
      for (const c of phoenixes(state)) {
        if (c.familyId === null) maxStray = Math.max(maxStray, distToNest(c.pos));
      }
    }
    expect(maxStray).toBeGreaterThan(GROVE_BOUND * 0.5); // they do roam the grove…
    expect(maxStray).toBeLessThan(GROVE_BOUND); // …but never leave it
  }, 30000);

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

  it('a family with no living parents left is dissolved so rebirth orphans grow up free', () => {
    const state = createWorld(55);
    // Let the starting pair court and nest so the grove home is claimed.
    runTicks(state, 350);
    const fam = state.families.find((f) => f.species === 'phoenix');
    expect(fam).toBeDefined();
    const groveHome = state.homes.find((h) => h.kind === 'groveNest');
    expect(groveHome?.familyId).toBe(fam?.id);

    // Both parents die of old age together.
    for (const p of phoenixes(state)) p.ageTicks = p.lifespanTicks - 20;
    runTicks(state, 800);

    expect(state.families.some((f) => f.species === 'phoenix')).toBe(false);
    const flock = phoenixes(state);
    const orphanChicks = flock.filter((c) => c.familyId === null);
    expect(orphanChicks.length).toBeGreaterThan(0);
    expect(groveHome?.familyId).toBeNull();
  });
});
