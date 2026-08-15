/**
 * Feeding the way each species really does (M10 task 2): mammals nurse
 * (mother goes home and holds a stationary nursing stance, babies gathered
 * by the leash feed while she holds), birds carry (the pre-existing
 * fetch-then-deliver flow, untouched), and fish/amphibian young are
 * self-sufficient (no parental feed trigger at all; passive grazing keeps
 * them fed instead).
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
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

describe('nurse (mammals): rabbit', () => {
  it('the mother nurses in a stationary hold; babies within reach gain hunger relief while she holds', () => {
    const state = pairWorld(8, 'rabbit', LAND_BASE);
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    expect(babies.length).toBeGreaterThan(0);
    for (const b of babies) b.needs.hunger = 0.9;
    const mother = motherOf(state, fam);

    // Run until the feeder enters the nursing hold (step 1).
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

    // Place a baby right where she's holding, so it's guaranteed in reach,
    // then watch the hold: her position must not move, and the baby's
    // hunger must fall monotonically while she holds.
    const baby = babies[0];
    if (!baby) throw new Error('no baby');
    baby.pos = { ...holder.pos };
    baby.needs.hunger = 0.9;
    baby.ageTicks = 0; // stay safely inside the baby stage for the whole hold
    const pinnedPos = { ...holder.pos };
    let prevHunger = baby.needs.hunger;
    let sawDecrease = false;
    // The baby is otherwise a free agent with its own hunger-driven
    // forage/wander behavior (it's plenty hungry, at 0.9) and can wander
    // out of nursing range on its own — the family baby-leash only pulls it
    // back once it's 140 units from home, wider than the 60-unit nurse
    // range this test targets. Re-gather it to her every tick (as if the
    // leash held it right at her side) so this test isolates the nurse-hold
    // decay mechanic itself rather than the baby's independent wandering.
    for (let i = 0; i < 70 && holder.activity.id === 'feedYoung' && holder.activity.step === 1; i++) {
      baby.pos = { ...holder.pos };
      tick(state, []);
      expect(holder.pos.x).toBeCloseTo(pinnedPos.x, 9);
      expect(holder.pos.y).toBeCloseTo(pinnedPos.y, 9);
      expect(baby.needs.hunger).toBeLessThanOrEqual(prevHunger + 1e-9);
      if (baby.needs.hunger < prevHunger - 1e-9) sawDecrease = true;
      prevHunger = baby.needs.hunger;
    }
    expect(sawDecrease).toBe(true);
  });
});

describe('carry (birds): robin', () => {
  it('flow is byte-identical to before: step 0 fetches away from home, step 1 carries home', () => {
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
    const distFromHome = Math.hypot(fetchTarget.x - home.pos.x, fetchTarget.y - home.pos.y);
    expect(distFromHome).toBeGreaterThan(50); // fetches away from home, not straight there

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
