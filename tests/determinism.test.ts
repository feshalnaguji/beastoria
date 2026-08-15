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
    // toEqual (value equality) rather than a raw JSON string compare: an
    // object field reset to `undefined` (e.g. Activity.targetPos when a
    // creature has no target) is a real, present key on a live object, but
    // JSON.stringify silently drops undefined-valued keys — so a save/load
    // round trip (see the test below) can leave a semantically-identical
    // object with a different *key insertion order* than one that was never
    // serialized. toEqual treats `{x: undefined}` and `{}` as equal and
    // ignores key order, matching what "identical world" actually means;
    // JSON.stringify equality was an accidentally-over-strict proxy for it.
    expect(a).toEqual(b);
  });

  it('different seeds diverge', () => {
    const a = createWorld(1);
    const b = createWorld(2);
    runTicks(a, 100);
    runTicks(b, 100);
    expect(a).not.toEqual(b);
  });

  it('save-mid-run then resume matches an uninterrupted run', () => {
    const straight = createWorld(7);
    runTicks(straight, TICKS);

    const first = createWorld(7);
    runTicks(first, TICKS / 2);
    const resumed = JSON.parse(JSON.stringify(first)) as WorldState; // simulate save/load
    runTicks(resumed, TICKS / 2);

    expect(resumed).toEqual(straight);
  });
});
