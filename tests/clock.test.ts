/**
 * Day/night clock: pure function of tick count. 1 in-game day = 4 real minutes
 * = 2400 ticks at 10 tps. Phases: dawn → day → dusk → night.
 */
import { describe, expect, it } from 'vitest';
import { getClock, TICKS_PER_DAY } from '../src/sim/clock';

describe('clock', () => {
  it('one day is 2400 ticks (4 real minutes at 10 tps)', () => {
    expect(TICKS_PER_DAY).toBe(2400);
  });

  it('starts at day 0 dawn and advances to day 1 after a full day', () => {
    expect(getClock(0).day).toBe(0);
    expect(getClock(0).phase).toBe('dawn');
    expect(getClock(TICKS_PER_DAY).day).toBe(1);
    expect(getClock(TICKS_PER_DAY * 3 + 5).day).toBe(3);
  });

  it('cycles through dawn, day, dusk, night within one day', () => {
    const phases = new Set<string>();
    for (let t = 0; t < TICKS_PER_DAY; t += 10) phases.add(getClock(t).phase);
    expect(phases).toEqual(new Set(['dawn', 'day', 'dusk', 'night']));
  });

  it('is day at midday fraction and night at end-of-day fraction', () => {
    expect(getClock(Math.floor(TICKS_PER_DAY * 0.3)).phase).toBe('day');
    expect(getClock(Math.floor(TICKS_PER_DAY * 0.9)).phase).toBe('night');
  });

  it('phaseT runs 0→1 within a phase', () => {
    const early = getClock(Math.floor(TICKS_PER_DAY * 0.1));
    const late = getClock(Math.floor(TICKS_PER_DAY * 0.5));
    expect(early.phase).toBe('day');
    expect(late.phase).toBe('day');
    expect(early.phaseT).toBeGreaterThanOrEqual(0);
    expect(early.phaseT).toBeLessThan(late.phaseT);
    expect(late.phaseT).toBeLessThanOrEqual(1);
  });

  it('light is bright at midday, dark at deep night, in [0,1] always', () => {
    expect(getClock(Math.floor(TICKS_PER_DAY * 0.3)).light).toBeGreaterThan(0.9);
    expect(getClock(Math.floor(TICKS_PER_DAY * 0.85)).light).toBeLessThan(0.1);
    for (let t = 0; t < TICKS_PER_DAY * 2; t += 7) {
      const light = getClock(t).light;
      expect(light).toBeGreaterThanOrEqual(0);
      expect(light).toBeLessThanOrEqual(1);
    }
  });
});
