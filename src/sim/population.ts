/**
 * Population regulator, layer 2 (spec §4.3): the wanderer floor failsafe.
 * When a species dwindles below its floor — or its unpaired adults are all
 * one sex with no family carrying the line — a new adult wanders in from
 * the map edge (or glides into the pond, for koi). Rate-limited per species
 * so recoveries feel like quiet arrivals, not a flood.
 */
import { emit } from './events';
import { nextRange } from './rng';
import { SPECIES } from './species';
import {
  spawnCreature,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from './state';
import { POND } from './valley';

const WANDERER_COOLDOWN = 2000;
const ARRIVAL_AGE_FRAC = 0.4; // arrives as a settled adult, for every species

export function regulatePopulation(state: WorldState): void {
  for (const species of Object.keys(SPECIES) as SpeciesId[]) {
    const p = SPECIES[species];
    if (!p.wandersIn) continue;
    const last = state.lastWandererTick[species];
    if (last !== undefined && state.tick - last < WANDERER_COOLDOWN) continue;

    const members = state.creatures.filter((c) => c.species === species);
    const belowFloor = members.length < p.population.floor;
    const singles = members.filter((c) => c.familyId === null && c.stage === 'adult');
    const hasFamily = state.families.some((f) => f.species === species);
    const missingSex =
      !hasFamily &&
      singles.length > 0 &&
      (singles.every((c) => c.sex === 'm') || singles.every((c) => c.sex === 'f'));
    if (!belowFloor && !missingSex) continue;

    const pos = p.medium === 'water' ? pondEdgePos(state) : mapEdgePos(state);
    const wanderer = spawnCreature(state, species, pos, ARRIVAL_AGE_FRAC);
    if (missingSex && singles[0]) wanderer.sex = singles[0].sex === 'm' ? 'f' : 'm';
    state.lastWandererTick[species] = state.tick;
    emit(state, { kind: 'wandererArrived', tick: state.tick, species, pos: { ...pos } });
  }
}

function mapEdgePos(state: WorldState): Vec2 {
  const rng = state.rng;
  const side = Math.floor(nextRange(rng, 0, 4));
  const m = 60;
  if (side === 0) return { x: nextRange(rng, m, WORLD_WIDTH - m), y: m };
  if (side === 1) return { x: WORLD_WIDTH - m, y: nextRange(rng, m, WORLD_HEIGHT - m) };
  if (side === 2) return { x: nextRange(rng, m, WORLD_WIDTH - m), y: WORLD_HEIGHT - m };
  return { x: m, y: nextRange(rng, m, WORLD_HEIGHT - m) };
}

/** Koi slip in at the pond's rim, already in the water. */
function pondEdgePos(state: WorldState): Vec2 {
  const a = nextRange(state.rng, 0, Math.PI * 2);
  return { x: POND.x + Math.cos(a) * POND.rx * 0.8, y: POND.y + Math.sin(a) * POND.ry * 0.8 };
}
