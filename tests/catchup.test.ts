/**
 * Offline catch-up (spec §4.6): quarter-speed owed ticks capped at 2 game
 * days; chunked execution is equivalent to one straight run; the welcome-
 * back summary tells the story of the eventLog delta.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { owedTicks, runCatchUp, summarizeEvents } from '../src/app/CatchUp';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';
import type { SimEvent } from '../src/sim/events';

describe('owedTicks', () => {
  it('runs at quarter speed: 400ms away = 1 tick owed', () => {
    expect(owedTicks(400)).toBe(1);
    expect(owedTicks(4000)).toBe(10);
  });
  it('caps at two game days', () => {
    expect(owedTicks(1000 * 60 * 60 * 24 * 7)).toBe(2 * TICKS_PER_DAY);
  });
  it('never goes negative or fractional', () => {
    expect(owedTicks(-5000)).toBe(0);
    expect(owedTicks(399)).toBe(0);
  });
});

describe('runCatchUp', () => {
  it('chunked catch-up equals one straight run', () => {
    const straight = createWorld(11);
    for (let i = 0; i < 3000; i++) tick(straight, []);

    const chunked = createWorld(11);
    let remaining = 3000;
    while (remaining > 0) {
      const res = runCatchUp(chunked, remaining, 1000, () => 0); // no real budget clock
      remaining -= res.ticksRun;
    }
    expect(JSON.stringify(chunked)).toBe(JSON.stringify(straight));
  });

  it('respects the time budget per slice', () => {
    const state = createWorld(11);
    let calls = 0;
    // A fake clock that exhausts the 8ms budget after 5 ticks.
    const nowFn = (): number => {
      calls++;
      return calls * 2;
    };
    const res = runCatchUp(state, 1000, 8, nowFn);
    expect(res.done).toBe(false);
    expect(res.ticksRun).toBeGreaterThan(0);
    expect(res.ticksRun).toBeLessThan(1000);
  });
});

describe('summarizeEvents', () => {
  it('tells the story since the save', () => {
    const events: SimEvent[] = [
      { kind: 'hatched', tick: 100, species: 'duck', count: 3 },
      { kind: 'hatched', tick: 900, species: 'robin', count: 2 },
      { kind: 'passed', tick: 950, species: 'rabbit' },
      { kind: 'wandererArrived', tick: 990, species: 'dodo' },
      { kind: 'reborn', tick: 995, species: 'phoenix' },
      { kind: 'born', tick: 50, species: 'rabbit', count: 4 }, // before the save — excluded
    ];
    const lines = summarizeEvents(events, 60);
    const text = lines.join('\n');
    expect(text).toContain('duck');
    expect(text).toContain('robin');
    expect(text).toContain('phoenix');
    expect(text).not.toContain('4');
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it('quiet days make a gentle line, not silence', () => {
    expect(summarizeEvents([], 0).length).toBe(1);
  });
});
