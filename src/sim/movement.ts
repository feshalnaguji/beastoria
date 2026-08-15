/**
 * Steering movement: seek/arrive toward targets, organic wandering.
 * No pathfinding by design — zones are authored open (spec §4.3).
 */
import { nextFloat, nextRange, type RngState } from './rng';
import { WORLD_HEIGHT, WORLD_WIDTH, type Creature, type Vec2 } from './state';
import { canOccupy, nearestRestable, POND, type Medium } from './valley';

const EDGE_MARGIN = 120;
const MAX_TURN = 0.3;

/**
 * Steer toward `target` and advance; returns remaining distance.
 * `medium` governs what the creature may pass through; `landing` (default:
 * the same) governs where it may come to rest — a flier crosses the pond on
 * 'air' but only snaps onto a target its 'land' landing medium allows.
 */
export function moveToward(
  c: Creature,
  target: Vec2,
  speed: number,
  medium: Medium,
  landing: Medium = medium,
): number {
  const dx = target.x - c.pos.x;
  const dy = target.y - c.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed) {
    if (canOccupy(landing, target)) {
      c.pos.x = target.x;
      c.pos.y = target.y;
    }
    return 0;
  }
  c.heading = turnToward(c.heading, Math.atan2(dy, dx), MAX_TURN);
  advance(c, speed, medium);
  return dist - speed;
}

/** Gentle random wander with occasional pauses; turns back near world edges. */
export function wanderStep(rng: RngState, c: Creature, speed: number, medium: Medium): void {
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

  advance(c, speed, medium);
}

/**
 * Step forward along the heading, respecting the creature's medium: blocked
 * creatures turn back toward their medium's heart and try a shorter step,
 * or stay put this tick.
 */
function advance(c: Creature, speed: number, medium: Medium): void {
  // Stranded in the wrong medium (a hand-placed spawn inside the pond, say):
  // strike out for the nearest legal ground WITHOUT testing the intermediate
  // step, or the creature would be pinned there forever — every short step
  // out of the middle of the pond is still in the pond.
  if (!canOccupy(medium, c.pos)) {
    const escape = nearestRestable(medium, c.pos);
    c.heading = turnToward(
      c.heading,
      Math.atan2(escape.y - c.pos.y, escape.x - c.pos.x),
      MAX_TURN * 2,
    );
    c.pos.x += Math.cos(c.heading) * speed;
    c.pos.y += Math.sin(c.heading) * speed;
    clampToWorld(c);
    return;
  }
  const candidate = {
    x: c.pos.x + Math.cos(c.heading) * speed,
    y: c.pos.y + Math.sin(c.heading) * speed,
  };
  if (!canOccupy(medium, candidate)) {
    // Land creatures turn away from the pond; water creatures turn back into it.
    const back =
      medium === 'water'
        ? Math.atan2(POND.y - c.pos.y, POND.x - c.pos.x)
        : Math.atan2(c.pos.y - POND.y, c.pos.x - POND.x);
    c.heading = turnToward(c.heading, back, MAX_TURN * 2);
    const retry = {
      x: c.pos.x + Math.cos(c.heading) * speed * 0.5,
      y: c.pos.y + Math.sin(c.heading) * speed * 0.5,
    };
    if (!canOccupy(medium, retry)) return; // stay put this tick
    c.pos.x = retry.x;
    c.pos.y = retry.y;
  } else {
    c.pos.x = candidate.x;
    c.pos.y = candidate.y;
  }
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
