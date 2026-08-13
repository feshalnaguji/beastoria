/**
 * WorldState: a plain serializable POJO tree. Save = JSON of this. No classes,
 * no functions, no references to presentation. See spec §4.3.
 */
import { seedRng, nextRange, type RngState } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type SpeciesId = 'rabbit'; // M0: one species; grows to 8 in M5

export interface Creature {
  id: number;
  species: SpeciesId;
  pos: Vec2;
  heading: number; // radians
  speed: number; // world units per tick while moving
}

export interface WorldState {
  tick: number;
  rng: RngState;
  nextId: number;
  creatures: Creature[];
}

export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 3072;

export function createWorld(seed: number): WorldState {
  const rng = seedRng(seed);
  const state: WorldState = { tick: 0, rng, nextId: 1, creatures: [] };
  spawnCreature(state, 'rabbit', {
    x: WORLD_WIDTH / 2 + nextRange(rng, -200, 200),
    y: WORLD_HEIGHT / 2 + nextRange(rng, -200, 200),
  });
  return state;
}

export function spawnCreature(state: WorldState, species: SpeciesId, pos: Vec2): Creature {
  const creature: Creature = {
    id: state.nextId++,
    species,
    pos: { x: pos.x, y: pos.y },
    heading: nextRange(state.rng, 0, Math.PI * 2),
    speed: 6,
  };
  state.creatures.push(creature);
  return creature;
}
