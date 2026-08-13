/**
 * WorldState: a plain serializable POJO tree. Save = JSON of this. No classes,
 * no functions, no references to presentation. See spec §4.3.
 */
import { seedRng, nextRange, type RngState } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type SpeciesId = 'rabbit'; // M1: one species; grows to 8 in M5

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

const STARTING_RABBITS = 6;

export function createWorld(seed: number): WorldState {
  const rng = seedRng(seed);
  const state: WorldState = { tick: 0, rng, nextId: 1, creatures: [] };
  for (let i = 0; i < STARTING_RABBITS; i++) {
    spawnCreature(state, 'rabbit', {
      x: WORLD_WIDTH / 2 + nextRange(rng, -600, 600),
      y: WORLD_HEIGHT / 2 + nextRange(rng, -600, 600),
    });
  }
  return state;
}

export function spawnCreature(state: WorldState, species: SpeciesId, pos: Vec2): Creature {
  const rng = state.rng;
  const creature: Creature = {
    id: state.nextId++,
    species,
    pos: { x: pos.x, y: pos.y },
    heading: nextRange(rng, 0, Math.PI * 2),
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
