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
 * Steer toward `target` and advance; returns remaining distance, or -1 if
 * within snapping range but the target is illegal ground for `landing` (the
 * snap was refused, and the creature did not move this tick — callers that
 * treat any non-positive return as "arrived" must guard against this; see
 * behaviors.ts's socialize/court case, the one caller that acts on it).
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
      return 0;
    }
    return -1; // refused the snap — do not lie about having arrived
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
  // strike out for the nearest legal ground. Every candidate step is
  // checked, mirroring the legal branch below (full step, then a turned-back
  // half-step retry) — never a blind step. A step "counts" if it reaches
  // legal ground outright, or if it is at least strictly nearer the escape
  // point than staying put: literal canOccupy is too strict a gate here on
  // its own (a creature more than one step's distance from shore would never
  // find a single LEGAL candidate until the last tick of the crossing, and
  // gating on canOccupy alone would hold it in place forever — trading the
  // water-walking bug for a permanent freeze, which is exactly what this
  // milestone is against). The combined check still guarantees the two
  // things that matter: no candidate is ever accepted blind, and no tick
  // ever drifts deeper into the water — only outright-legal or strictly
  // closer-to-shore steps are taken, so it can only approach the boundary,
  // never recede from it.
  if (!canOccupy(medium, c.pos)) {
    const escape = nearestRestable(medium, c.pos);
    const currentDist = Math.hypot(escape.x - c.pos.x, escape.y - c.pos.y);
    c.heading = turnToward(
      c.heading,
      Math.atan2(escape.y - c.pos.y, escape.x - c.pos.x),
      MAX_TURN * 2,
    );
    const full = {
      x: c.pos.x + Math.cos(c.heading) * speed,
      y: c.pos.y + Math.sin(c.heading) * speed,
    };
    if (canOccupy(medium, full) || Math.hypot(full.x - escape.x, full.y - escape.y) < currentDist) {
      c.pos.x = full.x;
      c.pos.y = full.y;
      clampToWorld(c);
      return;
    }
    const half = {
      x: c.pos.x + Math.cos(c.heading) * speed * 0.5,
      y: c.pos.y + Math.sin(c.heading) * speed * 0.5,
    };
    if (canOccupy(medium, half) || Math.hypot(half.x - escape.x, half.y - escape.y) < currentDist) {
      c.pos.x = half.x;
      c.pos.y = half.y;
      clampToWorld(c);
      return;
    }
    return; // neither candidate makes progress: hold rather than drift deeper
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
