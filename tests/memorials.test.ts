/**
 * Memorial lifecycle: memorials bloom, linger, then return to the meadow.
 * Pruned MEMORIAL_TICKS (2 game-days) after they're placed — deterministic,
 * array filter, no RNG draws.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';

describe('memorial lifecycle', () => {
  it('prunes memorials older than MEMORIAL_TICKS and keeps fresh ones', () => {
    const state = createWorld(3);
    state.tick = 4700;
    state.memorials.push({ pos: { x: 2000, y: 1500 }, species: 'rabbit', tick: 0 });

    for (let i = 0; i < 200; i++) tick(state, []);
    expect(state.memorials.some((m) => m.tick === 0)).toBe(false);

    state.memorials.push({ pos: { x: 2000, y: 1500 }, species: 'rabbit', tick: state.tick });
    for (let i = 0; i < 10; i++) tick(state, []);
    expect(state.memorials.some((m) => m.pos.x === 2000 && m.pos.y === 1500)).toBe(true);
  });
});
