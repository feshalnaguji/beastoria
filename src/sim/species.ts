/**
 * Species parameters as data. Two entries in M3 (rabbit, robin); grows to 8
 * in M5, when this becomes the full SpeciesDef registry of the spec.
 */
import type { LifeStage, SpeciesId } from './state';

export interface SpeciesParams {
  /** World units per tick while moving (adults; stages scale it). */
  speed: number;
  /** Active by day (true) or by night (false, e.g. owls in M5). */
  diurnal: boolean;
  /** Mean lifespan in ticks; individuals roll ±15% at spawn. */
  lifespanTicksMean: number;
  /** Fractions of lifespan per stage; elder is the remainder. */
  stageFractions: { baby: number; juvenile: number; adult: number };
  /** Need growth per tick (need goes 0→1 in 1/rate ticks). */
  needRates: { hunger: number; rest: number; social: number };
  /** Need relief per tick while doing the matching activity. */
  eatRate: number;
  sleepRate: number;
  socialRate: number;
  /** Which home kind this species claims. */
  homeKind: 'burrow' | 'treeNest';
  reproduction: {
    mode: 'egg' | 'live';
    clutchMin: number;
    clutchMax: number;
    /** Incubation / gestation display period, in ticks. */
    broodTicks: number;
    /** Pause between clutches (emptyNest), in ticks. */
    cooldownTicks: number;
  };
  population: { floor: number; softCap: number; hardCap: number };
}

export const SPECIES: Record<SpeciesId, SpeciesParams> = {
  rabbit: {
    speed: 6,
    diurnal: true,
    lifespanTicksMean: 24000, // ≈ 10 game days ≈ 40 real minutes
    stageFractions: { baby: 0.12, juvenile: 0.16, adult: 0.55 },
    needRates: {
      hunger: 1 / 1200,
      rest: 1 / 2400,
      social: 1 / 1680,
    },
    eatRate: 0.004,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'burrow',
    reproduction: {
      mode: 'live',
      clutchMin: 2,
      clutchMax: 4,
      broodTicks: 600, // gestation shown as mother resting in the burrow
      cooldownTicks: 1500,
    },
    population: { floor: 3, softCap: 8, hardCap: 12 },
  },
  robin: {
    speed: 8, // quick, hoppy
    diurnal: true,
    lifespanTicksMean: 19200, // ≈ 8 game days
    stageFractions: { baby: 0.1, juvenile: 0.14, adult: 0.58 },
    needRates: {
      hunger: 1 / 1000, // small bird, fast metabolism
      rest: 1 / 2400,
      social: 1 / 1500,
    },
    eatRate: 0.005,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'treeNest',
    reproduction: {
      mode: 'egg',
      clutchMin: 2,
      clutchMax: 3,
      broodTicks: 800, // eggs brooded in the nest, parents alternating
      cooldownTicks: 1800,
    },
    population: { floor: 3, softCap: 8, hardCap: 12 },
  },
};

/** Stage speed multipliers: babies toddle, elders amble. */
const STAGE_SPEED: Record<LifeStage, number> = {
  baby: 0.55,
  juvenile: 0.85,
  adult: 1,
  elder: 0.8,
};

export function speedFor(species: SpeciesId, stage: LifeStage): number {
  return SPECIES[species].speed * STAGE_SPEED[stage];
}
