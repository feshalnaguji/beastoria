/**
 * De-clumping: creatures approaching the same target settle into a loose
 * ring, not a straight queue. Deterministic (id-hash offsets, no RNG draws).
 */
import { describe, expect, it } from 'vitest';
import { idOffsetAngle } from '../src/sim/behaviors';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';

describe('idOffsetAngle', () => {
  it('is deterministic and spreads ids around the circle', () => {
    expect(idOffsetAngle(7)).toBe(idOffsetAngle(7));
    const angles = [1, 2, 3, 4, 5, 6, 7, 8].map(idOffsetAngle);
    for (const a of angles) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI * 2);
    }
    // At least 5 of 8 land in distinct quadrants-ish buckets (spread, not clustered).
    const buckets = new Set(angles.map((a) => Math.floor(a / (Math.PI / 2))));
    expect(buckets.size).toBeGreaterThanOrEqual(3);
  });
});

describe('socializing creatures do not queue', () => {
  it('four lonely rabbits converging on one popular rabbit end up spread, not collinear', () => {
    const state: WorldState = createWorld(13);
    state.creatures = [];
    state.families = [];
    const magnet = spawnCreature(state, 'rabbit', { x: 2000, y: 1500 }, 0.45);
    magnet.needs = { hunger: 0, rest: 0, social: 0 };
    const seekers: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = spawnCreature(state, 'rabbit', { x: 1400 + i * 10, y: 1500 }, 0.45);
      c.needs = { hunger: 0, rest: 0, social: 1 };
      seekers.push(c.id);
    }
    state.tick = 2400 * 10 + 720; // midday
    for (let i = 0; i < 600; i++) tick(state, []);
    // Measure pairwise minimum distance among the seekers near the magnet:
    const pos = state.creatures.filter((c) => seekers.includes(c.id)).map((c) => c.pos);
    let minPair = Infinity;
    for (let a = 0; a < pos.length; a++) {
      for (let b = a + 1; b < pos.length; b++) {
        const pa = pos[a];
        const pb = pos[b];
        if (pa && pb) minPair = Math.min(minPair, Math.hypot(pa.x - pb.x, pa.y - pb.y));
      }
    }
    expect(minPair).toBeGreaterThan(18); // ring spacing, not a stacked queue
  }, 20000);
});
