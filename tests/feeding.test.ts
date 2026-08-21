/**
 * Feeding the way each species really does (M10 task 2): mammals nurse
 * (mother goes home and holds a stationary nursing stance, babies gathered
 * by the leash feed while she holds), birds carry (the pre-existing
 * fetch-then-deliver flow, untouched), and fish/amphibian young are
 * self-sufficient (no parental feed trigger at all; passive grazing keeps
 * them fed instead).
 *
 * M12: the hold became a *meeting* — parent and baby turn to face each
 * other, and hunger only transfers once a baby is actually in contact
 * (FEED_CONTACT_RANGE), not merely "in range" (FEED_RANGE). The nurse hold
 * gained explicit settle -> nurse -> linger steps; carry's delivery hold
 * gained a matching satisfied-linger step 4.
 */
import { describe, expect, it } from 'vitest';
import { decayNeeds } from '../src/sim/behaviors';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import { FOOD_SPOTS, nearestRestable } from '../src/sim/valley';
import {
  createWorld,
  spawnCreature,
  type Creature,
  type Family,
  type Home,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../src/sim/state';

// Pinned numeric contract (M10 task 2 review, renamed NURSE_RANGE -> FEED_RANGE
// in M11, restructured M12): these are literal copies of the tuning constants
// in src/sim/behaviors.ts and src/sim/family.ts, not imports of them — the
// point is to pin the actual contract so an accidental change to those
// constants fails a test here, not just silently reshapes the game.
const FEED_RANGE = 90;
/** M12: the radius hunger actually transfers at (FEED_RANGE is now only the
 * "eligible to approach/face" radius — see behaviors.ts). */
const FEED_CONTACT_RANGE = 40;
/** M12: turn rate (rad/tick) for the feeding-hold facing behavior. */
const FEED_TURN = 0.12;
/** M12: the nurse hold's three stationary sub-steps at home. */
const NURSE_SETTLE_TICKS = 30;
const NURSING_TICKS = 90;
/** M12: shared by carry's new step 4. */
const FEED_LINGER_TICKS = 40;
/** M12: total ticks for the nurse hold's full settle -> nurse -> linger
 * sequence (was a single 80-tick hold). */
const NURSE_HOLD_TICKS = NURSE_SETTLE_TICKS + NURSING_TICKS + FEED_LINGER_TICKS;
/** M12: retuned so total relief per hold still nets to ≈0.48 (the pre-M12
 * 80 × 0.006) despite only NURSING_TICKS of the 160-tick hold feeding. */
const NURSE_HUNGER_RATE = 0.48 / NURSING_TICKS;
const PICKUP_TICKS = 20;
const DELIVER_INTERVAL = 25;
const DELIVER_PORTION = 0.35;
const DELIVER_MAX_TICKS = 200;
// Mirrors behaviors.ts's module-private FORAGE_SPREAD (same convention as
// tests/foodspots.test.ts).
const FORAGE_SPREAD = 24;

function nearestSpotDist(p: Vec2): number {
  let best = Infinity;
  for (const s of FOOD_SPOTS) best = Math.min(best, Math.hypot(s.x - p.x, s.y - p.y));
  return best;
}

/** A world with exactly one eligible pair of `species`, spawned at `basePos`. */
function pairWorld(seed: number, species: SpeciesId, basePos: Vec2): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  for (const h of state.homes) h.familyId = null;
  const m = spawnCreature(state, species, { ...basePos }, 0.4);
  const f = spawnCreature(state, species, { x: basePos.x + 80, y: basePos.y + 20 }, 0.4);
  m.sex = 'm';
  f.sex = 'f';
  return state;
}

/** Tick until the (single) family reaches a phase, or fail. */
function runUntilPhase(state: WorldState, phase: string, maxTicks: number): void {
  for (let i = 0; i < maxTicks; i++) {
    tick(state, []);
    if (state.families[0]?.phase === phase) return;
  }
  throw new Error(`family never reached ${phase}`);
}

function parentsOf(state: WorldState, fam: Family): Creature[] {
  return fam.parentIds
    .map((id) => state.creatures.find((c) => c.id === id))
    .filter((c): c is Creature => c !== undefined);
}

/** Same mother-selection pattern as family.ts:251 / the brief. */
function motherOf(state: WorldState, fam: Family): Creature {
  const parents = parentsOf(state, fam);
  const mother = parents.find((p) => p.sex === 'f') ?? parents[0];
  if (!mother) throw new Error('no parents');
  return mother;
}

const LAND_BASE: Vec2 = { x: 2000, y: 1500 };
// A point already inside the pond (LILY_PATCHES site), snapped legal for water.
const WATER_BASE: Vec2 = nearestRestable('water', { x: 2950, y: 2250 });

/** Get a rabbit family to 'rearing' with hungry babies and run until the
 * mother's feedYoung activity reaches `step` (1 settle, 2 nursing, 3
 * linger). */
function reachNurseStep(
  seed: number,
  step: number,
): { state: WorldState; fam: Family; holder: Creature } {
  const state = pairWorld(seed, 'rabbit', LAND_BASE);
  runUntilPhase(state, 'rearing', 6000);
  const fam = state.families[0];
  if (!fam) throw new Error('no family');
  const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
  expect(babies.length).toBeGreaterThanOrEqual(2); // rabbit clutchMin is 2
  for (const b of babies) b.needs.hunger = 0.9;
  const mother = motherOf(state, fam);

  let holder: Creature | undefined;
  for (let i = 0; i < 1500; i++) {
    tick(state, []);
    const feeder = state.creatures.find(
      (c) => c.familyId === fam.id && c.activity.id === 'feedYoung',
    );
    if (feeder && feeder.activity.step === step) {
      holder = feeder;
      break;
    }
  }
  if (!holder) throw new Error(`nobody reached nurse step ${step}`);
  expect(holder.id).toBe(mother.id); // the feeder is always the mother
  return { state, fam, holder };
}

describe('nurse hold beats (M12): settle -> nurse -> linger', () => {
  it('walks steps 1 -> 2 -> 3 with the pinned durations (30/90/40) and relieves an in-contact baby by ≈0.48 total', () => {
    const { state, fam, holder } = reachNurseStep(8, 1);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const baby = babies[0];
    if (!baby) throw new Error('need a baby');
    baby.ageTicks = 0; // stay safely inside the baby stage for the whole hold
    baby.needs.hunger = 0.9;
    const growthRate = SPECIES.rabbit.needRates.hunger;
    const pin = (): void => {
      baby.pos = { x: holder.pos.x + (FEED_CONTACT_RANGE - 5), y: holder.pos.y };
    };
    pin();
    const startHunger = baby.needs.hunger;

    // Step 1: gather & settle — no relief, for exactly NURSE_SETTLE_TICKS.
    let settleTicks = 0;
    while (holder.activity.step === 1) {
      pin();
      const before = baby.needs.hunger;
      tick(state, []);
      settleTicks++;
      expect(baby.needs.hunger).toBeGreaterThanOrEqual(before); // never relieved yet
      if (settleTicks > NURSE_SETTLE_TICKS + 10) throw new Error('settle never ended');
    }
    expect(settleTicks).toBe(NURSE_SETTLE_TICKS);
    expect(holder.activity.step).toBe(2);

    // Step 2: nursing — relieved every tick, for exactly NURSING_TICKS.
    let nurseTicks = 0;
    while (holder.activity.step === 2) {
      pin();
      const before = baby.needs.hunger;
      tick(state, []);
      nurseTicks++;
      expect(baby.needs.hunger).toBeLessThan(before); // fed every nursing tick
      if (nurseTicks > NURSING_TICKS + 10) throw new Error('nursing never ended');
    }
    expect(nurseTicks).toBe(NURSING_TICKS);
    expect(holder.activity.step).toBe(3);

    // Step 3: satisfied linger — no more relief, for exactly FEED_LINGER_TICKS.
    let lingerTicks = 0;
    while (holder.activity.id === 'feedYoung') {
      pin();
      const before = baby.needs.hunger;
      tick(state, []);
      lingerTicks++;
      expect(baby.needs.hunger).toBeGreaterThanOrEqual(before); // never relieved
      if (lingerTicks > FEED_LINGER_TICKS + 10) throw new Error('linger never ended');
    }
    expect(lingerTicks).toBe(FEED_LINGER_TICKS);

    // Total relief across the whole hold, net of ordinary need growth that
    // ran every tick of all three steps (NURSE_HOLD_TICKS ticks total) —
    // kills a mutant that swaps NURSE_HUNGER_RATE for something else.
    const netChange = baby.needs.hunger - startHunger;
    const totalGrowth = NURSE_HOLD_TICKS * growthRate;
    const totalRelief = totalGrowth - netChange;
    expect(totalRelief).toBeCloseTo(0.48, 9);
    expect(totalRelief).toBeCloseTo(NURSING_TICKS * NURSE_HUNGER_RATE, 9);
  });
});

describe('feeding-hold facing (M12): parent and baby turn to meet', () => {
  it('(a) the mother\'s heading converges to within 0.2 rad of the bearing to her nearest baby within 40 ticks, turning at most FEED_TURN rad/tick', () => {
    const { state, fam, holder } = reachNurseStep(8, 1);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const baby = babies[0];
    if (!baby) throw new Error('need a baby');
    baby.ageTicks = 0;
    baby.pos = { x: holder.pos.x + (FEED_RANGE - 10), y: holder.pos.y };
    // Push every sibling well outside FEED_RANGE so `baby` is unambiguously
    // the nearest eligible baby the mother turns toward.
    for (const sibling of babies.slice(1)) {
      sibling.pos = { x: holder.pos.x + FEED_RANGE * 5, y: holder.pos.y };
    }
    const bearingToBaby = Math.atan2(baby.pos.y - holder.pos.y, baby.pos.x - holder.pos.x);
    holder.heading = bearingToBaby + Math.PI; // start facing directly away (worst case)

    const angleDiff = (a: number, b: number): number => {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };

    let converged = false;
    for (let i = 0; i < 40 && holder.activity.id === 'feedYoung'; i++) {
      const before = holder.heading;
      tick(state, []);
      const turned = Math.abs(angleDiff(holder.heading, before));
      expect(turned).toBeLessThanOrEqual(FEED_TURN + 1e-9);
      const bearing = Math.atan2(baby.pos.y - holder.pos.y, baby.pos.x - holder.pos.x);
      if (Math.abs(angleDiff(bearing, holder.heading)) <= 0.2) {
        converged = true;
        break;
      }
    }
    expect(converged).toBe(true);
  });
});

/**
 * The ring sits at 0.6 x FEED_CONTACT_RANGE (behaviors.ts's feedContactRing,
 * M12 fix round), not on the boundary itself — a review finding caught that
 * a ring target sitting exactly on FEED_CONTACT_RANGE made feeding a
 * gathered baby a coin-flip on float round-off after moveToward's exact
 * arrival snap. Pinned here so a regression to the boundary-exact radius
 * fails structurally rather than on the luck of one seed's geometry.
 */
const FEED_CONTACT_RING_RADIUS = FEED_CONTACT_RANGE * 0.6;
/** How far inside the feed gate the ring must land to count as "comfortably
 * inside" for these tests — well short of the ~16-unit margin the 0.6
 * multiplier actually leaves, so this never flakes on legal-ground clamping. */
const RING_MARGIN = 5;

describe('feeding contact ring (M12): eligible-but-not-in-contact babies get pulled in before being fed', () => {
  it('(b) a baby at distance 70 — inside FEED_RANGE, outside FEED_CONTACT_RANGE — is not fed until pulled to a ring point comfortably inside FEED_CONTACT_RANGE', () => {
    const { state, fam, holder } = reachNurseStep(8, 2); // the nursing step: feeding is live
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const baby = babies[0];
    if (!baby) throw new Error('need a baby');
    baby.ageTicks = 0;
    baby.needs.hunger = 0.9;
    baby.pos = { x: holder.pos.x + 70, y: holder.pos.y };
    const growthRate = SPECIES.rabbit.needRates.hunger;
    const before = baby.needs.hunger;

    tick(state, []);
    // Not fed this tick — only ordinary need growth applied.
    expect(baby.needs.hunger).toBeCloseTo(before + growthRate, 9);
    expect(baby.activity.id).toBe('gather'); // pulled toward the contact ring
    const target = baby.activity.targetPos;
    if (!target) throw new Error('no gather target');
    const targetDist = Math.hypot(target.x - holder.pos.x, target.y - holder.pos.y);
    // Structurally inside the gate — not merely <= FEED_CONTACT_RANGE
    // (which the old boundary-exact ring also satisfied "on the luck of
    // float round-off"), but clear of it by a real margin.
    expect(targetDist).toBeLessThanOrEqual(FEED_CONTACT_RING_RADIUS + 1e-6);
    expect(targetDist).toBeLessThanOrEqual(FEED_CONTACT_RANGE - RING_MARGIN);

    // She holds still (the nursing step never moves); run until the baby
    // arrives at the ring under its own gather movement (moveToward's exact
    // snap on arrival), then assert deterministically — not "eventually
    // across a loose scan" — that it lands strictly inside the gate and is
    // fed on the very next nursing tick.
    let arrived = false;
    for (let i = 0; i < 200 && !arrived; i++) {
      tick(state, []);
      const dist = Math.hypot(baby.pos.x - holder.pos.x, baby.pos.y - holder.pos.y);
      if (dist <= FEED_CONTACT_RING_RADIUS + 1e-6) arrived = true;
    }
    expect(arrived).toBe(true);
    const finalDist = Math.hypot(baby.pos.x - holder.pos.x, baby.pos.y - holder.pos.y);
    expect(finalDist).toBeLessThanOrEqual(FEED_CONTACT_RANGE - RING_MARGIN); // structurally inside the gate
    expect(holder.activity.id).toBe('feedYoung'); // still mid-hold
    expect(holder.activity.step).toBe(2); // still the nursing step

    const beforeFeed = baby.needs.hunger;
    tick(state, []);
    expect(baby.needs.hunger).toBeLessThan(beforeFeed); // fed deterministically, in contact
  });
});

describe('feeding contact ring consumes zero RNG draws (M12)', () => {
  it('(d) the RNG stream is byte-identical across a re-gather trigger', () => {
    const { state, fam, holder } = reachNurseStep(8, 2);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    // Zero out every need for every family member so ordinary utility
    // behavior selection has nothing that would make anyone switch off
    // their current activity this tick — isolates the RNG assertion to
    // exactly the leash's own re-gather trigger (which must draw nothing).
    for (const c of state.creatures) {
      if (c.familyId === fam.id) {
        c.needs.hunger = 0;
        c.needs.rest = 0;
        c.needs.social = 0;
      }
    }
    const straggler = babies[0];
    if (!straggler) throw new Error('need a baby');
    straggler.ageTicks = 0;
    straggler.activity = { id: 'idle', ticks: 0, minTicks: 1000 };
    straggler.pos = { x: holder.pos.x + FEED_CONTACT_RANGE + 20, y: holder.pos.y };
    // Every sibling already sits in contact and is already 'gather', so the
    // leash has nothing else to trigger this tick besides the straggler.
    for (const sibling of babies.slice(1)) {
      sibling.pos = { x: holder.pos.x + (FEED_CONTACT_RANGE - 5), y: holder.pos.y };
      sibling.activity = { id: 'gather', ticks: 0, minTicks: 30, targetPos: { ...sibling.pos } };
    }

    const before = [...state.rng];
    tick(state, []);
    expect(straggler.activity.id).toBe('gather'); // the trigger actually fired
    expect(state.rng).toEqual(before);
  });
});

describe('a nurse hold survives being loaded mid-hold (persisted-shape regression)', () => {
  it('resumes mid-step and completes the remaining steps on schedule — targetId is read only as home id, never as a tick marker', () => {
    // Regression for a review finding: activity.targetId is a PERSISTED
    // field carrying the home id for the whole feedYoung activity. An
    // earlier draft of the nurse hold repurposed it as a hold-start tick
    // marker once she arrived — fine for a freshly-triggered hold, but a
    // save captured mid-hold always has targetId == home.id, so loading it
    // and reinterpreting that as a tick count would freeze her until
    // activity.ticks exceeded the home's id. This constructs exactly that
    // "loaded mid-hold" shape (mid the nursing step, M12) and checks she
    // still finishes on schedule.
    const state = pairWorld(8, 'rabbit', LAND_BASE);
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const mother = motherOf(state, fam);
    const home = state.homes.find((h) => h.id === fam.homeId);
    if (!home) throw new Error('no home');
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    for (const b of babies) b.needs.hunger = 0.9;

    const alreadyElapsed = 30;
    mother.pos = { ...home.pos };
    mother.activity = {
      id: 'feedYoung',
      step: 2, // mid the nursing step
      ticks: alreadyElapsed,
      minTicks: NURSE_HOLD_TICKS,
      targetId: home.id, // legitimately home id — must NOT be read as a tick marker
    };
    const pinnedPos = { ...mother.pos };

    const expectedNurseRemaining = NURSING_TICKS - alreadyElapsed;
    let nurseTicks = 0;
    for (let i = 0; i < expectedNurseRemaining; i++) {
      expect(mother.activity.id).toBe('feedYoung'); // must not have ended early
      expect(mother.activity.step).toBe(2);
      tick(state, []);
      nurseTicks++;
      expect(mother.pos.x).toBeCloseTo(pinnedPos.x, 9);
      expect(mother.pos.y).toBeCloseTo(pinnedPos.y, 9);
    }
    expect(nurseTicks).toBe(expectedNurseRemaining);
    expect(mother.activity.step).toBe(3); // stepped into the linger right on schedule

    for (let i = 0; i < FEED_LINGER_TICKS; i++) {
      expect(mother.activity.id).toBe('feedYoung');
      tick(state, []);
    }
    expect(mother.activity.id).not.toBe('feedYoung'); // ended right on schedule
  });
});

describe('nurse leash tightens during the hold (M11, retightened M12)', () => {
  it('(f) a straggler beyond FEED_CONTACT_RANGE (but within BABY_LEASH) is pulled to the contact ring and fed', () => {
    const { state, fam, holder } = reachNurseStep(8, 2);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const baby = babies[0];
    if (!baby) throw new Error('need a baby');
    baby.needs.hunger = 0.9;
    baby.ageTicks = 0;
    // Beyond the contact ring's radius, but still well inside the ordinary
    // BABY_LEASH (140).
    baby.pos = { x: holder.pos.x + 100, y: holder.pos.y };

    tick(state, []);
    expect(baby.activity.id).toBe('gather'); // the tightened leash catches the straggler
    const target = baby.activity.targetPos;
    if (!target) throw new Error('no gather target');
    const targetDist = Math.hypot(target.x - holder.pos.x, target.y - holder.pos.y);
    // Structurally inside the gate (see FEED_CONTACT_RING_RADIUS above), not
    // merely <= FEED_CONTACT_RANGE — a ring sitting exactly on the boundary
    // made the feed that follows a coin-flip on float round-off.
    expect(targetDist).toBeLessThanOrEqual(FEED_CONTACT_RING_RADIUS + 1e-6);
    expect(targetDist).toBeLessThanOrEqual(FEED_CONTACT_RANGE - RING_MARGIN);

    // She holds still (established above); run until the baby arrives at
    // the ring under its own gather movement, then assert deterministically
    // that it lands strictly inside the gate and is fed on the very next
    // nursing tick — not "eventually fed across a loose scan".
    let arrived = false;
    for (let i = 0; i < 200 && !arrived; i++) {
      tick(state, []);
      const dist = Math.hypot(baby.pos.x - holder.pos.x, baby.pos.y - holder.pos.y);
      if (dist <= FEED_CONTACT_RING_RADIUS + 1e-6) arrived = true;
    }
    expect(arrived).toBe(true);
    const finalDist = Math.hypot(baby.pos.x - holder.pos.x, baby.pos.y - holder.pos.y);
    expect(finalDist).toBeLessThanOrEqual(FEED_CONTACT_RANGE - RING_MARGIN);
    expect(holder.activity.id).toBe('feedYoung'); // still mid-hold
    expect(holder.activity.step).toBe(2); // still the nursing step

    const beforeFeed = baby.needs.hunger;
    tick(state, []);
    expect(baby.needs.hunger).toBeLessThan(beforeFeed); // fed deterministically, in contact
  });
});

describe('passive grazing is species-gated', () => {
  it('a non-self-species baby (rabbit) does not passively graze — only ordinary need growth applies', () => {
    const state = pairWorld(11, 'rabbit', LAND_BASE);
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const baby = state.creatures.find((c) => fam.childIds.includes(c.id) && c.stage === 'baby');
    if (!baby) throw new Error('no baby');
    baby.needs.hunger = 0.2;
    const growthRate = SPECIES.rabbit.needRates.hunger;

    // Call decayNeeds directly (not a full tick()) so this is isolated from
    // any other hunger-affecting activity (forage, feedYoung) the baby or
    // its parents might independently be doing that tick — it targets
    // exactly the feedMode === 'self' gate inside decayNeeds.
    decayNeeds(state);
    expect(baby.needs.hunger).toBeCloseTo(0.2 + growthRate, 9);
  });
});

/** Get a robin family to 'rearing' with hungry babies and a claimed home. */
function reachCarryFamily(seed: number): { state: WorldState; fam: Family; home: Home } {
  const state = pairWorld(seed, 'robin', LAND_BASE);
  runUntilPhase(state, 'rearing', 6000);
  const fam = state.families[0];
  if (!fam) throw new Error('no family');
  const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
  expect(babies.length).toBeGreaterThan(0);
  for (const b of babies) b.needs.hunger = 0.9;
  const home = state.homes.find((h) => h.id === fam.homeId);
  if (!home) throw new Error('no home');
  return { state, fam, home };
}

/** Tick until a family member of `fam` enters feedYoung, or fail. */
function runUntilFeeder(state: WorldState, fam: Family, maxTicks: number): Creature {
  let feeder: Creature | undefined;
  for (let i = 0; i < maxTicks; i++) {
    tick(state, []);
    feeder = state.creatures.find((c) => c.familyId === fam.id && c.activity.id === 'feedYoung');
    if (feeder) break;
  }
  if (!feeder) throw new Error('nobody started feedYoung');
  return feeder;
}

/** Tick `feeder` (as part of `state`) until it reaches `step`, or fail. */
function runUntilStep(state: WorldState, feeder: Creature, step: number, maxTicks: number): void {
  for (let i = 0; i < maxTicks && feeder.activity.step !== step; i++) tick(state, []);
  expect(feeder.activity.step).toBe(step);
}

describe('carry (birds): robin — the four-step errand', () => {
  it('(a) step 0 seeks a real food spot (FOOD_SPOTS), not a raw random point', () => {
    const { state, fam, home } = reachCarryFamily(8);
    const feeder = runUntilFeeder(state, fam, 1500);
    expect(feeder.activity.step).toBe(0);
    const fetchTarget = feeder.activity.targetPos;
    if (!fetchTarget) throw new Error('no fetch target');
    // A real food spot within its forage scatter, not home itself.
    expect(nearestSpotDist(fetchTarget)).toBeLessThanOrEqual(FORAGE_SPREAD);
    expect(fetchTarget.x === home.pos.x && fetchTarget.y === home.pos.y).toBe(false);
  });

  it('(b) step 1 holds still for PICKUP_TICKS at the food spot before closing on home.pos', () => {
    const { state, fam, home } = reachCarryFamily(8);
    const feeder = runUntilFeeder(state, fam, 1500);
    runUntilStep(state, feeder, 1, 1500);
    const pickupSpot = { ...feeder.pos };
    const distToHomeAtPickup = Math.hypot(feeder.pos.x - home.pos.x, feeder.pos.y - home.pos.y);

    // Holds still for PICKUP_TICKS - 1 further ticks (the Nth tick since
    // arrival is the one that completes the hold and flips the step).
    let held = 0;
    for (let i = 0; i < PICKUP_TICKS - 1; i++) {
      tick(state, []);
      expect(feeder.activity.step).toBe(1);
      expect(feeder.pos.x).toBeCloseTo(pickupSpot.x, 9);
      expect(feeder.pos.y).toBeCloseTo(pickupSpot.y, 9);
      held++;
    }
    expect(held).toBe(PICKUP_TICKS - 1);

    // The pickup hold completes and the parent starts closing the distance
    // to home — she does not warp there, she visibly travels.
    tick(state, []);
    expect(feeder.activity.step).toBe(2);
    for (let i = 0; i < 20 && feeder.activity.step === 2; i++) tick(state, []);
    const distToHomeLater = Math.hypot(feeder.pos.x - home.pos.x, feeder.pos.y - home.pos.y);
    expect(distToHomeLater).toBeLessThan(distToHomeAtPickup);
  });

  it('step 2 carries home exactly, same as the pre-M11 carry-home leg', () => {
    const { state, fam, home } = reachCarryFamily(8);
    const feeder = runUntilFeeder(state, fam, 1500);
    runUntilStep(state, feeder, 2, 1500);
    const carryTarget = feeder.activity.targetPos;
    if (!carryTarget) throw new Error('no carry target');
    expect(carryTarget.x).toBeCloseTo(home.pos.x, 9);
    expect(carryTarget.y).toBeCloseTo(home.pos.y, 9);
  });
});

// Comfortable margins for the delivery-hold fixtures below (not boundary
// tests — the boundary itself is pinned in the nurse-contact-ring test
// above). The final approach tick can snap the parent several units closer
// to home than the position used to pin a baby that same tick (a pin taken
// BEFORE tick() reads the pre-snap position; movement resolves during the
// tick), so a pin sitting right at the FEED_CONTACT_RANGE boundary can
// spuriously miss the very first delivery on arrival. These stay well clear
// of that margin while remaining unambiguously "in range" / "out of range".
const IN_RANGE = FEED_CONTACT_RANGE - 15;
const IN_RANGE_2 = FEED_CONTACT_RANGE - 20;
const OUT_OF_RANGE = FEED_CONTACT_RANGE + 40;

describe('carry delivery (steps 3-4): sequenced, ranged, reported, and lingered', () => {
  /** Run a robin family to a delivery hold (feedYoung step 3), with two
   * hungry babies pinned at fixed distances from the feeder every tick so
   * neither their own movement nor the leash can contaminate the mechanic
   * under test (same pinning technique as the nurse-hold tests above). */
  function reachDeliveryHold(
    seed: number,
    babyDist: [number, number],
  ): {
    state: WorldState;
    fam: Family;
    feeder: Creature;
    babyA: Creature;
    babyB: Creature;
    pinAndSuppressExtras: () => void;
  } {
    const { state, fam } = reachCarryFamily(seed);
    const feeder = runUntilFeeder(state, fam, 1500);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const babyA = babies[0];
    const babyB = babies[1];
    if (!babyA || !babyB) throw new Error('need two babies');
    // Robin's clutch can be 3 — any sibling beyond A/B is kept satisfied
    // (hunger 0) every tick so it never competes for a delivery and
    // contaminates the A/B-only assertions below.
    const pinAndSuppressExtras = (): void => {
      babyA.pos = { x: feeder.pos.x + babyDist[0], y: feeder.pos.y };
      babyB.pos = { x: feeder.pos.x + babyDist[1], y: feeder.pos.y };
      for (const c of state.creatures) {
        if (fam.childIds.includes(c.id) && c.id !== babyA.id && c.id !== babyB.id) {
          c.needs.hunger = 0;
        }
      }
    };
    pinAndSuppressExtras();
    for (let i = 0; i < 3000 && feeder.activity.step !== 3; i++) {
      babyA.needs.hunger = 0.95;
      babyB.needs.hunger = 0.95;
      pinAndSuppressExtras();
      tick(state, []);
    }
    expect(feeder.activity.step).toBe(3);
    return { state, fam, feeder, babyA, babyB, pinAndSuppressExtras };
  }

  it('(c) feeds one hungry mouth at a time — hunger never drops for two babies on the same tick', () => {
    const { state, babyA, babyB, pinAndSuppressExtras } = reachDeliveryHold(8, [
      IN_RANGE,
      IN_RANGE_2,
    ]);
    let bothDroppedSameTick = 0;
    let anyDrop = false;
    for (let i = 0; i < DELIVER_INTERVAL * 6; i++) {
      babyA.needs.hunger = Math.max(babyA.needs.hunger, 0.5); // keep both eligible
      babyB.needs.hunger = Math.max(babyB.needs.hunger, 0.5);
      pinAndSuppressExtras();
      // Captured AFTER the eligibility reset above (not before it) — the
      // reset can itself raise hunger, which must never be misread as a
      // "drop" against a stale pre-reset value.
      const beforeA = babyA.needs.hunger;
      const beforeB = babyB.needs.hunger;
      tick(state, []);
      const droppedA = babyA.needs.hunger < beforeA - 1e-9;
      const droppedB = babyB.needs.hunger < beforeB - 1e-9;
      if (droppedA || droppedB) anyDrop = true;
      if (droppedA && droppedB) bothDroppedSameTick++;
    }
    expect(anyDrop).toBe(true);
    expect(bothDroppedSameTick).toBe(0);
  });

  it('(d) a baby parked beyond FEED_CONTACT_RANGE of the deliverer is never fed by a delivery', () => {
    const { state, babyA, babyB, pinAndSuppressExtras } = reachDeliveryHold(8, [
      IN_RANGE,
      OUT_OF_RANGE,
    ]);
    const startOutHunger = babyB.needs.hunger;
    for (let i = 0; i < DELIVER_INTERVAL * 4; i++) {
      babyA.needs.hunger = Math.max(babyA.needs.hunger, 0.5);
      pinAndSuppressExtras();
      tick(state, []);
    }
    // The out-of-range baby's hunger only ever grew from ordinary decay.
    expect(babyB.needs.hunger).toBeGreaterThanOrEqual(startOutHunger);
  });

  it('(e) TickOutput.feedings is non-empty exactly on delivery ticks and names the fed baby', () => {
    const { state, feeder, babyA, babyB, pinAndSuppressExtras } = reachDeliveryHold(8, [
      IN_RANGE,
      IN_RANGE_2,
    ]);
    let sawFeeding = false;
    for (let i = 0; i < DELIVER_INTERVAL * 4; i++) {
      babyA.needs.hunger = Math.max(babyA.needs.hunger, 0.5);
      babyB.needs.hunger = Math.max(babyB.needs.hunger, 0.5);
      pinAndSuppressExtras();
      // Captured AFTER the eligibility reset above, same reasoning as (c).
      const beforeA = babyA.needs.hunger;
      const beforeB = babyB.needs.hunger;
      const out = tick(state, []);
      const droppedA = babyA.needs.hunger < beforeA - 1e-9;
      const droppedB = babyB.needs.hunger < beforeB - 1e-9;
      if (droppedA || droppedB) {
        sawFeeding = true;
        expect(out.feedings.length).toBe(1);
        const feeding = out.feedings[0];
        if (!feeding) throw new Error('no feeding');
        expect(feeding.parentId).toBe(feeder.id);
        expect(feeding.babyId).toBe(droppedA ? babyA.id : babyB.id);
      } else {
        expect(out.feedings.length).toBe(0);
      }
    }
    expect(sawFeeding).toBe(true);
  });

  it('feeds the hungriest baby in range first, by exactly DELIVER_PORTION net of ordinary decay (strict > tie-break, array order)', () => {
    const { state, babyB, pinAndSuppressExtras } = reachDeliveryHold(8, [
      IN_RANGE,
      IN_RANGE_2,
    ]);
    const growthRate = SPECIES.robin.needRates.hunger;
    let fedId: number | undefined;
    let hungerBeforeFeed = 0;
    let hungerAfterFeed = 0;
    // A delivery fires at least once per DELIVER_INTERVAL ticks while both
    // babies stay hungry and in range, regardless of the hold's current
    // phase — loop one full interval (plus a margin) re-pinning every tick.
    for (let i = 0; i < DELIVER_INTERVAL + 5 && fedId === undefined; i++) {
      babyB.needs.hunger = 0.9; // strictly hungrier than its sibling — fed first
      pinAndSuppressExtras();
      hungerBeforeFeed = babyB.needs.hunger;
      const out = tick(state, []);
      if (out.feedings.length > 0) {
        fedId = out.feedings[0]?.babyId;
        hungerAfterFeed = babyB.needs.hunger;
      }
    }
    // Net of the one tick of ordinary need growth that always runs alongside
    // the delivery (decayNeeds runs before applyActivity every tick).
    expect(hungerAfterFeed).toBeCloseTo(hungerBeforeFeed + growthRate - DELIVER_PORTION, 9);
    expect(fedId).toBe(babyB.id);
  });

  it('(g) [M11/M12] a straggler beyond FEED_CONTACT_RANGE but within the old BABY_LEASH is pulled to the contact ring and fed during the step-3 delivery hold, instead of the errand bailing to idle', () => {
    // Mirrors the nurse-hold gather test above, but for the carry-mode
    // delivery hold: before the M11 fix, family.ts's leash only tightened
    // for feedMode === 'nurse' step 1, so a carry-mode straggler outside
    // the contact radius was never pulled in — the delivery hold's first
    // scan found nobody in range and bailed to 'idle' immediately,
    // discarding the fetched food.
    const { state, fam, feeder, babyA, babyB } = reachDeliveryHold(8, [IN_RANGE, IN_RANGE_2]);
    babyA.ageTicks = 0;
    babyB.ageTicks = 0;
    // babyB starts beyond FEED_CONTACT_RANGE but still inside BABY_LEASH
    // (140) — exactly the scenario the fix targets.
    babyB.pos = { x: feeder.pos.x + OUT_OF_RANGE, y: feeder.pos.y };
    babyB.needs.hunger = 0.9;

    tick(state, []);
    expect(babyB.activity.id).toBe('gather'); // the tightened delivery leash catches it
    const target = babyB.activity.targetPos;
    if (!target) throw new Error('no gather target');
    // Unlike the land-only rabbit tests above, a robin's home can sit near
    // the shore, so nearestRestable's legal-ground clamp can legitimately
    // push this target beyond FEED_CONTACT_RING_RADIUS (feedContactRing's
    // own documented caveat) — assert only the actual feed-gate bound here,
    // which the clamp itself is designed to respect.
    expect(Math.hypot(target.x - feeder.pos.x, target.y - feeder.pos.y)).toBeLessThanOrEqual(
      FEED_CONTACT_RANGE,
    );

    // Keep babyA pinned in range and hungry so the delivery hold has a
    // mouth to feed at every DELIVER_INTERVAL check and never bails early —
    // giving babyB's own gather movement room to close the gap. Any other
    // sibling is kept satisfied so it can't steal babyB's delivery.
    let fed = false;
    let closedIn = false;
    for (
      let i = 0;
      i < DELIVER_MAX_TICKS && feeder.activity.id === 'feedYoung' && feeder.activity.step === 3;
      i++
    ) {
      babyA.pos = { x: feeder.pos.x + IN_RANGE, y: feeder.pos.y };
      babyA.needs.hunger = Math.max(babyA.needs.hunger, 0.7);
      for (const c of state.creatures) {
        if (fam.childIds.includes(c.id) && c.id !== babyA.id && c.id !== babyB.id) {
          c.needs.hunger = 0;
        }
      }
      const before = babyB.needs.hunger;
      tick(state, []);
      const dist = Math.hypot(babyB.pos.x - feeder.pos.x, babyB.pos.y - feeder.pos.y);
      if (dist <= FEED_CONTACT_RANGE) closedIn = true;
      if (babyB.needs.hunger < before - 1e-9) fed = true;
    }
    expect(closedIn).toBe(true);
    expect(fed).toBe(true);
  });

  it('(h) [M11/M12] with NO sibling propping the hold in range, the delivery hold does not bail to idle on its very first tick — the leash gets a window to pull the straggler in before the errand would restart', () => {
    // Unlike (g), which kept babyA pinned in range every tick so there was
    // always a mouth to feed, this pins BOTH babies beyond
    // FEED_CONTACT_RANGE but within the old BABY_LEASH for the entire
    // run-up to step 3 — the exact gap (g) didn't cover. familySystem runs
    // before applyActivity each tick (Sim.ts's pipeline order), so on the
    // tick the parent's step flips 2 -> 3 (and the fall-through fires the
    // very first delivery scan that same tick), familySystem still saw the
    // parent in step 2 moments earlier: deliveringParent was undefined, the
    // leash was still the loose BABY_LEASH, and neither baby had been
    // pulled in yet. Before the fix, that first scan found nobody in range
    // and bailed straight to 'idle', discarding the food the parent just
    // carried home.
    const { state, fam, feeder, babyA, babyB } = reachDeliveryHold(8, [OUT_OF_RANGE, OUT_OF_RANGE]);
    babyA.ageTicks = 0;
    babyB.ageTicks = 0;

    // By the time reachDeliveryHold returns, that critical first scan has
    // already run (both babies were pinned OUT_OF_RANGE for the whole
    // run-up). The fix means the errand is still alive right here.
    expect(feeder.activity.id).toBe('feedYoung');
    expect(feeder.activity.step).toBe(3);

    let fed = false;
    let closedIn = false;
    for (
      let i = 0;
      i < DELIVER_MAX_TICKS && feeder.activity.id === 'feedYoung' && feeder.activity.step === 3;
      i++
    ) {
      babyA.needs.hunger = Math.max(babyA.needs.hunger, 0.7);
      babyB.needs.hunger = Math.max(babyB.needs.hunger, 0.7);
      for (const c of state.creatures) {
        if (fam.childIds.includes(c.id) && c.id !== babyA.id && c.id !== babyB.id) {
          c.needs.hunger = 0;
        }
      }
      const beforeA = babyA.needs.hunger;
      const beforeB = babyB.needs.hunger;
      tick(state, []);
      const distA = Math.hypot(babyA.pos.x - feeder.pos.x, babyA.pos.y - feeder.pos.y);
      const distB = Math.hypot(babyB.pos.x - feeder.pos.x, babyB.pos.y - feeder.pos.y);
      if (distA <= FEED_CONTACT_RANGE || distB <= FEED_CONTACT_RANGE) closedIn = true;
      if (babyA.needs.hunger < beforeA - 1e-9 || babyB.needs.hunger < beforeB - 1e-9) fed = true;
    }
    expect(closedIn).toBe(true);
    expect(fed).toBe(true);
  });

  it('(M12) once nobody is left to feed, the errand lingers at step 4 for FEED_LINGER_TICKS before releasing to idle', () => {
    const { state, feeder, babyA, babyB, pinAndSuppressExtras } = reachDeliveryHold(8, [
      IN_RANGE,
      IN_RANGE_2,
    ]);
    let sawStep4 = false;
    let idled = false;
    for (let i = 0; i < DELIVER_MAX_TICKS + FEED_LINGER_TICKS + 10 && !idled; i++) {
      // Keep both babies satisfied the whole time — nothing left to feed,
      // so the hold should move on to the linger instead of feeding forever.
      babyA.needs.hunger = 0;
      babyB.needs.hunger = 0;
      pinAndSuppressExtras();
      tick(state, []);
      if (feeder.activity.id === 'feedYoung' && feeder.activity.step === 4) sawStep4 = true;
      if (feeder.activity.id !== 'feedYoung') idled = true;
    }
    expect(sawStep4).toBe(true);
    expect(idled).toBe(true);
  });
});

describe('self (fish): koi', () => {
  it('no parent ever enters feedYoung; fry stay sustained by passive grazing', () => {
    const state = pairWorld(9, 'koi', WATER_BASE);
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const fryIds = new Set(fam.childIds);
    expect(fryIds.size).toBeGreaterThan(0);
    for (const c of state.creatures) {
      if (fryIds.has(c.id)) c.needs.hunger = 0.85;
    }

    for (let i = 0; i < 2000; i++) {
      tick(state, []);
      for (const c of state.creatures) {
        expect(c.activity.id).not.toBe('feedYoung');
        if (fryIds.has(c.id) && c.stage === 'baby') {
          expect(c.needs.hunger).toBeLessThan(0.9);
        }
      }
    }
  });
});
