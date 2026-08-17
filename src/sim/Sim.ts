/**
 * The deterministic tick pipeline — the sim's only entry point.
 * Fixed order, fixed rate; commands are empty in v1 but the seam exists for v2.
 * Pipeline: clock → needs decay → aging → behavior selection → family FSM →
 * population regulator → activity effects/movement → vocalizations (transient output).
 */
import { applyActivity, decayNeeds, selectBehavior, type Feeding, type TickScratch } from './behaviors';
import { getClock } from './clock';
import { familySystem } from './family';
import { ageCreatures } from './lifecycle';
import { regulatePopulation } from './population';
import type { WorldState } from './state';
import { collectVocalizations, type Vocalization } from './voice';

export type { Vocalization, Feeding };

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** v2+ player interactions enter here; v1 always passes []. */
export type Command = { kind: 'noop' };

export interface TickOutput {
  vocalizations: Vocalization[];
  /** Transient "this baby just got fed" beats this tick — nothing persisted,
   * nothing logged; an unwatched feed leaves no trace (like vocalizations). */
  feedings: Feeding[];
}

export function tick(state: WorldState, _commands: readonly Command[]): TickOutput {
  state.tick++;
  const clock = getClock(state.tick);
  decayNeeds(state);
  ageCreatures(state);
  for (const c of state.creatures) selectBehavior(state, c, clock);
  familySystem(state); // family duties override free-agent choices
  regulatePopulation(state); // wanderer floor failsafe (spec §4.3 layer 2)
  const scratch: TickScratch = { feedings: [] };
  for (const c of state.creatures) applyActivity(state, c, clock, scratch);
  return { vocalizations: collectVocalizations(state, clock), feedings: scratch.feedings };
}
