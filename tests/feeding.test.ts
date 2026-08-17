/**
 * Feeding the way each species really does (M10 task 2): mammals nurse
 * (mother goes home and holds a stationary nursing stance, babies gathered
 * by the leash feed while she holds), birds carry (the pre-existing
 * fetch-then-deliver flow, untouched), and fish/amphibian young are
 * self-sufficient (no parental feed trigger at all; passive grazing keeps
 * them fed instead).
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
// in M11): the nurse hold reaches out FEED_RANGE units, lasts NURSE_HOLD_TICKS
// decay ticks, and relieves NURSE_HUNGER_RATE hunger per tick per baby in
// reach. These are literal copies of the tuning constants in src/sim/
// behaviors.ts and src/sim/family.ts, not imports of them — the point is to
// pin the actual contract so an accidental change to those constants fails a
// test here, not just silently reshapes the game.
const FEED_RANGE = 90;
const NURSE_HOLD_TICKS = 80;
const NURSE_HUNGER_RATE = 0.006;
const NURSE_GATHER_RADIUS = 60;
const PICKUP_TICKS = 20;
const DELIVER_INTERVAL = 25;
const DELIVER_PORTION = 0.35;
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
 * mother enters her stationary nursing hold (feedYoung step 1). */
function reachNurseHold(seed: number): { state: WorldState; fam: Family; holder: Creature } {
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
    if (feeder && feeder.activity.step === 1) {
      holder = feeder;
      break;
    }
  }
  if (!holder) throw new Error('nobody entered the nursing hold');
  expect(holder.id).toBe(mother.id); // the feeder is always the mother
  return { state, fam, holder };
}

describe('nurse (mammals): rabbit', () => {
  it('holds stationary; feeds a baby just inside FEED_RANGE, not one just outside it, for exactly NURSE_HOLD_TICKS, at NURSE_HUNGER_RATE', () => {
    const { state, fam, holder } = reachNurseHold(8);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const babyIn = babies[0];
    const babyOut = babies[1];
    if (!babyIn || !babyOut) throw new Error('need two babies');
    babyIn.ageTicks = 0; // stay safely inside the baby stage for the whole hold
    babyOut.ageTicks = 0;
    babyIn.needs.hunger = 0.9;
    babyOut.needs.hunger = 0.9;
    const growthRate = SPECIES.rabbit.needRates.hunger;

    // Pin each baby at a fixed distance from her every tick (as the M10
    // ruling's mother-anchored baby-leash would in practice): 89 units is
    // just inside FEED_RANGE (90), 91 just outside. The babies are
    // otherwise free agents with their own hunger-driven forage/wander
    // behavior; re-pinning every tick, BEFORE each tick() call, means
    // moveToward never sees them arrive anywhere under their own power (the
    // position it computes from is overwritten again next tick), so neither
    // baby's own foraging can contaminate the hunger arithmetic under test.
    const pin = (b: Creature, dist: number): void => {
      b.pos = { x: holder.pos.x + dist, y: holder.pos.y };
    };
    pin(babyIn, FEED_RANGE - 1);
    pin(babyOut, FEED_RANGE + 1);
    const pinnedMotherPos = { ...holder.pos };
    const startInHunger = babyIn.needs.hunger;
    const startOutHunger = babyOut.needs.hunger;
    let prevInHunger = startInHunger;
    let holdTicks = 0;

    for (
      let i = 0;
      i < NURSE_HOLD_TICKS + 5 && holder.activity.id === 'feedYoung' && holder.activity.step === 1;
      i++
    ) {
      pin(babyIn, FEED_RANGE - 1);
      pin(babyOut, FEED_RANGE + 1);
      tick(state, []);
      holdTicks++;
      expect(holder.pos.x).toBeCloseTo(pinnedMotherPos.x, 9); // stationary hold
      expect(holder.pos.y).toBeCloseTo(pinnedMotherPos.y, 9);
      expect(babyIn.needs.hunger).toBeLessThan(prevInHunger); // fed every hold tick
      prevInHunger = babyIn.needs.hunger;
    }

    // The hold lasts exactly NURSE_HOLD_TICKS decay ticks.
    expect(holdTicks).toBe(NURSE_HOLD_TICKS);

    // The baby just outside FEED_RANGE was never fed — its hunger only
    // ever grew from ordinary need decay, never relieved.
    expect(babyOut.needs.hunger).toBeCloseTo(startOutHunger + NURSE_HOLD_TICKS * growthRate, 6);

    // Rate: total relief to the in-range baby over the hold matches
    // NURSE_HOLD_TICKS × NURSE_HUNGER_RATE, net of the ordinary need growth
    // that ran alongside it every tick (kills a mutant that swaps
    // NURSE_HUNGER_RATE for something growth-rate-scaled, e.g. 0.0008).
    const netChange = babyIn.needs.hunger - startInHunger;
    const totalGrowth = NURSE_HOLD_TICKS * growthRate;
    const totalRelief = totalGrowth - netChange;
    expect(totalRelief).toBeCloseTo(NURSE_HOLD_TICKS * NURSE_HUNGER_RATE, 3);
  });
});

describe('a nurse hold survives being loaded mid-hold (persisted-shape regression)', () => {
  it('resumes and completes in exactly (minTicks - elapsed) ticks — targetId is read only as home id, never as a tick marker', () => {
    // Regression for a review finding: activity.targetId is a PERSISTED
    // field carrying the home id for the whole feedYoung activity. An
    // earlier draft of the nurse hold repurposed it as a hold-start tick
    // marker once she arrived — fine for a freshly-triggered hold, but a
    // save captured mid-hold (pre- or post-M10) always has targetId ==
    // home.id, so loading it and reinterpreting that as a tick count would
    // have frozen her until activity.ticks exceeded the home's id. This
    // constructs exactly that "loaded mid-hold" shape and checks she still
    // finishes on schedule.
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
      step: 1,
      ticks: alreadyElapsed,
      minTicks: NURSE_HOLD_TICKS,
      targetId: home.id, // legitimately home id — must NOT be read as a tick marker
    };
    const pinnedPos = { ...mother.pos };

    const expectedRemaining = NURSE_HOLD_TICKS - alreadyElapsed;
    let holdTicks = 0;
    for (let i = 0; i < expectedRemaining; i++) {
      expect(mother.activity.id).toBe('feedYoung'); // must not have ended early
      tick(state, []);
      holdTicks++;
      expect(mother.pos.x).toBeCloseTo(pinnedPos.x, 9);
      expect(mother.pos.y).toBeCloseTo(pinnedPos.y, 9);
    }
    expect(holdTicks).toBe(expectedRemaining);
    expect(mother.activity.id).not.toBe('feedYoung'); // ended right on schedule
  });
});

describe('nurse leash tightens during the hold (M11)', () => {
  it('(f) a straggler beyond NURSE_GATHER_RADIUS (but within BABY_LEASH) is pulled inside FEED_RANGE and fed', () => {
    const { state, fam, holder } = reachNurseHold(8);
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    const baby = babies[0];
    if (!baby) throw new Error('need a baby');
    baby.needs.hunger = 0.9;
    baby.ageTicks = 0;
    // Beyond the tightened nurse-hold leash (NURSE_GATHER_RADIUS, 60), but
    // still inside the ordinary BABY_LEASH (140) — exactly the scenario the
    // M11 leash fix targets.
    baby.pos = { x: holder.pos.x + 100, y: holder.pos.y };

    tick(state, []);
    expect(baby.activity.id).toBe('gather'); // the tightened leash catches the straggler
    const target = baby.activity.targetPos;
    if (!target) throw new Error('no gather target');
    expect(
      Math.hypot(target.x - holder.pos.x, target.y - holder.pos.y),
    ).toBeLessThanOrEqual(NURSE_GATHER_RADIUS);

    // She holds still (established above); the baby closes the gap under
    // its own gather movement and gets relief before the hold ends.
    let fed = false;
    let closedIn = false;
    for (let i = 0; i < 200 && holder.activity.id === 'feedYoung'; i++) {
      const before = baby.needs.hunger;
      tick(state, []);
      const dist = Math.hypot(baby.pos.x - holder.pos.x, baby.pos.y - holder.pos.y);
      if (dist <= FEED_RANGE) closedIn = true;
      if (baby.needs.hunger < before - 1e-9) fed = true;
    }
    expect(closedIn).toBe(true);
    expect(fed).toBe(true);
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
// tests — the boundary itself is pinned in the nurse-hold test above, via
// FEED_RANGE ± 1). The final approach tick can snap the parent several
// units closer to home than the position used to pin a baby that same tick
// (a pin taken BEFORE tick() reads the pre-snap position; movement resolves
// during the tick), so a pin sitting right at the FEED_RANGE boundary can
// spuriously miss the very first delivery on arrival. These stay well clear
// of that margin while remaining unambiguously "in range" / "out of range".
const IN_RANGE = FEED_RANGE - 30;
const IN_RANGE_2 = FEED_RANGE - 35;
const OUT_OF_RANGE = FEED_RANGE + 40;

describe('carry delivery (step 3): sequenced, ranged, and reported', () => {
  /** Run a robin family to a delivery hold (feedYoung step 3), with two
   * hungry babies pinned at fixed distances from the feeder every tick so
   * neither their own movement nor the leash can contaminate the mechanic
   * under test (same pinning technique as the nurse-hold test above). */
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

  it('(d) a baby parked beyond FEED_RANGE of the deliverer is never fed by a delivery', () => {
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
