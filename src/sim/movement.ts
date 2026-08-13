/**
 * Steering movement: seek/arrive toward targets, organic wandering.
 * No pathfinding by design — zones are authored open (spec §4.3).
 */
import { nextFloat, nextRange, type RngState } from './rng';
import { WORLD_HEIGHT, WORLD_WIDTH, type Creature, type Vec2 } from './state';

const EDGE_MARGIN = 120;
const MAX_TURN = 0.3;

/** Steer toward `target` and advance; returns remaining distance. */
export function moveToward(c: Creature, target: Vec2, speed: number): number {
  const dx = target.x - c.pos.x;
  const dy = target.y - c.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed) {
    c.pos.x = target.x;
    c.pos.y = target.y;
    return 0;
  }
  c.heading = turnToward(c.heading, Math.atan2(dy, dx), MAX_TURN);
  c.pos.x += Math.cos(c.heading) * speed;
  c.pos.y += Math.sin(c.heading) * speed;
  clampToWorld(c);
  return dist - speed;
}

/** Gentle random wander with occasional pauses; turns back near world edges. */
export function wanderStep(rng: RngState, c: Creature, speed: number): void {
  if (nextFloat(rng) < 0.06) return; // organic pauses

  c.heading += nextRange(rng, -0.35, 0.35);

  const nearEdge =
    c.pos.x < EDGE_MARGIN ||
    c.pos.y < EDGE_MARGIN ||
    c.pos.x > WORLD_WIDTH - EDGE_MARGIN ||
    c.pos.y > WORLD_HEIGHT - EDGE_MARGIN;
  if (nearEdge) {
    const centerAngle = Math.atan2(WORLD_HEIGHT / 2 - c.pos.y, WORLD_WIDTH / 2 - c.pos.x);
    c.heading = turnToward(c.heading, centerAngle, MAX_TURN);
  }

  c.pos.x += Math.cos(c.heading) * speed;
  c.pos.y += Math.sin(c.heading) * speed;
  clampToWorld(c);
}

export function turnToward(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + Math.max(-maxDelta, Math.min(maxDelta, diff));
}

function clampToWorld(c: Creature): void {
  c.pos.x = Math.max(20, Math.min(WORLD_WIDTH - 20, c.pos.x));
  c.pos.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, c.pos.y));
}
