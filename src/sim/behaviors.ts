/**
 * Utility-based behavior selection with hysteresis, plus activity effects.
 * Each candidate activity gets a score from needs and day-phase; the best
 * wins, but the current activity gets a bonus and a soft minimum duration
 * so creatures don't flicker. (Spec §4.3.)
 */
import type { Clock } from './clock';
import { moveToward, wanderStep } from './movement';
import { nextRange } from './rng';
import { SPECIES, speedFor } from './species';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ActivityId,
  type Creature,
  type WorldState,
} from './state';
import { isWater } from './valley';

const HYSTERESIS_BONUS = 0.15;
/** A challenger this much stronger overrides min-duration (urgency). */
const URGENT_MARGIN = 0.35;
/** Needs below this are considered satisfied and end the activity. */
const SATISFIED = 0.05;
const SOCIAL_RANGE = 90;
const ARRIVE_DIST = 10;

export function decayNeeds(state: WorldState): void {
  for (const c of state.creatures) {
    const p = SPECIES[c.species];
    c.needs.hunger = clamp01(c.needs.hunger + p.needRates.hunger);
    if (c.activity.id !== 'nap') {
      c.needs.rest = clamp01(c.needs.rest + p.needRates.rest);
    }
    c.needs.social = clamp01(c.needs.social + p.needRates.social);
  }
}

/** Activities owned by family.ts — utility selection must not stomp them. */
const FAMILY_ACTIVITIES = new Set<ActivityId>(['court', 'brood', 'feedYoung', 'gather', 'pass']);

export function selectBehavior(state: WorldState, c: Creature, clock: Clock): void {
  if (FAMILY_ACTIVITIES.has(c.activity.id)) return;

  const scores = scoreActivities(state, c, clock);

  let bestId: FreeActivityId = c.activity.id as FreeActivityId; // guarded above
  let bestScore = -Infinity;
  for (const [id, score] of Object.entries(scores) as [FreeActivityId, number][]) {
    const adjusted = id === c.activity.id ? score + HYSTERESIS_BONUS : score;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestId = id;
    }
  }

  if (bestId === c.activity.id) return;

  // Respect the soft minimum duration unless the challenger is urgent.
  const currentScore = scores[c.activity.id as FreeActivityId] + HYSTERESIS_BONUS;
  const challengerScore = scores[bestId];
  if (c.activity.ticks < c.activity.minTicks && challengerScore - currentScore < URGENT_MARGIN) {
    return;
  }

  startActivity(state, c, bestId);
}

export function applyActivity(state: WorldState, c: Creature, _clock: Clock): void {
  c.activity.ticks++;
  const p = SPECIES[c.species];

  switch (c.activity.id) {
    case 'idle':
      break;

    case 'wander':
      wanderStep(state.rng, c, speedFor(c.species, c.stage));
      break;

    case 'forage': {
      const target = c.activity.targetPos;
      if (!target) {
        startActivity(state, c, 'idle');
        break;
      }
      const remaining = moveToward(c, target, speedFor(c.species, c.stage));
      if (remaining <= ARRIVE_DIST) {
        c.needs.hunger = clamp01(c.needs.hunger - p.eatRate);
        if (c.needs.hunger <= SATISFIED) startActivity(state, c, 'idle');
      }
      break;
    }

    case 'nap':
      c.needs.rest = clamp01(c.needs.rest - p.sleepRate);
      if (c.needs.rest <= SATISFIED) startActivity(state, c, 'idle');
      break;

    case 'socialize':
    case 'court': {
      const partner = state.creatures.find((o) => o.id === c.activity.targetId);
      if (!partner) {
        startActivity(state, c, 'idle');
        break;
      }
      const dist = Math.hypot(partner.pos.x - c.pos.x, partner.pos.y - c.pos.y);
      if (dist > SOCIAL_RANGE * 0.7) {
        moveToward(c, partner.pos, speedFor(c.species, c.stage));
      } else {
        c.needs.social = clamp01(c.needs.social - p.socialRate);
        if (c.activity.id === 'socialize' && c.needs.social <= SATISFIED) {
          startActivity(state, c, 'idle');
        }
      }
      break;
    }

    case 'brood': {
      // Walk to the clutch, then sit; brooding is restful.
      const target = c.activity.targetPos;
      if (target) {
        const remaining = moveToward(c, target, speedFor(c.species, c.stage));
        if (remaining <= ARRIVE_DIST) {
          c.needs.rest = clamp01(c.needs.rest - p.sleepRate * 0.5);
        }
      }
      break;
    }

    case 'feedYoung': {
      // Two legs: fetch food nearby (step 0), carry it home (step 1).
      if (c.activity.step === 0 && !c.activity.targetPos) {
        const angle = nextRange(state.rng, 0, Math.PI * 2);
        const dist = nextRange(state.rng, 140, 280);
        const candidate = {
          x: Math.max(40, Math.min(WORLD_WIDTH - 40, c.pos.x + Math.cos(angle) * dist)),
          y: Math.max(40, Math.min(WORLD_HEIGHT - 40, c.pos.y + Math.sin(angle) * dist)),
        };
        c.activity.targetPos = isWater(candidate) ? { x: c.pos.x, y: c.pos.y } : candidate;
      }
      const target = c.activity.targetPos;
      if (!target) break;
      const remaining = moveToward(c, target, speedFor(c.species, c.stage));
      if (remaining <= ARRIVE_DIST) {
        if (c.activity.step === 0) {
          // Food gathered — head home.
          const home = state.homes.find((h) => h.id === c.activity.targetId);
          if (!home) {
            startActivity(state, c, 'idle');
            break;
          }
          c.activity.step = 1;
          c.activity.targetPos = { ...home.pos };
        } else {
          // Deliver: feed every hungry baby in the family.
          for (const other of state.creatures) {
            if (other.familyId === c.familyId && other.stage === 'baby') {
              other.needs.hunger = clamp01(other.needs.hunger - 0.35);
            }
          }
          startActivity(state, c, 'idle');
        }
      }
      break;
    }

    case 'gather': {
      // Go to a point and settle there (nest-building, mourning, baby leash).
      const target = c.activity.targetPos;
      if (!target) break;
      moveToward(c, target, speedFor(c.species, c.stage));
      break;
    }

    case 'pass':
      // Stillness. The world gathers around them.
      break;
  }
}

/** Free-agent activities scored by utility (family duties are assigned, not scored). */
type FreeActivityId = 'forage' | 'nap' | 'socialize' | 'wander' | 'idle';

function scoreActivities(
  state: WorldState,
  c: Creature,
  clock: Clock,
): Record<FreeActivityId, number> {
  const p = SPECIES[c.species];
  const dayCurve = p.diurnal ? clock.light : 1 - clock.light;
  const partner = nearestOther(state, c);

  return {
    forage: c.needs.hunger * (0.3 + 0.7 * dayCurve),
    nap: c.needs.rest * (0.25 + 0.75 * (1 - dayCurve)),
    socialize: partner ? c.needs.social * (0.2 + 0.8 * dayCurve) : 0,
    wander: 0.12 * dayCurve,
    idle: 0.08,
  };
}

function startActivity(state: WorldState, c: Creature, id: ActivityId): void {
  const rng = state.rng;
  const activity = c.activity;
  activity.id = id;
  activity.ticks = 0;
  activity.targetPos = undefined;
  activity.targetId = undefined;

  switch (id) {
    case 'idle':
      activity.minTicks = Math.floor(nextRange(rng, 30, 80));
      break;
    case 'wander':
      activity.minTicks = Math.floor(nextRange(rng, 40, 120));
      break;
    case 'forage': {
      activity.minTicks = 40;
      // Pick a dry-land target; after a few tries, graze right here.
      let target = { x: c.pos.x, y: c.pos.y };
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = nextRange(rng, 0, Math.PI * 2);
        const dist = nextRange(rng, 150, 400);
        const candidate = {
          x: Math.max(40, Math.min(WORLD_WIDTH - 40, c.pos.x + Math.cos(angle) * dist)),
          y: Math.max(40, Math.min(WORLD_HEIGHT - 40, c.pos.y + Math.sin(angle) * dist)),
        };
        if (!isWater(candidate)) {
          target = candidate;
          break;
        }
      }
      activity.targetPos = target;
      break;
    }
    case 'nap':
      activity.minTicks = 200; // naps are long and cozy
      break;
    case 'socialize': {
      activity.minTicks = 60;
      const partner = nearestOther(state, c);
      activity.targetId = partner?.id;
      if (!partner) activity.id = 'idle';
      break;
    }
  }
}

function nearestOther(state: WorldState, c: Creature): Creature | undefined {
  let best: Creature | undefined;
  let bestDist = Infinity;
  for (const other of state.creatures) {
    if (other.id === c.id || other.species !== c.species) continue;
    const d = Math.hypot(other.pos.x - c.pos.x, other.pos.y - c.pos.y);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
