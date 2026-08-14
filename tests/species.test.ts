/**
 * The full 8-species registry: every species defined, params sane,
 * home kinds and movement media consistent with the valley.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/sim/species';
import { canOccupy, GROVE_NEST, isWater, LILY_PATCHES, POND, REED_NESTS } from '../src/sim/valley';
import type { SpeciesId } from '../src/sim/state';

const ALL: SpeciesId[] = ['rabbit', 'robin', 'deer', 'duck', 'koi', 'owl', 'dodo', 'phoenix'];

describe('species registry', () => {
  it('defines all eight species', () => {
    expect(Object.keys(SPECIES).sort()).toEqual([...ALL].sort());
  });

  it('has sane params for every species', () => {
    for (const id of ALL) {
      const p = SPECIES[id];
      expect(p.speed).toBeGreaterThan(0);
      const f = p.stageFractions;
      expect(f.baby + f.juvenile + f.adult).toBeLessThan(1);
      expect(p.population.floor).toBeLessThanOrEqual(p.population.softCap);
      expect(p.population.softCap).toBeLessThanOrEqual(p.population.hardCap);
      expect(p.reproduction.clutchMin).toBeLessThanOrEqual(p.reproduction.clutchMax);
    }
  });

  it('special flags: koi swims, duck is amphibious, owl is nocturnal, phoenix is singular', () => {
    expect(SPECIES.koi.medium).toBe('water');
    expect(SPECIES.duck.medium).toBe('amphibious');
    expect(SPECIES.owl.diurnal).toBe(false);
    expect(SPECIES.deer.herd).toBe(true);
    expect(SPECIES.phoenix.singleFamily).toBe(true);
    expect(SPECIES.phoenix.rebirth).toBe(true);
    expect(SPECIES.phoenix.wandersIn).toBe(false);
    expect(SPECIES.dodo.wandersIn).toBe(true);
  });

  it('home sites sit in the right medium', () => {
    for (const p of LILY_PATCHES) expect(isWater(p)).toBe(true); // koi homes in the pond
    for (const p of REED_NESTS) expect(isWater(p)).toBe(false); // duck nests on the shore
    expect(isWater(GROVE_NEST)).toBe(false);
  });

  it('canOccupy: land avoids water, water requires it, amphibious goes anywhere', () => {
    const wet = { x: POND.x, y: POND.y };
    const dry = { x: 2000, y: 1500 };
    expect(canOccupy('land', wet)).toBe(false);
    expect(canOccupy('land', dry)).toBe(true);
    expect(canOccupy('water', wet)).toBe(true);
    expect(canOccupy('water', dry)).toBe(false);
    expect(canOccupy('amphibious', wet)).toBe(true);
    expect(canOccupy('amphibious', dry)).toBe(true);
  });
});
