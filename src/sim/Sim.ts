/**
 * The deterministic tick pipeline — the sim's only entry point.
 * Fixed order, fixed rate; commands are empty in v1 but the seam exists for v2.
 */
import { nextFloat, nextRange } from './rng';
import { WORLD_HEIGHT, WORLD_WIDTH, type WorldState } from './state';

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** v2+ player interactions enter here; v1 always passes []. */
export type Command = { kind: 'noop' };

const EDGE_MARGIN = 120;

export function tick(state: WorldState, _commands: readonly Command[]): void {
  state.tick++;
  moveCreatures(state);
}

/** M0 behavior: gentle wander with pauses; turns back near world edges. */
function moveCreatures(state: WorldState): void {
  const rng = state.rng;
  for (const c of state.creatures) {
    // Occasional idle pause keeps motion organic (and cheap).
    if (nextFloat(rng) < 0.06) continue;

    c.heading += nextRange(rng, -0.35, 0.35);

    // Steer back toward the middle when close to an edge.
    const toCenterX = WORLD_WIDTH / 2 - c.pos.x;
    const toCenterY = WORLD_HEIGHT / 2 - c.pos.y;
    const nearEdge =
      c.pos.x < EDGE_MARGIN ||
      c.pos.y < EDGE_MARGIN ||
      c.pos.x > WORLD_WIDTH - EDGE_MARGIN ||
      c.pos.y > WORLD_HEIGHT - EDGE_MARGIN;
    if (nearEdge) {
      const centerAngle = Math.atan2(toCenterY, toCenterX);
      c.heading = turnToward(c.heading, centerAngle, 0.3);
    }

    c.pos.x += Math.cos(c.heading) * c.speed;
    c.pos.y += Math.sin(c.heading) * c.speed;
  }
}

function turnToward(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + Math.max(-maxDelta, Math.min(maxDelta, diff));
}
