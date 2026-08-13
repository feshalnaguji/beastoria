/**
 * The architecture-guarding test: same seed ⇒ identical world; and a run that
 * is saved (serialized) midway and resumed must match an uninterrupted run.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, type WorldState } from '../src/sim/state';

const TICKS = 5000;

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

describe('sim determinism', () => {
  it('same seed produces identical state after many ticks', () => {
    const a = createWorld(42);
    const b = createWorld(42);
    runTicks(a, TICKS);
    runTicks(b, TICKS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds diverge', () => {
    const a = createWorld(1);
    const b = createWorld(2);
    runTicks(a, 100);
    runTicks(b, 100);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('save-mid-run then resume matches an uninterrupted run', () => {
    const straight = createWorld(7);
    runTicks(straight, TICKS);

    const first = createWorld(7);
    runTicks(first, TICKS / 2);
    const resumed = JSON.parse(JSON.stringify(first)) as WorldState; // simulate save/load
    runTicks(resumed, TICKS / 2);

    expect(JSON.stringify(resumed)).toBe(JSON.stringify(straight));
  });
});
