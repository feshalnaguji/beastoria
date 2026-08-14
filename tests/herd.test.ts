/**
 * Deer keep loose company: scattered to the corners of the valley, the herd
 * drifts back together within a couple of game days.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';

function meanDistToCentroid(state: WorldState): number {
  const deer = state.creatures.filter((c) => c.species === 'deer');
  const cx = deer.reduce((s, c) => s + c.pos.x, 0) / deer.length;
  const cy = deer.reduce((s, c) => s + c.pos.y, 0) / deer.length;
  return deer.reduce((s, c) => s + Math.hypot(c.pos.x - cx, c.pos.y - cy), 0) / deer.length;
}

describe('deer herd cohesion', () => {
  it('a scattered herd regathers', () => {
    const state = createWorld(21);
    state.creatures = [];
    state.families = [];
    const corners = [
      { x: 400, y: 400 },
      { x: 3700, y: 400 },
      { x: 400, y: 2700 },
      { x: 3700, y: 2700 },
      { x: 2000, y: 1500 },
    ];
    for (const pos of corners) spawnCreature(state, 'deer', pos, 0.4);
    const before = meanDistToCentroid(state);
    for (let i = 0; i < 5000; i++) tick(state, []);
    const after = meanDistToCentroid(state);
    expect(after).toBeLessThan(before * 0.5);
    expect(after).toBeLessThan(600);
  }, 20000);
});
