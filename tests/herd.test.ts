/**
 * Deer keep loose company: scattered across the mid-map (away from the world
 * edges, so wanderStep's edge-avoidance can't fake the convergence), the herd
 * drifts back together within a couple of game days via real herd cohesion.
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
    // Mid-map spread, well clear of the world edges (EDGE_MARGIN=120), so
    // wanderStep's edge-avoidance pull-to-center cannot be the thing that
    // converges the herd — only real herd cohesion can.
    const spread = [
      { x: 1200, y: 1000 },
      { x: 2900, y: 1000 },
      { x: 1200, y: 2100 },
      { x: 2900, y: 2100 },
      { x: 2050, y: 1550 },
    ];
    for (const pos of spread) spawnCreature(state, 'deer', pos, 0.4);
    const before = meanDistToCentroid(state);
    for (let i = 0; i < 5000; i++) tick(state, []);
    const after = meanDistToCentroid(state);
    expect(after).toBeLessThan(before * 0.5);
    expect(after).toBeLessThan(350);
  }, 20000);
});
