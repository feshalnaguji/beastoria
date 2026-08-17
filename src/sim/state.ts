/**
 * WorldState: a plain serializable POJO tree. Save = JSON of this. No classes,
 * no functions, no references to presentation. See spec §4.3.
 */
import { seedRng, nextRange, nextFloat, type RngState } from './rng';
import type { SimEvent } from './events';
import {
  BURROW_SITES,
  LONE_TREES,
  NEST_TREES,
  REED_NESTS,
  LILY_PATCHES,
  HOLLOW_TREES,
  GLADES,
  GROUND_NESTS,
  GROVE_NEST,
  DREY_SITES,
  FROG_SPAWN_CLUMPS,
  TURTLE_SAND_NESTS,
  SHADE_SCRAPES,
  nearestRestable,
} from './valley';

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
  | 'phoenix'
  | 'squirrel'
  | 'frog'
  | 'turtle'
  | 'kangaroo';

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
  | 'groveNest'
  | 'drey'
  | 'spawnClump'
  | 'sandNest'
  | 'shadeScrape';

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
  lastWandererTick: Partial<Record<SpeciesId, number>>;
}

export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 3072;

// species.ts only imports TYPES from this file (erased at compile time),
// so this runtime import creates no cycle.
import { landingMediumOf, SPECIES, type SpeciesParams } from './species';

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
  { species: 'deer', ageFrac: 0.45, sex: 'm' },
  { species: 'deer', ageFrac: 0.5, sex: 'f' },
  { species: 'deer', ageFrac: 0.3, sex: 'f' },
  { species: 'deer', ageFrac: 0.2, sex: 'm' }, // young stag tags along
  { species: 'duck', ageFrac: 0.45, sex: 'm' },
  { species: 'duck', ageFrac: 0.5, sex: 'f' },
  { species: 'duck', ageFrac: 0.12, sex: 'f' }, // duckling
  { species: 'koi', ageFrac: 0.45, sex: 'm' },
  { species: 'koi', ageFrac: 0.5, sex: 'f' },
  { species: 'koi', ageFrac: 0.3, sex: 'f' },
  { species: 'koi', ageFrac: 0.6, sex: 'm' },
  { species: 'owl', ageFrac: 0.45, sex: 'm' },
  { species: 'owl', ageFrac: 0.5, sex: 'f' },
  { species: 'dodo', ageFrac: 0.5, sex: 'm' },
  { species: 'dodo', ageFrac: 0.45, sex: 'f' },
  { species: 'phoenix', ageFrac: 0.5, sex: 'm' },
  { species: 'phoenix', ageFrac: 0.55, sex: 'f' },
  // M10: three new neighbors, appended last so the original eight species'
  // RNG draw sequence (and every seeded fixture/test built on it) is
  // untouched — these only add draws after them, never reorder them.
  { species: 'squirrel', ageFrac: 0.08, sex: 'm' }, // kit
  { species: 'squirrel', ageFrac: 0.4, sex: 'f' },
  { species: 'squirrel', ageFrac: 0.5, sex: 'm' },
  { species: 'squirrel', ageFrac: 0.85, sex: 'f' }, // elder
  { species: 'frog', ageFrac: 0.1, sex: 'f' }, // froglet
  { species: 'frog', ageFrac: 0.45, sex: 'm' },
  { species: 'frog', ageFrac: 0.5, sex: 'f' },
  { species: 'frog', ageFrac: 0.5, sex: 'm' },
  { species: 'frog', ageFrac: 0.5, sex: 'f' }, // a small chorus
  { species: 'turtle', ageFrac: 0.5, sex: 'm' },
  { species: 'turtle', ageFrac: 0.55, sex: 'f' },
  { species: 'turtle', ageFrac: 0.9, sex: 'm' }, // ancient elder
  // M11: the twelfth neighbor, appended last for the same reason as M10's
  // three above — every earlier species' RNG draw sequence stays untouched.
  { species: 'kangaroo', ageFrac: 0.1, sex: 'f' }, // joey-aged
  { species: 'kangaroo', ageFrac: 0.45, sex: 'm' },
  { species: 'kangaroo', ageFrac: 0.5, sex: 'f' },
];

/** Where each species wakes up on day one (koi in water, phoenix at the grove). */
const SPAWN_ANCHORS: Record<SpeciesId, { x: number; y: number; rx: number; ry: number }> = {
  rabbit: { x: 2048, y: 1536, rx: 700, ry: 500 },
  robin: { x: 2048, y: 1536, rx: 700, ry: 500 },
  deer: { x: 2100, y: 1600, rx: 400, ry: 300 },
  duck: { x: 2500, y: 1900, rx: 150, ry: 90 },
  koi: { x: 3100, y: 2300, rx: 300, ry: 200 },
  owl: { x: 950, y: 850, rx: 300, ry: 250 },
  dodo: { x: 1300, y: 1250, rx: 200, ry: 150 },
  phoenix: { x: 2300, y: 480, rx: 120, ry: 80 },
  squirrel: { x: 850, y: 750, rx: 350, ry: 300 },
  frog: { x: 2800, y: 2150, rx: 180, ry: 120 },
  turtle: { x: 2700, y: 2000, rx: 200, ry: 140 },
  kangaroo: { x: 1750, y: 2200, rx: 450, ry: 350 },
};

function spawnPosFor(rng: RngState, species: SpeciesId): Vec2 {
  const a = SPAWN_ANCHORS[species];
  const p = { x: a.x + nextRange(rng, -a.rx, a.rx), y: a.y + nextRange(rng, -a.ry, a.ry) };
  // Draw-free clamp: never consumes/reorders RNG, so it never reshuffles a
  // seeded world. Birds wake up perched, so this uses the LANDING medium.
  return nearestRestable(landingMediumOf(species), p);
}

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
    lastWandererTick: {},
  };

  for (const pos of BURROW_SITES) {
    state.homes.push({ id: state.nextId++, kind: 'burrow', pos: { ...pos }, familyId: null });
  }
  for (const pos of [...LONE_TREES, ...NEST_TREES]) {
    state.homes.push({ id: state.nextId++, kind: 'treeNest', pos: { ...pos }, familyId: null });
  }

  const siteGroups: [HomeKind, Vec2[]][] = [
    ['reedNest', REED_NESTS],
    ['lilyPatch', LILY_PATCHES],
    ['treeHollow', HOLLOW_TREES],
    ['glade', GLADES],
    ['groundNest', GROUND_NESTS],
    ['groveNest', [GROVE_NEST]],
    // M10 task 3: appended after the original eight home kinds so every
    // existing home's id is unchanged — only new ids are added at the tail.
    ['drey', DREY_SITES],
    ['spawnClump', FROG_SPAWN_CLUMPS],
    ['sandNest', TURTLE_SAND_NESTS],
    // M11: appended after the M10 trio for the same reason — every existing
    // home's id is unchanged, only new ids are added at the tail.
    ['shadeScrape', SHADE_SCRAPES],
  ];
  for (const [kind, sites] of siteGroups) {
    for (const pos of sites) {
      state.homes.push({ id: state.nextId++, kind, pos: { ...pos }, familyId: null });
    }
  }

  for (const { species, ageFrac, sex } of STARTING_CAST) {
    const c = spawnCreature(state, species, spawnPosFor(rng, species), ageFrac);
    c.sex = sex;
  }
  return state;
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
