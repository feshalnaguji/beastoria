/**
 * The full species registry: every species defined, params sane,
 * home kinds and movement media consistent with the valley.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES, speedFor } from '../src/sim/species';
import {
  canOccupy,
  DREY_SITES,
  FROG_SPAWN_CLUMPS,
  GROVE_NEST,
  isWater,
  LILY_PATCHES,
  POND,
  REED_NESTS,
  SHADE_SCRAPES,
  TURTLE_SAND_NESTS,
} from '../src/sim/valley';
import type { SpeciesId } from '../src/sim/state';

const ALL: SpeciesId[] = [
  'rabbit',
  'robin',
  'deer',
  'duck',
  'koi',
  'owl',
  'dodo',
  'phoenix',
  'squirrel',
  'frog',
  'turtle',
  'kangaroo',
];

describe('species registry', () => {
  it('defines all twelve species', () => {
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
    for (const p of DREY_SITES) expect(isWater(p)).toBe(false); // squirrel dreys are dry forest
    for (const p of TURTLE_SAND_NESTS) expect(isWater(p)).toBe(false); // sand nests are dry shore
    for (const p of SHADE_SCRAPES) expect(isWater(p)).toBe(false); // shade scrapes are dry meadow
    // Frog spawn clumps are amphibious homes — no dry/wet requirement.
    expect(FROG_SPAWN_CLUMPS.length).toBeGreaterThan(0);
  });

  it('M11: kangaroo is the valley\'s quickest mover, a silent single-joey nurser', () => {
    expect(SPECIES.kangaroo.medium).toBe('land');
    expect(SPECIES.kangaroo.reproduction.feedMode).toBe('nurse');
    expect(SPECIES.kangaroo.reproduction.clutchMin).toBe(1);
    expect(SPECIES.kangaroo.reproduction.clutchMax).toBe(1);
    expect(SPECIES.kangaroo.homeKind).toBe('shadeScrape');
    expect(SPECIES.kangaroo.voice.rate).toBe(0); // silent by design
    const speeds = Object.values(SPECIES).map((p) => p.speed);
    expect(SPECIES.kangaroo.speed).toBe(Math.max(...speeds)); // the valley's quickest
  });

  it('M12: the kangaroo is the valley\'s only pouch-carrier, and the only one that needs to be', () => {
    expect(SPECIES.kangaroo.reproduction.pouchCarry).toBe(true);
    for (const id of ALL) {
      if (id === 'kangaroo') continue;
      expect(SPECIES[id].reproduction.pouchCarry).toBeUndefined();
    }
    // Pouch-carry is a nursing mammal's arrangement — it rides on the same
    // mother-centred feeding flow.
    expect(SPECIES.kangaroo.reproduction.feedMode).toBe('nurse');
    // And the mechanical reason it exists at all: a joey on foot moves at
    // 0.55 of its mother's 9 units/tick, so it can never keep up with the
    // valley's fastest adult — it fell out of the 140-unit baby leash in
    // about a second and a half, every time she set off.
    expect(speedFor('kangaroo', 'baby')).toBeLessThan(speedFor('kangaroo', 'adult'));
    expect(SPECIES.kangaroo.speed - speedFor('kangaroo', 'baby')).toBeGreaterThan(4);
  });

  it('M10: squirrel darts, frog is a silent-croaking chorus, turtle is silent and slowest', () => {
    expect(SPECIES.squirrel.medium).toBe('land');
    expect(SPECIES.squirrel.idleMinTicks).toEqual({ min: 10, max: 30 });
    expect(SPECIES.frog.medium).toBe('amphibious');
    expect(SPECIES.frog.reproduction.feedMode).toBe('self');
    expect(SPECIES.turtle.medium).toBe('amphibious');
    expect(SPECIES.turtle.reproduction.feedMode).toBe('self');
    expect(SPECIES.turtle.voice.rate).toBe(0); // silent by design
    const speeds = Object.values(SPECIES).map((p) => p.speed);
    expect(SPECIES.turtle.speed).toBe(Math.min(...speeds)); // the valley's slowest
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
