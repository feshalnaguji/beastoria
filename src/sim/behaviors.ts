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
  isCarried,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ActivityId,
  type Creature,
  type Vec2,
  type WorldState,
} from './state';
import { canOccupy, FOOD_SPOTS, GROVE_NEST, nearestRestable, type FoodSpot, type Medium } from './valley';

const HYSTERESIS_BONUS = 0.15;
/** A challenger this much stronger overrides min-duration (urgency). */
const URGENT_MARGIN = 0.35;
/** Needs below this are considered satisfied and end the activity. */
const SATISFIED = 0.05;
const SOCIAL_RANGE = 90;
export const ARRIVE_DIST = 10;
/**
 * How long a 'gather' latch's `minTicks` must be to count as the mourning
 * vigil, as opposed to 'gather's two other, much shorter-lived reuses
 * (nest-building potter, baby leash — both 30 or less). Exported so
 * family.ts can define its own `PASS_GATHER_TICKS` in terms of this single
 * source of truth instead of a second hand-copied literal, and so this
 * file's own release backstop (the 'gather' case below) can hold the vigil
 * while releasing everything else. Renderer.ts and InspectCard.ts already
 * gate their own mourning-only presentation on this same value (today via
 * their own hand-copied constants) — sharing the name here is what lets a
 * future pass collapse those into an import instead of a third copy.
 */
export const MOURNING_GATHER_MIN_TICKS = 200;
/**
 * Is this activity a mourning vigil, as opposed to 'gather's two other
 * reuses? A vigil is released only by family.ts's `removeCreature`, once
 * the memorial forms — never by arrival or by this file's own timeout.
 */
export function isMourningGather(activity: Creature['activity']): boolean {
  return activity.id === 'gather' && activity.minTicks >= MOURNING_GATHER_MIN_TICKS;
}
/**
 * Belt-and-braces backstop for 'gather' (M13): every legitimate use is
 * expected to release itself — the mourning vigil for its own
 * MOURNING_GATHER_MIN_TICKS (via removeCreature), the nest-building potter
 * and the baby leash on arrival (family.ts). This timeout exists only so no
 * creature is EVER latched forever even if some future 'gather' use, or an
 * unreachable target, slips past every other release path — 900 is well
 * beyond any real errand (a few hundred ticks at most) but comfortably under
 * the property test's 1200-tick ceiling.
 */
const GATHER_MAX_TICKS = 900;
/**
 * Progress-bail window for a stalled socialize/court approach (M10): a
 * checkpoint of the creature's own position taken every this-many ticks,
 * reused from the activity's existing `targetPos` field so the bail is
 * stateless (no new Creature field) — see the socialize/court case.
 */
const PROGRESS_CHECK_TICKS = 100;
/** A stall checkpoint counts as "no progress" below this much net movement. */
const PROGRESS_MIN_DIST = 1;
/**
 * How close a baby must be to count as "eligible" during a feeding hold —
 * the radius a parent scans for the nearest baby to face, and (until M12)
 * the radius hunger actually transferred at. Demoted in M12: actual hunger
 * transfer now happens only within the tighter FEED_CONTACT_RANGE below —
 * this constant gates who counts as "on approach" for the facing behavior,
 * and family.ts's tightened gather leash. Also read directly by the
 * renderer for its "snuggled in" pose (src/render/Renderer.ts imports it).
 */
export const FEED_RANGE = 90;
/**
 * How close a baby must actually be for hunger to transfer during a
 * feeding hold — a nursing mother's nursing step, or a carry parent's
 * delivery hold (M12). Also the radius `feedContactRing` targets: once a
 * baby is this close it's "in contact" and turns to face the parent back
 * (see FEED_TURN). Tighter than FEED_RANGE — this is what stops feeding
 * reading as happening at arm's length; a baby inside FEED_RANGE but
 * outside this is pulled to a ring point on this radius (family.ts's
 * leash) before it is ever fed.
 */
export const FEED_CONTACT_RANGE = 40;
/**
 * Turn rate (rad/tick) for the feeding-hold facing behavior (M12): each
 * tick of a holding step, the parent turns toward its nearest eligible
 * baby and every in-contact baby turns back toward the parent. Gentle — an
 * about-face from directly opposed headings takes ~26 ticks (2.6s at 1x).
 */
const FEED_TURN = 0.12;
/**
 * The nurse hold's three stationary sub-steps at home (M12; was a single
 * 80-tick hold that fed every tick from arrival). Step 1 gather & settle:
 * babies close the last distance in, nobody fed yet. Step 2 nursing: the
 * only step that actually relieves hunger. Step 3 satisfied linger: the
 * meeting holds a moment before releasing. 30 + 90 + 40 = 160 ticks
 * (~16s at 1x) — family.ts's NURSE_HOLD_TICKS mirrors this sum for the
 * activity's initial minTicks bookkeeping.
 */
const NURSE_SETTLE_TICKS = 30;
const NURSING_TICKS = 90;
/** Shared by carry's step 4 (added M12) — see the case 'carry' block. */
const FEED_LINGER_TICKS = 40;
/**
 * Hunger relief per tick per baby in reach during the nursing step only
 * (M10; retuned M12). Retuned so total relief per hold still nets to
 * ≈0.48 — matching the pre-M12 80-tick hold's 80 × 0.006 — despite the
 * hold growing to a 160-tick settle/nurse/linger sequence in which only
 * 90 ticks (the nursing step) actually feed: 0.48 / NURSING_TICKS.
 */
const NURSE_HUNGER_RATE = 0.48 / NURSING_TICKS;
/** How often (in nurse-hold ticks) a nursed baby emits a feed-beat mote. */
const NURSE_MOTE_TICKS = 18;
/** How long a carry parent stands at the food spot before heading home (M11). */
const PICKUP_TICKS = 20;
/** How often (in delivery-hold ticks) a carry parent feeds the hungriest baby in reach. */
const DELIVER_INTERVAL = 25;
/** Hunger relief per delivered portion. */
const DELIVER_PORTION = 0.35;
/** Safety net: a delivery hold gives up after this many ticks regardless. */
const DELIVER_MAX_TICKS = 200;
/** Passive-graze hunger relief per tick for self-feeding babies (koi fry). */
const PASSIVE_GRAZE_RATE = 0.0015;
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

/** A transient "this baby just got fed" beat — never persisted, never logged. */
export interface Feeding {
  babyId: number;
  parentId: number;
  pos: Vec2;
}

/** Per-tick scratch space threaded through applyActivity for transient output. */
export interface TickScratch {
  feedings: Feeding[];
}

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

/**
 * The approach point on the ring around `partnerPos` for socialize/court: a
 * deterministic per-id angle (idOffsetAngle), no RNG draws, so a group
 * settles into a loose circle instead of a conga line down one bearing.
 * Clamped to legal ground (M10 fix): the raw ring can fall in the water for
 * a partner standing close to the shore, and an unclamped target left the
 * approach with nothing to reach — moveToward would refuse the final snap
 * every tick, forever.
 */
export function socializeRing(partnerPos: Vec2, id: number, landing: Medium): Vec2 {
  const raw = {
    x: partnerPos.x + Math.cos(idOffsetAngle(id)) * SOCIAL_RANGE * 0.45,
    y: partnerPos.y + Math.sin(idOffsetAngle(id)) * SOCIAL_RANGE * 0.45,
  };
  return nearestRestable(landing, raw);
}

/**
 * The point on a ring around `parentPos` a baby heads for during a feeding
 * hold (M12) — modelled line-for-line on socializeRing above: a
 * deterministic per-id angle (idOffsetAngle), zero RNG draws, so siblings
 * spread around the parent instead of stacking on one point. Clamped to
 * legal ground for the same reason socializeRing is — a raw ring point can
 * fall in the water for a parent standing close to shore. Replaces
 * family.ts's old two-draw ±25/±18 re-gather scatter for the in-hold case
 * specifically.
 *
 * The ring sits at 0.6 × FEED_CONTACT_RANGE, not exactly on it (review
 * finding, M12 fix round): `gather`'s moveToward snaps a baby's position
 * exactly onto this target on arrival, and float round-off after that snap
 * put the raw point outside the `<= FEED_CONTACT_RANGE` feed gate on
 * roughly half of sampled angles — a baby could walk to the ring, arrive,
 * and still never be fed. 0.6 leaves ~16 units of margin against that,
 * exactly the way socializeRing itself never sits its ring on SOCIAL_RANGE
 * (it uses SOCIAL_RANGE * 0.45).
 */
export function feedContactRing(parentPos: Vec2, babyId: number, landing: Medium): Vec2 {
  const ringRadius = FEED_CONTACT_RANGE * 0.6;
  const raw = {
    x: parentPos.x + Math.cos(idOffsetAngle(babyId)) * ringRadius,
    y: parentPos.y + Math.sin(idOffsetAngle(babyId)) * ringRadius,
  };
  return nearestRestable(landing, raw);
}

/**
 * The feeding hold's "meeting" (M12): every tick of a holding step, the
 * parent turns toward its nearest eligible baby (within FEED_RANGE) and
 * every baby already in contact (within FEED_CONTACT_RANGE) turns back to
 * face the parent. Deterministic, zero RNG draws — turnToward does the
 * actual work; this just picks who faces whom.
 */
function applyFeedFacing(state: WorldState, parent: Creature): void {
  let nearest: Creature | undefined;
  let nearestDist = Infinity;
  for (const other of state.creatures) {
    if (other.familyId === null || other.familyId !== parent.familyId || other.stage !== 'baby') {
      continue;
    }
    // A baby riding in the pouch (M12) shares its mother's exact position, so
    // there is no bearing between them to turn along — atan2(0, 0) is 0, and
    // facing it would slowly swing her round to due east for the whole hold.
    // It still FEEDS (the step-2 loop below has no such guard; distance 0 is
    // comfortably inside FEED_CONTACT_RANGE) — it just isn't turned toward.
    if (isCarried(other)) continue;
    const d = Math.hypot(other.pos.x - parent.pos.x, other.pos.y - parent.pos.y);
    if (d <= FEED_RANGE && d < nearestDist) {
      nearestDist = d;
      nearest = other;
    }
    if (d <= FEED_CONTACT_RANGE) {
      const bearing = Math.atan2(parent.pos.y - other.pos.y, parent.pos.x - other.pos.x);
      other.heading = turnToward(other.heading, bearing, FEED_TURN);
    }
  }
  if (nearest) {
    const bearing = Math.atan2(nearest.pos.y - parent.pos.y, nearest.pos.x - parent.pos.x);
    parent.heading = turnToward(parent.heading, bearing, FEED_TURN);
  }
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
    // Self-feeding young (koi fry etc., M10): no parent ever feeds them, so
    // they graze passively wherever they can legally rest — deterministic
    // arithmetic, no RNG draws.
    if (p.reproduction.feedMode === 'self' && c.stage === 'baby' && restingIsLegal(c)) {
      c.needs.hunger = clamp01(c.needs.hunger - PASSIVE_GRAZE_RATE);
    }
    if (c.activity.id !== 'nap') {
      c.needs.rest = clamp01(c.needs.rest + p.needRates.rest);
    }
    c.needs.social = clamp01(c.needs.social + p.needRates.social);
  }
}

/** Activities owned by family.ts — utility selection must not stomp them.
 * Exported so family.ts's own `releaseGathers` can release a creature from
 * ANY family-latching activity generically (today only 'gather' realistically
 * needs it, but this stays correct if a future latch — e.g. a pouch-mount
 * transition — joins the set without a matching update here). */
export const FAMILY_ACTIVITIES = new Set<ActivityId>(['court', 'brood', 'feedYoung', 'gather', 'pass']);

export function selectBehavior(state: WorldState, c: Creature, clock: Clock): void {
  // A passenger doesn't choose where to go (M12): a joey in the pouch must
  // never pick 'forage' or 'wander', both of which would try to walk it
  // somewhere its carrier isn't. Returning before scoreActivities also means
  // a carried creature draws nothing from the RNG stream at all.
  if (isCarried(c)) return;
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

export function applyActivity(
  state: WorldState,
  c: Creature,
  _clock: Clock,
  scratch?: TickScratch,
): void {
  c.activity.ticks++;

  // Carried creatures ride (M12). Their position is DERIVED from the carrier
  // rather than steered, so the movement switch below is skipped entirely —
  // but `activity.ticks` above and decayNeeds (its own pass in Sim.ts) keep
  // running, because a joey in the pouch still gets hungry and is still
  // nursed. Zero RNG draws on this path.
  //
  // Ordering: Sim.ts walks `state.creatures` in array order, and that array
  // is always sorted ascending by id (spawnCreature pushes with a
  // monotonically-increasing nextId; removal splices, which preserves
  // relative order; nothing sorts or re-inserts). A carrier is always born
  // before its rider, so it is always EARLIER in the array and has already
  // taken this tick's step by the time we get here — the rider reads a
  // current position, never a one-tick-stale one.
  if (isCarried(c)) {
    const carrier = state.creatures.find((o) => o.id === c.carriedBy);
    if (carrier) {
      // Field-by-field, never `c.pos = carrier.pos`: aliasing one Vec2 across
      // two creatures would survive into the save file as a shared reference
      // JSON silently duplicates, and would make either one's next step move
      // both.
      c.pos.x = carrier.pos.x;
      c.pos.y = carrier.pos.y;
      c.heading = carrier.heading;
    }
    // A missing carrier is not fixed up here — family.ts owns the link and
    // clears it the same tick (releaseStrandedRiders); this pass only ever
    // reads it.
    return;
  }

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
        const remaining = moveToward(c, leash, speedFor(c.species, c.stage), medium, landing);
        if (remaining >= 0 && remaining <= ARRIVE_DIST) {
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
      if (remaining >= 0 && remaining <= ARRIVE_DIST) {
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
        // of a conga line down one bearing — clamped to legal ground, so a
        // ring point that would fall in the water is never chased forever.
        const ring = socializeRing(partner.pos, c.id, landing);
        const remaining = moveToward(c, ring, speedFor(c.species, c.stage), medium, landing);
        if (remaining < 0) {
          // moveToward refused an illegal snap (shouldn't happen now that
          // the ring is clamped, but the contract says don't lie about it —
          // fall back exactly like the stall bail below).
          startActivity(state, c, 'wander');
          break;
        }

        // Progress bail: socialize ONLY. A stateless stall check reusing the
        // activity's own `targetPos` (otherwise unused here) as a checkpoint
        // of this creature's position, taken every PROGRESS_CHECK_TICKS
        // ticks; a full window with less than a world unit of net movement
        // drops the approach to 'wander' instead of holding forever.
        //
        // Court cannot use this: familySystem runs before applyActivity each
        // tick (Sim.ts's pipeline order) and re-imposes 'court' via
        // setIfFree the very same tick a bail would fire, so `startActivity`
        // here would be silently overwritten before a single wander step
        // ever executes — the bail would be pure dead code for court (plus a
        // wasted RNG draw on `startActivity`'s wander minTicks roll). Court's
        // own timeout is `family.ts`'s `COURT_TICKS` (300) instead; the ring
        // clamp above already means the illegal-target freeze this bail
        // exists for cannot occur during court either.
        if (c.activity.id === 'socialize' && c.activity.ticks % PROGRESS_CHECK_TICKS === 0) {
          const checkpoint = c.activity.targetPos;
          if (
            checkpoint &&
            Math.hypot(c.pos.x - checkpoint.x, c.pos.y - checkpoint.y) < PROGRESS_MIN_DIST
          ) {
            startActivity(state, c, 'wander');
            break;
          }
          c.activity.targetPos = { x: c.pos.x, y: c.pos.y };
        }
      } else {
        c.activity.targetPos = undefined; // clear the approach checkpoint
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
        if (remaining >= 0 && remaining <= ARRIVE_DIST) {
          c.needs.rest = clamp01(c.needs.rest - p.sleepRate * 0.5);
        }
      }
      break;
    }

    case 'feedYoung': {
      const feedMode = p.reproduction.feedMode; // reuse the in-scope species params
      switch (feedMode) {
        case 'nurse': {
          if (c.activity.step === 0 || c.activity.step === undefined) {
            // Step 0: go straight home — a nursing mother doesn't fetch food
            // afield first (no fetch trek, no RNG draws).
            const home = state.homes.find((h) => h.id === c.activity.targetId);
            if (!home) {
              startActivity(state, c, 'idle');
              break;
            }
            const remaining = moveToward(c, home.pos, speedFor(c.species, c.stage), medium, landing);
            if (remaining < 0) {
              startActivity(state, c, 'idle'); // refused snap — no safety net today
              break;
            }
            if (remaining <= ARRIVE_DIST) {
              c.activity.step = 1;
              c.activity.ticks = 0; // the settle step starts fresh; targetId still means home id
            }
            break;
          }

          // Steps 1 (gather & settle), 2 (nursing), 3 (satisfied linger,
          // M12): a stationary holding sequence at home, no travel.
          // `activity.ticks` was reset to 0 on each step's arrival, so it
          // counts that step directly; `targetId` is never repurposed and
          // keeps meaning "home id" for the whole activity — a pre-M10 save
          // landing mid-hold on load must not be misread as a tick count
          // (it isn't one). The parent-baby facing behavior runs every tick
          // of all three steps (deterministic, zero RNG draws); only step 2
          // actually relieves hunger.
          applyFeedFacing(state, c);

          if (c.activity.step === 2) {
            for (const other of state.creatures) {
              if (
                other.familyId !== null &&
                other.familyId === c.familyId &&
                other.stage === 'baby' &&
                Math.hypot(other.pos.x - c.pos.x, other.pos.y - c.pos.y) <= FEED_CONTACT_RANGE
              ) {
                other.needs.hunger = clamp01(other.needs.hunger - NURSE_HUNGER_RATE);
                // Stagger the feed-beat mote per baby via an id-hash offset
                // (no RNG draw) so siblings don't all sparkle on one tick.
                // Gated on hunger, same as the carry-delivery scan below, so
                // an already-sated baby doesn't get a milk-mote arcing to it.
                const phase = (c.activity.ticks + idHash(other.id)) % NURSE_MOTE_TICKS;
                if (phase === 0 && other.needs.hunger > SATISFIED) {
                  scratch?.feedings.push({
                    babyId: other.id,
                    parentId: c.id,
                    pos: { x: other.pos.x, y: other.pos.y },
                  });
                }
              }
            }
          }

          let stepTicks: number;
          if (c.activity.step === 1) stepTicks = NURSE_SETTLE_TICKS;
          else if (c.activity.step === 2) stepTicks = NURSING_TICKS;
          else stepTicks = FEED_LINGER_TICKS;

          if (c.activity.ticks >= stepTicks) {
            if (c.activity.step === 3) {
              startActivity(state, c, 'idle');
            } else {
              c.activity.step = c.activity.step + 1;
              c.activity.ticks = 0;
            }
          }
          break;
        }

        case 'carry': {
          // Birds. A four-step errand (M11): 0 seek real food, 1 a stationary
          // pickup pause at the berry cluster, 2 carry it home (unchanged
          // from before), 3 a stationary delivery hold that feeds one
          // hungry mouth at a time. `targetId` is never repurposed — it
          // keeps meaning "home id" for the whole activity, exactly like the
          // nurse flow above, so a pre-M11 save caught mid-errand re-enters
          // harmlessly under the new numbering: every step re-derives its
          // own target from scratch. A save frozen at old step 1
          // (carry-home) now reads as a PICKUP_TICKS pickup pause standing
          // wherever it was — then step 2 sets targetPos from targetId's
          // home and arrives at once (it was already there), then step 3
          // delivers. Nothing is lost, nothing is misread.

          // Step 0: seek food — the same larder every forage errand uses
          // (larder swap, phoenix grove leash, ground-walker reed filter),
          // so a parent visibly forages before carrying food home instead of
          // beelining a raw random point.
          if (c.activity.step === 0) {
            if (!c.activity.targetPos) {
              c.activity.targetPos = forageTarget(state, c);
            }
            const target = c.activity.targetPos;
            const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
            if (remaining < 0) {
              startActivity(state, c, 'idle'); // refused snap — no safety net today
              break;
            }
            if (remaining <= ARRIVE_DIST) {
              c.activity.step = 1;
              c.activity.ticks = 0; // pickup pause starts fresh
            }
            break;
          }

          // Step 1: a stationary pickup pause at the food spot (`clipFor`
          // already yields 'eat' for a stationary feedYoung) — PICKUP_TICKS
          // long, then head home.
          if (c.activity.step === 1) {
            if (c.activity.ticks >= PICKUP_TICKS) {
              const home = state.homes.find((h) => h.id === c.activity.targetId);
              if (!home) {
                startActivity(state, c, 'idle');
                break;
              }
              c.activity.step = 2;
              c.activity.targetPos = { ...home.pos };
            }
            break;
          }

          // Step 2: carry the food home (today's carry-home leg, unchanged).
          if (c.activity.step === 2) {
            const target = c.activity.targetPos;
            if (!target) {
              startActivity(state, c, 'idle');
              break;
            }
            const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);
            if (remaining < 0) {
              startActivity(state, c, 'idle'); // refused snap — no safety net today
              break;
            }
            if (remaining > ARRIVE_DIST) break; // still travelling
            c.activity.step = 3;
            c.activity.ticks = 0; // fall through: the delivery hold below fires this same tick
          }

          // By this point step is 3 (deliver) or 4 (satisfied linger,
          // M12) — both are stationary holding steps at the nest, so the
          // parent-baby facing behavior runs throughout (same mechanic as
          // the nurse hold above; deterministic, zero RNG draws).
          applyFeedFacing(state, c);

          // Step 3: a stationary delivery hold at the nest. Every
          // DELIVER_INTERVAL ticks (the fall-through above means the first
          // delivery fires immediately at ticks === 0), find the hungriest
          // family baby within FEED_CONTACT_RANGE whose hunger exceeds
          // SATISFIED — array order with a strict `>` while tracking the
          // max, so ties resolve to array order and no RNG is drawn — and
          // feed it one DELIVER_PORTION. Ends (into step 4, the linger)
          // when nobody is left to feed, or after DELIVER_MAX_TICKS as a
          // safety net.
          if (c.activity.step === 3) {
            if (c.activity.ticks % DELIVER_INTERVAL === 0) {
              let hungriest: Creature | undefined;
              let maxHunger = -Infinity;
              for (const other of state.creatures) {
                if (
                  other.familyId !== null &&
                  other.familyId === c.familyId &&
                  other.stage === 'baby' &&
                  other.needs.hunger > SATISFIED &&
                  other.needs.hunger > maxHunger &&
                  Math.hypot(other.pos.x - c.pos.x, other.pos.y - c.pos.y) <= FEED_CONTACT_RANGE
                ) {
                  maxHunger = other.needs.hunger;
                  hungriest = other;
                }
              }
              if (!hungriest) {
                // Don't give up on the very first scan (ticks === 0): that
                // scan runs on the same tick the parent stepped 2 -> 3,
                // before this tick's familySystem had a chance to see the
                // parent delivering and tighten the baby leash (Sim.ts runs
                // familySystem before applyActivity, so `deliveringParent`
                // was still undefined a moment ago). Give the tightened
                // leash at least one more tick to pull a straggler into
                // FEED_CONTACT_RANGE before bailing — DELIVER_MAX_TICKS
                // remains the real timeout.
                if (c.activity.ticks > 0) {
                  c.activity.step = 4;
                  c.activity.ticks = 0; // satisfied linger starts fresh
                }
                break;
              }
              hungriest.needs.hunger = clamp01(hungriest.needs.hunger - DELIVER_PORTION);
              scratch?.feedings.push({
                babyId: hungriest.id,
                parentId: c.id,
                pos: { x: hungriest.pos.x, y: hungriest.pos.y },
              });
            }
            if (c.activity.ticks >= DELIVER_MAX_TICKS) {
              c.activity.step = 4;
              c.activity.ticks = 0; // satisfied linger starts fresh
            }
            break;
          }

          // Step 4 (M12): a satisfied linger, mirroring the nurse hold's
          // step 3 — the meeting holds a moment before releasing.
          if (c.activity.ticks >= FEED_LINGER_TICKS) {
            startActivity(state, c, 'idle');
          }
          break;
        }

        case 'self':
          // family.ts never triggers feedYoung for a 'self' species (the
          // whole feed-trigger block is skipped for it) — reaching this
          // means that guarantee broke somewhere upstream. Fail loudly
          // rather than silently idling.
          throw new Error(`feedYoung reached for a 'self'-mode species: ${c.species}`);
        default:
          // Exhaustiveness net: every known feedMode is cased above, so
          // this only fires if a future mode is added to species.ts
          // without a matching case here.
          assertNever(feedMode);
      }
      break;
    }

    case 'gather': {
      // Go to a point and settle there (nest-building, mourning, baby leash).
      // Movement always happens first (unconditionally) — the mourning
      // vigil still needs to walk in to sit with the elder, exactly as
      // before; only what happens AFTER moving differs.
      const target = c.activity.targetPos;
      if (!target) {
        // A vigil always carries a targetPos (handlePassings sets one); if
        // one somehow didn't, don't touch it. Everything else with no
        // target has nothing to do here — release rather than latch mute.
        if (!isMourningGather(c.activity)) startActivity(state, c, 'idle');
        break;
      }
      const remaining = moveToward(c, target, speedFor(c.species, c.stage), medium, landing);

      // The vigil holds for its full duration regardless of arrival or
      // ticks — released only by family.ts's removeCreature once the
      // memorial forms.
      if (isMourningGather(c.activity)) break;

      // Belt-and-braces (M13): family.ts is expected to release every
      // 'gather' it assigns on arrival (and does, for the nest-building
      // potter and the baby leash's home-anchored case) — the "arrived"
      // exit below is redundant insurance for those. The one deliberate
      // exception is the baby leash's moving feed-hold anchor, which uses
      // minTicks 0 specifically so it is NOT released here while a feeding
      // hold is active (family.ts re-targets it every tick instead) — the
      // hold is bounded and ends on its own. `remaining < 0` (a refused
      // snap onto an illegal target) and the GATHER_MAX_TICKS timeout both
      // release unconditionally, so nothing can ever be latched forever.
      const arrived = remaining >= 0 && remaining <= ARRIVE_DIST && c.activity.minTicks > 0;
      const stuck = remaining < 0 || c.activity.ticks >= GATHER_MAX_TICKS;
      if (arrived || stuck) {
        // startActivity, not a bare assignment: converts to 'wander' for a
        // flier that cannot legally rest exactly where it stands, instead
        // of stranding it in an illegal 'idle'.
        startActivity(state, c, 'idle');
      }
      break;
    }

    case 'pass':
      // Stillness. The world gathers around them.
      break;

    default: {
      // Exhaustiveness net (M13 Task 0): a compile error here means a new
      // ActivityId was added to state.ts without a matching case above. No
      // runtime throw — unlike feedMode's assertNever — because a
      // forward-compatible save carrying an activity id from a future
      // version must never crash the tick loop; it just falls through as a
      // silent no-op for this tick.
      const _exhaustive: never = c.activity.id;
      void _exhaustive;
      break;
    }
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
    case 'idle': {
      // Per-species dart-and-pause override (M10 task 3); default 30-80.
      const range = SPECIES[c.species].idleMinTicks ?? { min: 30, max: 80 };
      activity.minTicks = Math.floor(nextRange(rng, range.min, range.max));
      break;
    }
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
export function forageTarget(state: WorldState, c: Creature): Vec2 {
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
  const near = nearestFoodSpots(larder, anchor, choices, species.medium);
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

/**
 * The `n` spots of `larder` closest to `p`, nearest first (stable, RNG-free).
 * Ground-walking land species (rabbit, deer, dodo — `medium === 'land'`)
 * never get offered the reed spots on the pond's dry shore band: those spots
 * are legal ground, but a rabbit visibly walking the feathered sand out to
 * them reads to a watching player as "on the water" (M10). Flying species
 * that only LAND on 'land' (robin/owl/phoenix, `medium === 'air'`) and
 * amphibious/water species are unaffected — they don't walk the shore to get
 * there, so the ambiguity doesn't apply.
 */
function nearestFoodSpots(
  larder: readonly FoodSpot[],
  p: Vec2,
  n: number,
  medium: Medium,
): FoodSpot[] {
  // Deliberately `medium`, not `landingMediumOf`: robin/owl/phoenix land on
  // 'land' too, but they fly in — they never walk the feathered sand band to
  // get there, so the visual ambiguity this filter exists for doesn't apply
  // to them, and they keep the reed spots as candidates.
  const pool = medium === 'land' ? larder.filter((s) => s.zone !== 'pond') : larder;
  return [...pool]
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

/**
 * Exhaustiveness guard for feedMode dispatch: a compile error here means a
 * new `reproduction.feedMode` value was added to species.ts without a
 * matching case in the feedYoung switch; a runtime throw here means some
 * upstream guarantee (e.g. family.ts never triggering feedYoung for a
 * 'self' species) broke.
 */
function assertNever(x: never): never {
  throw new Error(`unreachable feedMode: ${JSON.stringify(x)}`);
}

/** Deterministic per-id hash mix (same trick as voice.ts's roll) — a uint32
 * spread uniformly over its range. idOffsetAngle below turns it into an
 * angle; InspectCard.ts (M10 task 5's tap-to-inspect) reuses it directly for
 * a deterministic name-list index instead of duplicating the mix. */
export function idHash(id: number): number {
  let h = Math.imul(id, 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Deterministic per-creature angle: id-hash → [0, 2π). */
export function idOffsetAngle(id: number): number {
  return (idHash(id) / 4294967296) * Math.PI * 2;
}
