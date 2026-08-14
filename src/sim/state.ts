/**
 * WorldState: a plain serializable POJO tree. Save = JSON of this. No classes,
 * no functions, no references to presentation. See spec §4.3.
 */
import { seedRng, nextRange, nextFloat, type RngState } from './rng';
import type { SimEvent } from './events';
import { BURROW_SITES, LONE_TREES, NEST_TREES } from './valley';

export interface Vec2 {
  x: number;
  y: number;
}

export type SpeciesId =
  | 'rabbit'
  | 'robin'
  | 'deer'
  | 'duck'
  | 'koi'
  | 'owl'
  | 'dodo'
  | 'phoenix';

export type LifeStage = 'baby' | 'juvenile' | 'adult' | 'elder';

export type ActivityId =
  | 'idle'
  | 'wander'
  | 'forage'
  | 'nap'
  | 'socialize'
  // Family-directed activities (owned by family.ts, not utility selection):
  | 'court'
  | 'brood'
  | 'feedYoung'
  | 'gather'
  | 'pass';

export interface Activity {
  id: ActivityId;
  /** Ticks spent in this activity so far. */
  ticks: number;
  /** Soft minimum duration before ordinary switches are allowed (hysteresis). */
  minTicks: number;
  targetPos?: Vec2 | undefined;
  targetId?: number | undefined;
  /** Sub-step within multi-leg activities (e.g. feedYoung: 0 fetch, 1 return). */
  step?: number | undefined;
}

export interface Needs {
  /** 0 = sated … 1 = urgent, for all needs. */
  hunger: number;
  rest: number;
  social: number;
}

export type Sex = 'm' | 'f';

export interface Creature {
  id: number;
  species: SpeciesId;
  sex: Sex;
  familyId: number | null;
  pos: Vec2;
  heading: number; // radians
  stage: LifeStage;
  ageTicks: number;
  lifespanTicks: number;
  needs: Needs;
  activity: Activity;
}

export type FamilyPhase =
  | 'courting'
  | 'nesting'
  | 'expecting'
  | 'rearing'
  | 'emptyNest';

export interface Family {
  id: number;
  species: SpeciesId;
  parentIds: number[];
  childIds: number[];
  homeId: number | null;
  phase: FamilyPhase;
  phaseTicks: number;
  /** Which parent is currently on brooding/feeding duty (index into parentIds). */
  dutyParent: number;
  clutch?: { count: number; broodTicksLeft: number } | undefined;
}

export type HomeKind =
  | 'burrow'
  | 'treeNest'
  | 'reedNest'
  | 'lilyPatch'
  | 'treeHollow'
  | 'glade'
  | 'groundNest'
  | 'groveNest';

export interface Home {
  id: number;
  kind: HomeKind;
  pos: Vec2;
  familyId: number | null;
}

export interface Memorial {
  pos: Vec2;
  species: SpeciesId;
  tick: number;
}

export interface WorldState {
  tick: number;
  rng: RngState;
  nextId: number;
  creatures: Creature[];
  families: Family[];
  homes: Home[];
  memorials: Memorial[];
  eventLog: SimEvent[];
}

export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 3072;

// species.ts only imports TYPES from this file (erased at compile time),
// so this runtime import creates no cycle.
import { SPECIES, type SpeciesParams } from './species';

/** Starting cast: age fractions + sexes chosen so every stage is on screen
 * and both species can pair up (frac of each individual's rolled lifespan). */
const STARTING_CAST: { species: SpeciesId; ageFrac: number; sex: Sex }[] = [
  { species: 'rabbit', ageFrac: 0.05, sex: 'm' }, // baby
  { species: 'rabbit', ageFrac: 0.2, sex: 'f' }, // juvenile
  { species: 'rabbit', ageFrac: 0.45, sex: 'm' },
  { species: 'rabbit', ageFrac: 0.5, sex: 'f' },
  { species: 'rabbit', ageFrac: 0.6, sex: 'm' },
  { species: 'rabbit', ageFrac: 0.9, sex: 'f' }, // elder
  { species: 'robin', ageFrac: 0.06, sex: 'f' }, // chick
  { species: 'robin', ageFrac: 0.35, sex: 'm' },
  { species: 'robin', ageFrac: 0.55, sex: 'f' },
  { species: 'robin', ageFrac: 0.86, sex: 'm' }, // elder
];

export function createWorld(seed: number): WorldState {
  const rng = seedRng(seed);
  const state: WorldState = {
    tick: 0,
    rng,
    nextId: 1,
    creatures: [],
    families: [],
    homes: [],
    memorials: [],
    eventLog: [],
  };

  for (const pos of BURROW_SITES) {
    state.homes.push({ id: state.nextId++, kind: 'burrow', pos: { ...pos }, familyId: null });
  }
  for (const pos of [...LONE_TREES, ...NEST_TREES]) {
    state.homes.push({ id: state.nextId++, kind: 'treeNest', pos: { ...pos }, familyId: null });
  }

  for (const { species, ageFrac, sex } of STARTING_CAST) {
    const c = spawnCreature(state, species, randomMeadowPos(rng), ageFrac);
    c.sex = sex;
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
    sex: nextFloat(rng) < 0.5 ? 'm' : 'f',
    familyId: null,
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
