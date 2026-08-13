/**
 * Life stages as pure math on age fraction (spec §4.3). Egg, birth, and the
 * gentle passing arrive with families in M4 — for now elders simply remain
 * elders, wise and unhurried.
 */
import { SPECIES } from './species';
import type { LifeStage, SpeciesId, WorldState } from './state';

export function stageForAge(
  species: SpeciesId,
  ageTicks: number,
  lifespanTicks: number,
): LifeStage {
  const f = SPECIES[species].stageFractions;
  const t = ageTicks / lifespanTicks;
  if (t < f.baby) return 'baby';
  if (t < f.baby + f.juvenile) return 'juvenile';
  if (t < f.baby + f.juvenile + f.adult) return 'adult';
  return 'elder';
}

export function ageCreatures(state: WorldState): void {
  for (const c of state.creatures) {
    c.ageTicks++;
    c.stage = stageForAge(c.species, c.ageTicks, c.lifespanTicks);
  }
}
