/**
 * Utility-based behavior selection with hysteresis, plus activity effects.
 * Each candidate activity gets a score from needs and day-phase; the best
 * wins, but the current activity gets a bonus and a soft minimum duration
 * so creatures don't flicker. (Spec §4.3.)
 */
import type { Clock } from './clock';
import { moveToward, turnToward, wanderStep } from './movement';
import { nextRange } from './rng';
import { landingMediumOf, SPECIES, speedFor } from './species';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ActivityId,
  type Creature,
  type Vec2,
  type WorldState,
} from './state';
import { canOccupy, FOOD_SPOTS, GROVE_NEST, type FoodSpot } from './valley';

const HYSTERESIS_BONUS = 0.15;
/** A challenger this much stronger overrides min-duration (urgency). */
const URGENT_MARGIN = 0.35;
/** Needs below this are considered satisfied and end the activity. */
const SATISFIED = 0.05;
const SOCIAL_RANGE = 90;
const ARRIVE_DIST = 10;
const HERD_RADIUS = 350;
const HERD_TURN = 0.1;
/** How many of the nearest food spots a forager chooses between. */
const FORAGE_CHOICES = 3;
/** Radius of the scatter around the chosen food spot. */
const FORAGE_SPREAD = 24;
/** Herds share one patch: members space out along a ring on it (id-hashed). */
const HERD_FORAGE_RING = 55;
const HERD_FORAGE_SPREAD = 20;
/**
 * How far an unattached phoenix may drift from the ancient tree. Must exceed
 * the farthest grove food spot (471) plus the forage scatter (24), or the bird
 * would be yanked home mid-meal; `GROVE_FOOD_SPOTS` then keeps every phoenix
 * errand inside this radius, so the leash never interrupts one.
 */
const GROVE_LEASH = 520;
/** Activities in which a creature holds still — it must be able to stand there. */
const STOPPED_ACTIVITIES = new Set<ActivityId>(['idle', 'nap']);

/**
 * The food spots an unattached phoenix is allowed to choose between: those a
 * leashed bird can reach AND eat at without ever crossing GROVE_LEASH (the
 * scatter is added to the spot, so the spot itself must clear the margin).
 * A straight line between two points inside a disc stays inside it, so no
 * phoenix forage errand can ever trip the leash.
 */
const GROVE_FOOD_SPOTS: readonly FoodSpot[] = FOOD_SPOTS.filter(
  (s) => Math.hypot(s.x - GROVE_NEST.x, s.y - GROVE_NEST.y) <= GROVE_LEASH - FORAGE_SPREAD,
);

/** Can this creature come to rest exactly where it is standing? */
function restingIsLegal(c: Creature): boolean {
  return canOccupy(landingMediumOf(c.species), c.pos);
}

/** Centroid of same-species creatures other than `c` (herd species only call sites). */
function herdCentroid(state: WorldState, c: Creature): Vec2 | undefined {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const other of state.creatures) {
    if (other.id === c.id || other.species !== c.species) continue;
    sx += other.pos.x;
    sy += other.pos.y;
    n++;
  }
  if (n === 0) return undefined;
  return { x: sx / n, y: sy / n };
}

/** Beyond the herd's edge, lean the wander heading back toward the others. */
function applyHerdPull(state: WorldState, c: Creature): void {
  const centroid = herdCentroid(state, c);
  if (!centroid) return;
  if (Math.hypot(centroid.x - c.pos.x, centroid.y - c.pos.y) <= HERD_RADIUS) return;
  c.heading = turnToward(
    c.heading,
    Math.atan2(centroid.y - c.pos.y, centroid.x - c.pos.x),
    HERD_TURN,
  );
}

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

  // An unattached phoenix that has strayed out of the grove drops everything
  // and turns for the ancient tree (the leash itself lives in 'wander').
  if (strayedFromGrove(c)) {
    if (c.activity.id !== 'wander') startActivity(state, c, 'wander');
    return;
  }

  const scores = scoreActivities(state, c, clock);

  // A flier over the pond may not stop there: idling and napping never move,
  // so settling mid-water would strand it. Stopped activities are dropped
  // from the running entirely (rather than blocking the switch), so it picks
  // the best MOVING activity and rests once it is back over land.
  const canRest = restingIsLegal(c);

  let bestId: FreeActivityId = c.activity.id as FreeActivityId; // guarded above
  let bestScore = -Infinity;
  for (const [id, score] of Object.entries(scores) as [FreeActivityId, number][]) {
    if (!canRest && STOPPED_ACTIVITIES.has(id)) continue;
    const adjusted = id === c.activity.id ? score + HYSTERESIS_BONUS : score;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestId = id;
    }
  }

  if (bestId === c.activity.id) return;

  // Respect the soft minimum duration unless the challenger is urgent — or
  // unless the creature is stranded somewhere it cannot rest, in which case
  // getting moving again outranks hysteresis.
  const currentScore = scores[c.activity.id as FreeActivityId] + HYSTERESIS_BONUS;
  const challengerScore = scores[bestId];
  if (
    canRest &&
    c.activity.ticks < c.activity.minTicks &&
    challengerScore - currentScore < URGENT_MARGIN
  ) {
    return;
  }

  startActivity(state, c, bestId);
}

export function applyActivity(state: WorldState, c: Creature, _clock: Clock): void {
  c.activity.ticks++;
  const p = SPECIES[c.species];
  const medium = p.medium;
  const landing = landingMediumOf(c.species);

  switch (c.activity.id) {
    case 'idle':
      break;

    case 'wander': {
      if (p.herd) applyHerdPull(state, c);
      const leash = groveLeashTarget(state, c);
      if (leash) {
        if (moveToward(c, leash, speedFor(c.species, c.stage), medium, landing) <= ARRIVE_DIST) {
          c.activity.targetPos = undefined; // home again; drift on as normal
        }
        break;
      }
      // Aimless drifting uses the landing medium even for fliers: a bird
      // crosses the water on an errand, it doesn't hover over it for nothing.
      wanderStep(state.rng, c, speedFor(c.species, c.stage), landing);
      break;
    }

    case 'forage': {
      const target = c.activity.targetPos;
      if (!target) {
        startActivity(state, c, 'idle');
        break;
      }
      const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
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
        // Approach a point on a ring around the partner (deterministic per-id
        // angle, no RNG draws) so a group settles into a loose circle instead
        // of a conga line down one bearing.
        const ring = {
          x: partner.pos.x + Math.cos(idOffsetAngle(c.id)) * SOCIAL_RANGE * 0.45,
          y: partner.pos.y + Math.sin(idOffsetAngle(c.id)) * SOCIAL_RANGE * 0.45,
        };
        moveToward(c, ring, speedFor(c.species, c.stage), medium, landing);
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
        const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
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
        c.activity.targetPos = canOccupy(landing, candidate)
          ? candidate
          : { x: c.pos.x, y: c.pos.y };
      }
      const target = c.activity.targetPos;
      if (!target) break;
      const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
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
      moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
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

function startActivity(state: WorldState, c: Creature, requested: ActivityId): void {
  // Safety net for the internal "…and then go idle" paths: a creature that
  // cannot rest where it stands (a flier caught over the pond) drifts on
  // instead of settling on the water. One RNG draw either way.
  const id = STOPPED_ACTIVITIES.has(requested) && !restingIsLegal(c) ? 'wander' : requested;
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
      activity.targetPos = forageTarget(state, c);
      break;
    }
    case 'nap':
      activity.minTicks = 200; // naps are long and cozy
      break;
    case 'socialize': {
      activity.minTicks = 60;
      const partner = nearestOther(state, c);
      activity.targetId = partner?.id;
      // Nobody to sit with (a lone owl, a singular phoenix): fall back through
      // the same conversion, so a flier over the pond drifts on rather than
      // parking on open water.
      if (!partner) activity.id = restingIsLegal(c) ? 'idle' : 'wander';
      break;
    }
  }
}

/**
 * Where a forager goes to eat. Land-, air- and amphibious-landing creatures
 * head for the valley's larder (FOOD_SPOTS): a seeded pick among the three
 * nearest, plus a small scatter so a crowd spreads over the patch instead of
 * stacking on its centre. Three RNG draws (pick, scatter angle, scatter
 * distance).
 *
 * Water species are the exception: every food spot is dry land by definition,
 * so koi keep grazing open water sampled around themselves, exactly as before.
 */
function forageTarget(state: WorldState, c: Creature): Vec2 {
  const rng = state.rng;
  const species = SPECIES[c.species];
  const landing = landingMediumOf(c.species);

  if (landing === 'water') {
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = nextRange(rng, 0, Math.PI * 2);
      const dist = nextRange(rng, 150, 400);
      const candidate = clampToField(c.pos.x + Math.cos(angle) * dist, c.pos.y + Math.sin(angle) * dist);
      if (canOccupy(landing, candidate)) return candidate;
    }
    return { x: c.pos.x, y: c.pos.y };
  }

  // A herd grazes together: every deer eats at the one patch nearest the
  // herd's centre, then takes its own place on a ring around it (id-hashed,
  // no RNG) so they form a loose grazing arc rather than a pile. The anchor
  // deliberately INCLUDES the forager, so every member computes the same
  // centre and the herd can't split between two patches.
  // Solitary species choose among their own three nearest spots.
  const centroid = species.herd ? speciesCentroid(state, c) : undefined;
  const anchor = centroid ?? c.pos;
  const choices = species.herd ? 1 : FORAGE_CHOICES;
  const spread = species.herd ? HERD_FORAGE_SPREAD : FORAGE_SPREAD;

  // A leashed phoenix only ever eats at the grove, so no meal can pull it
  // past its leash (see GROVE_FOOD_SPOTS).
  const larder = leashedToGrove(c) && GROVE_FOOD_SPOTS.length > 0 ? GROVE_FOOD_SPOTS : FOOD_SPOTS;
  const near = nearestFoodSpots(larder, anchor, choices);
  const pick = near[Math.min(near.length - 1, Math.floor(nextRange(rng, 0, near.length)))];
  if (!pick) return { x: c.pos.x, y: c.pos.y }; // unreachable: FOOD_SPOTS is non-empty
  const ring = species.herd ? HERD_FORAGE_RING : 0;
  const ringAngle = idOffsetAngle(c.id);
  const angle = nextRange(rng, 0, Math.PI * 2);
  const dist = nextRange(rng, 0, spread);
  const candidate = clampToField(
    pick.x + Math.cos(ringAngle) * ring + Math.cos(angle) * dist,
    pick.y + Math.sin(ringAngle) * ring + Math.sin(angle) * dist,
  );
  return canOccupy(landing, candidate) ? candidate : { x: pick.x, y: pick.y };
}

/** Centroid of every creature of this species — the same value for each. */
function speciesCentroid(state: WorldState, c: Creature): Vec2 | undefined {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const other of state.creatures) {
    if (other.species !== c.species) continue;
    sx += other.pos.x;
    sy += other.pos.y;
    n++;
  }
  return n === 0 ? undefined : { x: sx / n, y: sy / n };
}

/** The `n` spots of `larder` closest to `p`, nearest first (stable, RNG-free). */
function nearestFoodSpots(larder: readonly FoodSpot[], p: Vec2, n: number): FoodSpot[] {
  return [...larder]
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
    .slice(0, n);
}

function clampToField(x: number, y: number): Vec2 {
  return {
    x: Math.max(40, Math.min(WORLD_WIDTH - 40, x)),
    y: Math.max(40, Math.min(WORLD_HEIGHT - 40, y)),
  };
}

/**
 * The phoenix's tether to the ancient tree: an unattached bird (a rebirth
 * chick whose family has dissolved, or a grown child) that drifts out of the
 * grove turns for home rather than free-roaming the valley. Same draw pattern
 * as family.ts's baby leash — two draws, once per outbound trip.
 */
/** An unattached phoenix belongs to the ancient tree. */
function leashedToGrove(c: Creature): boolean {
  return c.species === 'phoenix' && c.familyId === null;
}

function strayedFromGrove(c: Creature): boolean {
  if (!leashedToGrove(c)) return false;
  return Math.hypot(c.pos.x - GROVE_NEST.x, c.pos.y - GROVE_NEST.y) > GROVE_LEASH;
}

function groveLeashTarget(state: WorldState, c: Creature): Vec2 | undefined {
  if (!leashedToGrove(c)) return undefined;
  if (c.activity.targetPos) return c.activity.targetPos; // already heading home
  if (!strayedFromGrove(c)) return undefined;
  c.activity.targetPos = {
    x: GROVE_NEST.x + nextRange(state.rng, -60, 60),
    y: GROVE_NEST.y + nextRange(state.rng, -40, 40),
  };
  return c.activity.targetPos;
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

/** Deterministic per-creature angle (same trick as voice.ts's roll): id-hash → [0, 2π). */
export function idOffsetAngle(id: number): number {
  let h = Math.imul(id, 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97) >>> 0;
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}
