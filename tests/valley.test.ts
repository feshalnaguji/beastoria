/**
 * Valley zones: single source of truth in the sim (render reads the same data).
 * Land creatures must never end up in water — steering and forage targets
 * both respect the pond.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';
import { SPECIES } from '../src/sim/species';
import { isWater, zoneAt, POND } from '../src/sim/valley';

describe('valley zones', () => {
  it('the pond center is water; the meadow center is not', () => {
    expect(isWater({ x: POND.x, y: POND.y })).toBe(true);
    expect(isWater({ x: 2048, y: 1536 })).toBe(false);
  });

  it('zoneAt distinguishes pond, forest, grove, and meadow', () => {
    expect(zoneAt({ x: POND.x, y: POND.y })).toBe('pond');
    expect(zoneAt({ x: 900, y: 800 })).toBe('forest');
    expect(zoneAt({ x: 2300, y: 400 })).toBe('grove');
    expect(zoneAt({ x: 2048, y: 1800 })).toBe('meadow');
  });

  it('land creatures never enter water over a long run', () => {
    const state = createWorld(99);
    for (let i = 0; i < 8000; i++) {
      tick(state, []);
      for (const c of state.creatures) {
        // Water/amphibious species (koi, duck) are expected in the pond; this
        // check is only about creatures whose medium is strictly 'land'.
        if (SPECIES[c.species].medium !== 'land') continue;
        expect(isWater(c.pos)).toBe(false);
      }
    }
  });

  it('a creature dropped near the pond edge steers back to dry land', () => {
    const state = createWorld(3);
    state.creatures = state.creatures.slice(0, 1);
    const c = state.creatures[0];
    if (!c) throw new Error('no creature');
    // Just outside the pond, headed straight for the middle of it.
    c.pos = { x: POND.x - POND.rx - 30, y: POND.y };
    c.heading = 0; // pointing +x, into the pond
    for (let i = 0; i < 500; i++) {
      tick(state, []);
      expect(isWater(c.pos)).toBe(false);
    }
  });
});
