/**
 * The deterministic tick pipeline — the sim's only entry point.
 * Fixed order, fixed rate; commands are empty in v1 but the seam exists for v2.
 * Pipeline: clock → needs decay → behavior selection → family FSM →
 * population regulator → activity effects/movement.
 */
import { applyActivity, decayNeeds, selectBehavior } from './behaviors';
import { getClock } from './clock';
import { familySystem } from './family';
import { ageCreatures } from './lifecycle';
import { regulatePopulation } from './population';
import type { WorldState } from './state';

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** v2+ player interactions enter here; v1 always passes []. */
export type Command = { kind: 'noop' };

export function tick(state: WorldState, _commands: readonly Command[]): void {
  state.tick++;
  const clock = getClock(state.tick);
  decayNeeds(state);
  ageCreatures(state);
  for (const c of state.creatures) selectBehavior(state, c, clock);
  familySystem(state); // family duties override free-agent choices
  regulatePopulation(state); // wanderer floor failsafe (spec §4.3 layer 2)
  for (const c of state.creatures) applyActivity(state, c, clock);
}
