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
import { nearestRestable } from '../src/sim/valley';
import {
  createWorld,
  spawnCreature,
  type Creature,
  type Family,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../src/sim/state';

// Pinned numeric contract (M10 task 2 review): the nurse hold reaches out
// NURSE_RANGE units, lasts NURSE_HOLD_TICKS decay ticks, and relieves
// NURSE_HUNGER_RATE hunger per tick per baby in reach. These are literal
// copies of the tuning constants in src/sim/behaviors.ts and src/sim/
// family.ts, not imports of them — the point is to pin the actual contract
// so an accidental change to those constants fails a test here, not just
// silently reshapes the game.
const NURSE_RANGE = 90;
const NURSE_HOLD_TICKS = 80;
const NURSE_HUNGER_RATE = 0.006;

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
  it('holds stationary; feeds a baby just inside NURSE_RANGE, not one just outside it, for exactly NURSE_HOLD_TICKS, at NURSE_HUNGER_RATE', () => {
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
    // just inside NURSE_RANGE (90), 91 just outside. The babies are
    // otherwise free agents with their own hunger-driven forage/wander
    // behavior; re-pinning every tick, BEFORE each tick() call, means
    // moveToward never sees them arrive anywhere under their own power (the
    // position it computes from is overwritten again next tick), so neither
    // baby's own foraging can contaminate the hunger arithmetic under test.
    const pin = (b: Creature, dist: number): void => {
      b.pos = { x: holder.pos.x + dist, y: holder.pos.y };
    };
    pin(babyIn, NURSE_RANGE - 1);
    pin(babyOut, NURSE_RANGE + 1);
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
      pin(babyIn, NURSE_RANGE - 1);
      pin(babyOut, NURSE_RANGE + 1);
      tick(state, []);
      holdTicks++;
      expect(holder.pos.x).toBeCloseTo(pinnedMotherPos.x, 9); // stationary hold
      expect(holder.pos.y).toBeCloseTo(pinnedMotherPos.y, 9);
      expect(babyIn.needs.hunger).toBeLessThan(prevInHunger); // fed every hold tick
      prevInHunger = babyIn.needs.hunger;
    }

    // The hold lasts exactly NURSE_HOLD_TICKS decay ticks.
    expect(holdTicks).toBe(NURSE_HOLD_TICKS);

    // The baby just outside NURSE_RANGE was never fed — its hunger only
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

describe('carry (birds): robin', () => {
  it('keeps the fetch-then-carry flow shape: step 0 targets somewhere other than home, step 1 targets home exactly', () => {
    const state = pairWorld(8, 'robin', LAND_BASE);
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    expect(babies.length).toBeGreaterThan(0);
    for (const b of babies) b.needs.hunger = 0.9;
    const home = state.homes.find((h) => h.id === fam.homeId);
    if (!home) throw new Error('no home');

    let feeder: Creature | undefined;
    for (let i = 0; i < 1500; i++) {
      tick(state, []);
      feeder = state.creatures.find(
        (c) => c.familyId === fam.id && c.activity.id === 'feedYoung',
      );
      if (feeder) break;
    }
    if (!feeder) throw new Error('nobody started feedYoung');
    expect(feeder.activity.step).toBe(0);
    const fetchTarget = feeder.activity.targetPos;
    if (!fetchTarget) throw new Error('no fetch target');
    // Step 0's target is a fetch point, not home itself — pinned as a shape
    // assertion (not a seed-sensitive magic distance) since the fetch
    // distance is randomized 140-280 units and would only ever land exactly
    // on home.pos by a vanishing-probability coincidence.
    expect(fetchTarget.x === home.pos.x && fetchTarget.y === home.pos.y).toBe(false);

    for (let i = 0; i < 1500 && feeder.activity.step !== 1; i++) tick(state, []);
    expect(feeder.activity.step).toBe(1);
    const carryTarget = feeder.activity.targetPos;
    if (!carryTarget) throw new Error('no carry target');
    expect(carryTarget.x).toBeCloseTo(home.pos.x, 9);
    expect(carryTarget.y).toBeCloseTo(home.pos.y, 9);
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
