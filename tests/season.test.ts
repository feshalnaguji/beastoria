import { describe, expect, it } from 'vitest';
import { hemisphereFor, isFullMoon, moonPhase, seasonFor, seasonOverrides } from '../src/app/season';

describe('seasons', () => {
  it('follows meteorological seasons in the north', () => {
    expect(seasonFor(new Date(2026, 1, 28), 'north')).toBe('winter');
    expect(seasonFor(new Date(2026, 2, 1), 'north')).toBe('spring');
    expect(seasonFor(new Date(2026, 4, 31), 'north')).toBe('spring');
    expect(seasonFor(new Date(2026, 5, 1), 'north')).toBe('summer');
    expect(seasonFor(new Date(2026, 8, 26), 'north')).toBe('autumn');
    expect(seasonFor(new Date(2026, 11, 1), 'north')).toBe('winter');
  });

  it('shifts six months in the south', () => {
    expect(seasonFor(new Date(2026, 0, 15), 'south')).toBe('summer');
    expect(seasonFor(new Date(2026, 3, 15), 'south')).toBe('autumn');
    expect(seasonFor(new Date(2026, 6, 15), 'south')).toBe('winter');
    expect(seasonFor(new Date(2026, 9, 15), 'south')).toBe('spring');
  });

  it('guesses the hemisphere from the timezone, defaulting north', () => {
    expect(hemisphereFor('Asia/Kolkata')).toBe('north');
    expect(hemisphereFor('Europe/London')).toBe('north');
    expect(hemisphereFor('America/New_York')).toBe('north');
    expect(hemisphereFor('Australia/Sydney')).toBe('south');
    expect(hemisphereFor('America/Argentina/Buenos_Aires')).toBe('south');
    expect(hemisphereFor('Pacific/Auckland')).toBe('south');
    expect(hemisphereFor('Africa/Johannesburg')).toBe('south');
    expect(hemisphereFor('')).toBe('north');
    expect(hemisphereFor('Not/AZone')).toBe('north');
  });
});

describe('moon', () => {
  it('finds real full moons and not real new moons', () => {
    for (const d of [Date.UTC(2023, 7, 31, 1, 35), Date.UTC(2024, 0, 25, 17, 54), Date.UTC(2025, 8, 7, 18, 9)]) {
      expect(isFullMoon(new Date(d))).toBe(true);
    }
    for (const d of [Date.UTC(2024, 0, 11, 11, 57), Date.UTC(2025, 8, 21, 19, 54)]) {
      expect(isFullMoon(new Date(d))).toBe(false);
      const p = moonPhase(new Date(d));
      expect(Math.min(p, 1 - p)).toBeLessThan(0.03);
    }
  });
});

describe('overrides', () => {
  it('accepts only real seasons and moon=full', () => {
    expect(seasonOverrides('?season=autumn&moon=full')).toEqual({ season: 'autumn', fullMoon: true });
    expect(seasonOverrides('?season=monsoon')).toEqual({ season: null, fullMoon: false });
    expect(seasonOverrides('')).toEqual({ season: null, fullMoon: false });
  });
});
