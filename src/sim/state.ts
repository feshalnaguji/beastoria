/**
 * WorldState: a plain serializable POJO tree. Save = JSON of this. No classes,
 * no functions, no references to presentation. See spec §4.3.
 */
import { seedRng, nextRange, type RngState } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type SpeciesId = 'rabbit' | 'robin'; // grows to 8 in M5

export type LifeStage = 'baby' | 'juvenile' | 'adult' | 'elder'; // egg arrives in M4

export type ActivityId = 'idle' | 'wander' | 'forage' | 'nap' | 'socialize';

export interface Activity {
  id: ActivityId;
  /** Ticks spent in this activity so far. */
  ticks: number;
  /** Soft minimum duration before ordinary switches are allowed (hysteresis). */
  minTicks: number;
  targetPos?: Vec2 | undefined;
  targetId?: number | undefined;
}

export interface Needs {
  /** 0 = sated … 1 = urgent, for all needs. */
  hunger: number;
  rest: number;
  social: number;
}

export interface Creature {
  id: number;
  species: SpeciesId;
  pos: Vec2;
  heading: number; // radians
  stage: LifeStage;
  ageTicks: number;
  lifespanTicks: number;
  needs: Needs;
  activity: Activity;
}

export interface WorldState {
  tick: number;
  rng: RngState;
  nextId: number;
  creatures: Creature[];
}

export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 3072;

// species.ts only imports TYPES from this file (erased at compile time),
// so this runtime import creates no cycle.
import { SPECIES, type SpeciesParams } from './species';

/** Starting cast: age fractions chosen so every stage is on screen from
 * minute one (frac of each individual's own rolled lifespan). */
const STARTING_CAST: { species: SpeciesId; ageFrac: number }[] = [
  { species: 'rabbit', ageFrac: 0.05 }, // baby
  { species: 'rabbit', ageFrac: 0.2 }, // juvenile
  { species: 'rabbit', ageFrac: 0.45 },
  { species: 'rabbit', ageFrac: 0.5 },
  { species: 'rabbit', ageFrac: 0.6 },
  { species: 'rabbit', ageFrac: 0.9 }, // elder
  { species: 'robin', ageFrac: 0.06 }, // chick
  { species: 'robin', ageFrac: 0.35 },
  { species: 'robin', ageFrac: 0.55 },
  { species: 'robin', ageFrac: 0.86 }, // elder
];

export function createWorld(seed: number): WorldState {
  const rng = seedRng(seed);
  const state: WorldState = { tick: 0, rng, nextId: 1, creatures: [] };
  for (const { species, ageFrac } of STARTING_CAST) {
    spawnCreature(state, species, randomMeadowPos(rng), ageFrac);
  }
  return state;
}

function randomMeadowPos(rng: RngState): Vec2 {
  return {
    x: WORLD_WIDTH / 2 + nextRange(rng, -700, 700),
    y: WORLD_HEIGHT / 2 + nextRange(rng, -500, 500),
  };
}

export function spawnCreature(
  state: WorldState,
  species: SpeciesId,
  pos: Vec2,
  ageFrac = 0,
): Creature {
  const rng = state.rng;
  const p = SPECIES[species];
  const lifespanTicks = Math.round(p.lifespanTicksMean * nextRange(rng, 0.85, 1.15));
  const ageTicks = Math.floor(lifespanTicks * ageFrac);
  const creature: Creature = {
    id: state.nextId++,
    species,
    pos: { x: pos.x, y: pos.y },
    heading: nextRange(rng, 0, Math.PI * 2),
    stage: stageFromFractions(p, ageTicks / lifespanTicks),
    ageTicks,
    lifespanTicks,
    needs: {
      hunger: nextRange(rng, 0, 0.3),
      rest: nextRange(rng, 0, 0.3),
      social: nextRange(rng, 0, 0.3),
    },
    activity: { id: 'idle', ticks: 0, minTicks: 0 },
  };
  state.creatures.push(creature);
  return creature;
}

function stageFromFractions(p: SpeciesParams, t: number): LifeStage {
  const f = p.stageFractions;
  if (t < f.baby) return 'baby';
  if (t < f.baby + f.juvenile) return 'juvenile';
  if (t < f.baby + f.juvenile + f.adult) return 'adult';
  return 'elder';
}
