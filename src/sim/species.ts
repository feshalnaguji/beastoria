/**
 * Species parameters as data. Two entries in M3 (rabbit, robin); grows to 8
 * in M5, when this becomes the full SpeciesDef registry of the spec.
 */
import type { HomeKind, LifeStage, SpeciesId } from './state';
import type { Medium } from './valley';

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
  homeKind: HomeKind;
  reproduction: {
    mode: 'egg' | 'live';
    clutchMin: number;
    clutchMax: number;
    /** Incubation / gestation display period, in ticks. */
    broodTicks: number;
    /** Pause between clutches (emptyNest), in ticks. */
    cooldownTicks: number;
    /**
     * How this species feeds its young (M10 task 2):
     * - 'nurse': mammals — the mother goes straight home and holds a
     *   stationary nursing stance; babies gathered by the leash feed while
     *   she holds.
     * - 'carry': birds — a parent fetches food afield, then carries it home
     *   to deliver in one lump (the original/only flow before this task).
     * - 'self': fish/amphibians — young are never fed by a parent; they
     *   graze passively instead.
     */
    feedMode: 'nurse' | 'carry' | 'self';
  };
  population: { floor: number; softCap: number; hardCap: number };
  /** How the species MOVES: koi water-only, ducks amphibious, birds by air. */
  medium: Medium;
  /**
   * Where the species may come to REST (targets, spawns, landings). Defaults
   * to `medium`; fliers move through 'air' but always land on 'land'.
   */
  landingMedium?: Medium;
  /** Below-floor / missing-sex arrivals from the map edge (spec §4.3 layer 2). */
  wandersIn: boolean;
  /** Herd species drift back toward their herd's centroid while wandering. */
  herd?: boolean;
  /** At most one family of this species may ever exist (phoenix). */
  singleFamily?: boolean;
  /** An elder's passing leaves a new chick at the grove (phoenix). */
  rebirth?: boolean;
  /** Per-tick call probability per eligible adult (modulated by day-phase). */
  voice: { rate: number; dawnMult?: number };
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
      clutchMax: 3,
      broodTicks: 600, // gestation shown as mother resting in the burrow
      cooldownTicks: 1800,
      feedMode: 'nurse',
    },
    population: { floor: 3, softCap: 7, hardCap: 12 },
    medium: 'land',
    wandersIn: true,
    voice: { rate: 1 / 8000 }, // a rare soft thump
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
      cooldownTicks: 2100,
      feedMode: 'carry',
    },
    population: { floor: 3, softCap: 7, hardCap: 12 },
    medium: 'air', // flies: crosses the pond in a straight line
    landingMedium: 'land',
    wandersIn: true,
    voice: { rate: 1 / 700, dawnMult: 6 },
  },
  deer: {
    speed: 7,
    diurnal: true,
    lifespanTicksMean: 33600, // ≈ 14 game days — the valley's gentle giants
    stageFractions: { baby: 0.1, juvenile: 0.15, adult: 0.55 },
    needRates: { hunger: 1 / 1400, rest: 1 / 2600, social: 1 / 1600 },
    eatRate: 0.0035,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'glade',
    reproduction: {
      mode: 'live',
      clutchMin: 1,
      clutchMax: 2,
      broodTicks: 700,
      cooldownTicks: 2400,
      feedMode: 'nurse',
    },
    population: { floor: 3, softCap: 7, hardCap: 10 },
    medium: 'land',
    wandersIn: true,
    herd: true,
    voice: { rate: 1 / 4000 },
  },
  duck: {
    speed: 6,
    diurnal: true,
    lifespanTicksMean: 21600, // ≈ 9 game days
    stageFractions: { baby: 0.1, juvenile: 0.15, adult: 0.55 },
    needRates: { hunger: 1 / 1100, rest: 1 / 2400, social: 1 / 1500 },
    eatRate: 0.0045,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'reedNest',
    reproduction: {
      mode: 'egg',
      clutchMin: 2,
      clutchMax: 2,
      broodTicks: 750,
      cooldownTicks: 2100,
      feedMode: 'carry',
    },
    population: { floor: 3, softCap: 7, hardCap: 12 },
    medium: 'amphibious',
    wandersIn: true,
    voice: { rate: 1 / 900 },
  },
  koi: {
    speed: 5,
    diurnal: true,
    lifespanTicksMean: 36000, // ≈ 15 game days — koi live long
    stageFractions: { baby: 0.1, juvenile: 0.14, adult: 0.6 },
    needRates: { hunger: 1 / 1500, rest: 1 / 3000, social: 1 / 2000 },
    eatRate: 0.004,
    sleepRate: 0.0025,
    socialRate: 0.005,
    homeKind: 'lilyPatch',
    reproduction: {
      mode: 'egg',
      clutchMin: 2,
      clutchMax: 3,
      broodTicks: 600,
      cooldownTicks: 2400,
      feedMode: 'self',
    },
    population: { floor: 3, softCap: 7, hardCap: 13 },
    medium: 'water',
    wandersIn: true,
    voice: { rate: 1 / 3000 }, // a surface plop
  },
  owl: {
    speed: 8,
    diurnal: false, // wakes at dusk as the robins roost
    lifespanTicksMean: 26400, // ≈ 11 game days
    stageFractions: { baby: 0.1, juvenile: 0.14, adult: 0.56 },
    needRates: { hunger: 1 / 1300, rest: 1 / 2400, social: 1 / 1800 },
    eatRate: 0.0045,
    sleepRate: 0.003,
    socialRate: 0.005,
    homeKind: 'treeHollow',
    reproduction: {
      mode: 'egg',
      clutchMin: 1,
      clutchMax: 3,
      broodTicks: 800,
      cooldownTicks: 2200,
      feedMode: 'carry',
    },
    population: { floor: 2, softCap: 6, hardCap: 9 },
    medium: 'air', // flies: crosses the pond in a straight line
    landingMedium: 'land',
    wandersIn: true,
    voice: { rate: 1 / 800 },
  },
  dodo: {
    speed: 4, // an unhurried waddle
    diurnal: true,
    lifespanTicksMean: 28800, // ≈ 12 game days
    stageFractions: { baby: 0.12, juvenile: 0.16, adult: 0.5 },
    needRates: { hunger: 1 / 1200, rest: 1 / 2200, social: 1 / 1400 },
    eatRate: 0.004,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'groundNest',
    reproduction: {
      mode: 'egg',
      clutchMin: 1,
      clutchMax: 2,
      broodTicks: 900,
      cooldownTicks: 2600,
      feedMode: 'carry',
    },
    population: { floor: 2, softCap: 5, hardCap: 8 },
    medium: 'land',
    wandersIn: true, // canonically: dodos wander into the valley from beyond
    voice: { rate: 1 / 1500 },
  },
  phoenix: {
    speed: 7,
    diurnal: true,
    lifespanTicksMean: 16800, // ≈ 7 game days — short, so a rebirth is witnessed
    stageFractions: { baby: 0.12, juvenile: 0.16, adult: 0.5 },
    needRates: { hunger: 1 / 1600, rest: 1 / 2600, social: 1 / 2000 },
    eatRate: 0.004,
    sleepRate: 0.003,
    socialRate: 0.005,
    homeKind: 'groveNest',
    reproduction: {
      mode: 'egg',
      clutchMin: 1,
      clutchMax: 1,
      broodTicks: 700,
      cooldownTicks: 4000,
      feedMode: 'carry',
    },
    population: { floor: 1, softCap: 3, hardCap: 4 }, // softCap 3 lets the lone pair re-nest
    medium: 'air', // flies: crosses the pond in a straight line
    landingMedium: 'land',
    wandersIn: false, // never wanders in — rebirth is the phoenix's failsafe
    singleFamily: true,
    rebirth: true,
    voice: { rate: 1 / 2500, dawnMult: 3 },
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

/**
 * Where this species may come to rest. Every target/spawn/landing check uses
 * this; only in-flight legality uses `medium`.
 */
export function landingMediumOf(species: SpeciesId): Medium {
  const p = SPECIES[species];
  return p.landingMedium ?? p.medium;
}
