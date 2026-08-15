/**
 * Family life (spec §4.3): pairing, the family FSM, brooding turns, feeding
 * young, baby leashes, dispersal, and the gentle passing.
 *
 * Runs AFTER utility behavior selection each tick and overrides activities
 * for creatures with family duties. Family-directed activities are released
 * back to 'idle' when the duty ends.
 */
import { idOffsetAngle } from './behaviors';
import { TICKS_PER_DAY } from './clock';
import { emit } from './events';
import { nextRange } from './rng';
import { landingMediumOf, SPECIES } from './species';
import {
  type Creature,
  type Family,
  type Home,
  type WorldState,
} from './state';
import { spawnCreature } from './state';
import { canOccupy, GROVE_NEST, nearestRestable } from './valley';

const PAIR_RANGE = 200;
const COURT_TICKS = 300;
const NEST_TICKS = 400;
const BROOD_SWAP_TICKS = 220;
const FEED_TRIGGER_HUNGER = 0.5;
/** How long a nursing mother holds still once she reaches home (behaviors.ts). */
const NURSE_HOLD_TICKS = 80;
const BABY_LEASH = 140;
const PASS_GATHER_TICKS = 200;
const PASS_GATHER_RANGE = 700;
const MEMORIAL_TICKS = 2 * TICKS_PER_DAY;

export function familySystem(state: WorldState): void {
  handlePassings(state);
  formPairs(state);
  for (const fam of state.families) stepFamily(state, fam);
  cleanupFamilies(state);
  state.memorials = state.memorials.filter((m) => state.tick - m.tick < MEMORIAL_TICKS);
}

/* ------------------------------ passing ------------------------------ */

function handlePassings(state: WorldState): void {
  for (const c of state.creatures) {
    if (c.activity.id === 'pass') continue;
    if (c.ageTicks > c.lifespanTicks) {
      // The elder settles where it stands — or, if it was on the wing over
      // the water, glides down to the nearest shore (draw-free).
      c.pos = nearestRestable(landingMediumOf(c.species), c.pos);
      c.activity = { id: 'pass', ticks: 0, minTicks: PASS_GATHER_TICKS };
      // Nearby family members come to sit with them.
      if (c.familyId !== null) {
        for (const kin of state.creatures) {
          if (kin.id === c.id || kin.familyId !== c.familyId) continue;
          if (kin.activity.id === 'pass') continue;
          const d = Math.hypot(kin.pos.x - c.pos.x, kin.pos.y - c.pos.y);
          if (d < PASS_GATHER_RANGE) {
            kin.activity = {
              id: 'gather',
              ticks: 0,
              minTicks: PASS_GATHER_TICKS,
              targetPos: nearestRestable(landingMediumOf(kin.species), {
                x: c.pos.x + nextRange(state.rng, -55, 55),
                y: c.pos.y + nextRange(state.rng, -40, 40),
              }),
            };
          }
        }
      }
    }
  }

  // Complete passings whose gathering time has elapsed.
  const passed = state.creatures.filter(
    (c) => c.activity.id === 'pass' && c.activity.ticks >= PASS_GATHER_TICKS,
  );
  for (const c of passed) {
    state.memorials.push({ pos: { x: c.pos.x, y: c.pos.y }, species: c.species, tick: state.tick });
    emit(state, { kind: 'passed', tick: state.tick, species: c.species, pos: { ...c.pos } });
    if (SPECIES[c.species].rebirth) rebirth(state, c);
    removeCreature(state, c);
  }
}

/** The phoenix's passing leaves a new chick in soft embers at the grove. */
function rebirth(state: WorldState, elder: Creature): void {
  const fam =
    elder.familyId === null ? undefined : state.families.find((f) => f.id === elder.familyId);
  const pos = {
    x: GROVE_NEST.x + nextRange(state.rng, -30, 30),
    y: GROVE_NEST.y + nextRange(state.rng, -20, 20),
  };
  const chick = spawnCreature(state, elder.species, pos, 0);
  if (fam) {
    chick.familyId = fam.id;
    fam.childIds.push(chick.id);
    if (fam.phase !== 'rearing' && fam.phase !== 'expecting') enterPhase(fam, 'rearing');
  }
  emit(state, {
    kind: 'reborn',
    tick: state.tick,
    species: elder.species,
    pos: { ...pos },
    ...(fam ? { familyId: fam.id } : {}),
  });
}

function removeCreature(state: WorldState, c: Creature): void {
  state.creatures.splice(state.creatures.indexOf(c), 1);
  if (c.familyId === null) return;
  const fam = state.families.find((f) => f.id === c.familyId);
  if (!fam) return;
  fam.parentIds = fam.parentIds.filter((id) => id !== c.id);
  fam.childIds = fam.childIds.filter((id) => id !== c.id);
  // Release gathered mourners back to their day — a flier that sat vigil out
  // over the water drifts on instead of parking on it.
  for (const kin of state.creatures) {
    if (kin.familyId === c.familyId && kin.activity.id === 'gather') {
      const canRest = canOccupy(landingMediumOf(kin.species), kin.pos);
      kin.activity = { id: canRest ? 'idle' : 'wander', ticks: 0, minTicks: 40 };
    }
  }
}

/* ------------------------------ pairing ------------------------------ */

function formPairs(state: WorldState): void {
  for (const a of state.creatures) {
    if (!eligibleSingle(a)) continue;
    if (!populationAllowsPairing(state, a.species)) continue;
    if (SPECIES[a.species].singleFamily && state.families.some((f) => f.species === a.species)) {
      continue;
    }
    for (const b of state.creatures) {
      if (b.id <= a.id || !eligibleSingle(b)) continue;
      if (b.species !== a.species || b.sex === a.sex) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      if (d > PAIR_RANGE) continue;

      const fam: Family = {
        id: state.nextId++,
        species: a.species,
        parentIds: [a.id, b.id],
        childIds: [],
        homeId: null,
        phase: 'courting',
        phaseTicks: 0,
        dutyParent: 0,
      };
      state.families.push(fam);
      a.familyId = fam.id;
      b.familyId = fam.id;
      emit(state, { kind: 'paired', tick: state.tick, species: a.species, familyId: fam.id });
      break;
    }
  }
}

function eligibleSingle(c: Creature): boolean {
  return c.familyId === null && c.stage === 'adult';
}

function populationAllowsPairing(state: WorldState, species: Creature['species']): boolean {
  const count = state.creatures.filter((c) => c.species === species).length;
  return count < SPECIES[species].population.softCap;
}

/* ------------------------------ the FSM ------------------------------ */

function stepFamily(state: WorldState, fam: Family): void {
  fam.phaseTicks++;
  const parents = fam.parentIds
    .map((id) => state.creatures.find((c) => c.id === id))
    .filter((c): c is Creature => c !== undefined);
  if (parents.length === 0) return; // cleanup will handle it

  switch (fam.phase) {
    case 'courting': {
      // Parents keep close company (a gentle mutual display).
      const [a, b] = parents;
      if (a && b) {
        setIfFree(a, { id: 'court', ticks: a.activity.id === 'court' ? a.activity.ticks : 0, minTicks: 60, targetId: b.id });
        setIfFree(b, { id: 'court', ticks: b.activity.id === 'court' ? b.activity.ticks : 0, minTicks: 60, targetId: a.id });
      }
      if (fam.phaseTicks >= COURT_TICKS) enterPhase(fam, 'nesting');
      break;
    }

    case 'nesting': {
      if (fam.homeId === null) {
        const home = claimHome(state, fam);
        if (!home) break; // wait for a home to free up
        emit(state, { kind: 'nested', tick: state.tick, species: fam.species, familyId: fam.id });
      }
      const home = homeOf(state, fam);
      if (!home) break;
      // Both parents work on the home, spread onto opposite sides of the
      // nest so they don't stack on one point (id-hash base angle, plus a
      // half-turn per parent slot so the pair never lands close together).
      parents.forEach((p, i) => {
        const ringAngle = idOffsetAngle(p.id) + i * Math.PI;
        setIfFree(p, {
          id: 'gather',
          ticks: 0,
          minTicks: 30,
          targetPos: {
            x: home.pos.x + Math.cos(ringAngle) * 26,
            y: home.pos.y + Math.sin(ringAngle) * 26,
          },
        });
      });
      if (fam.phaseTicks >= NEST_TICKS) {
        const rep = SPECIES[fam.species].reproduction;
        const count = rollClutchSize(state, fam.species);
        if (count === 0) {
          // A full valley: this pair simply doesn't raise a clutch this
          // season. They keep the nest and wait out the cooldown.
          enterPhase(fam, 'emptyNest');
          break;
        }
        fam.clutch = { count, broodTicksLeft: rep.broodTicks };
        if (rep.mode === 'egg') {
          const home2 = homeOf(state, fam);
          emit(state, {
            kind: 'eggLaid',
            tick: state.tick,
            species: fam.species,
            familyId: fam.id,
            count,
            ...(home2 ? { pos: { ...home2.pos } } : {}),
          });
        }
        enterPhase(fam, 'expecting');
      }
      break;
    }

    case 'expecting': {
      const home = homeOf(state, fam);
      if (!home || !fam.clutch) break;
      fam.clutch.broodTicksLeft--;

      // Brooding turns: duty parent sits the clutch, the other lives freely.
      if (fam.phaseTicks % BROOD_SWAP_TICKS === 0) {
        fam.dutyParent = (fam.dutyParent + 1) % Math.max(1, parents.length);
      }
      // Live-birth mothers keep the duty themselves.
      const rep = SPECIES[fam.species].reproduction;
      const sitter =
        rep.mode === 'live'
          ? (parents.find((p) => p.sex === 'f') ?? parents[0])
          : parents[fam.dutyParent % parents.length];
      if (sitter) {
        overrideActivity(sitter, {
          id: 'brood',
          ticks: sitter.activity.id === 'brood' ? sitter.activity.ticks : 0,
          minTicks: 60,
          targetPos: { ...home.pos },
        });
      }

      if (fam.clutch.broodTicksLeft <= 0) {
        // Babies arrive — but never more than the valley still has room for
        // (the population can have grown during incubation).
        const born = Math.min(fam.clutch.count, headroom(state, fam.species));
        for (let i = 0; i < born; i++) {
          const baby = spawnCreature(state, fam.species, {
            x: home.pos.x + nextRange(state.rng, -25, 25),
            y: home.pos.y + nextRange(state.rng, -18, 18),
          });
          baby.familyId = fam.id;
          fam.childIds.push(baby.id);
        }
        fam.clutch = undefined;
        if (born === 0) {
          enterPhase(fam, 'emptyNest');
          break;
        }
        emit(state, {
          kind: rep.mode === 'egg' ? 'hatched' : 'born',
          tick: state.tick,
          species: fam.species,
          familyId: fam.id,
          count: born,
          pos: { ...home.pos },
        });
        enterPhase(fam, 'rearing');
      }
      break;
    }

    case 'rearing': {
      const home = homeOf(state, fam);
      const children = fam.childIds
        .map((id) => state.creatures.find((c) => c.id === id))
        .filter((c): c is Creature => c !== undefined);

      // Nothing left to rear (every child gone) — back to the quiet nest.
      if (children.length === 0) {
        fam.childIds = [];
        enterPhase(fam, 'emptyNest');
        break;
      }

      // Babies stay near the home.
      if (home) {
        for (const child of children) {
          if (child.stage !== 'baby') continue;
          const d = Math.hypot(child.pos.x - home.pos.x, child.pos.y - home.pos.y);
          if (d > BABY_LEASH && child.activity.id !== 'gather') {
            child.activity = {
              id: 'gather',
              ticks: 0,
              minTicks: 30,
              targetPos: {
                x: home.pos.x + nextRange(state.rng, -40, 40),
                y: home.pos.y + nextRange(state.rng, -30, 30),
              },
            };
          }
        }
      }

      // Feeding: when a baby is hungry, the duty parent fetches food — except
      // 'self' species (koi fry etc.), which are never fed by a parent at
      // all; they graze passively instead (decayNeeds, behaviors.ts).
      const feedMode = SPECIES[fam.species].reproduction.feedMode;
      if (feedMode !== 'self') {
        const hungryBaby = children.some(
          (c) => c.stage === 'baby' && c.needs.hunger > FEED_TRIGGER_HUNGER,
        );
        const feeding = parents.some((p) => p.activity.id === 'feedYoung');
        if (home && hungryBaby && !feeding) {
          let feeder: Creature | undefined;
          if (feedMode === 'nurse') {
            // The mother always nurses — no duty rotation to hand off.
            feeder = parents.find((p) => p.sex === 'f') ?? parents[0];
          } else {
            fam.dutyParent = (fam.dutyParent + 1) % Math.max(1, parents.length);
            feeder = parents[fam.dutyParent % parents.length];
          }
          if (feeder) {
            overrideActivity(feeder, {
              id: 'feedYoung',
              ticks: 0,
              minTicks: feedMode === 'nurse' ? NURSE_HOLD_TICKS : 30,
              step: 0,
              targetId: home.id,
            });
          }
        }
      }

      // All children grown? They set out on their own.
      if (children.length > 0 && children.every((c) => c.stage !== 'baby' && c.stage !== 'juvenile')) {
        for (const child of children) child.familyId = null;
        fam.childIds = [];
        enterPhase(fam, 'emptyNest');
      }
      break;
    }

    case 'emptyNest': {
      const rep = SPECIES[fam.species].reproduction;
      if (fam.phaseTicks >= rep.cooldownTicks && populationAllowsPairing(state, fam.species)) {
        enterPhase(fam, 'nesting');
      }
      break;
    }
  }
}

function enterPhase(fam: Family, phase: Family['phase']): void {
  fam.phase = phase;
  fam.phaseTicks = 0;
}

function homeOf(state: WorldState, fam: Family): Home | undefined {
  return fam.homeId === null ? undefined : state.homes.find((h) => h.id === fam.homeId);
}

function claimHome(state: WorldState, fam: Family): Home | undefined {
  const kind = SPECIES[fam.species].homeKind;
  const parent = state.creatures.find((c) => c.id === fam.parentIds[0]);
  const anchor = parent?.pos ?? { x: WORLD_WIDTH_HALF, y: WORLD_HEIGHT_HALF };
  let best: Home | undefined;
  let bestDist = Infinity;
  for (const h of state.homes) {
    if (h.kind !== kind || h.familyId !== null) continue;
    const d = Math.hypot(h.pos.x - anchor.x, h.pos.y - anchor.y);
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  if (best) {
    best.familyId = fam.id;
    fam.homeId = best.id;
  }
  return best;
}

const WORLD_WIDTH_HALF = 2048;
const WORLD_HEIGHT_HALF = 1536;

/**
 * Clutch size scales down as population nears the soft cap (spec §4.3), and
 * is then capped by the room actually left under the hard cap — so the cap is
 * an honest guarantee, not a probabilistic tendency. `headroom` clamps again
 * at hatching time, since the population can still grow during incubation.
 */
function rollClutchSize(state: WorldState, species: Creature['species']): number {
  const p = SPECIES[species];
  const count = countOf(state, species);
  const fullness = Math.min(1, count / p.population.softCap);
  const max = Math.round(
    p.reproduction.clutchMax - (p.reproduction.clutchMax - p.reproduction.clutchMin) * fullness,
  );
  const rolled = Math.max(
    p.reproduction.clutchMin,
    Math.min(max, Math.floor(nextRange(state.rng, p.reproduction.clutchMin, max + 1))),
  );
  return Math.min(rolled, headroom(state, species));
}

function countOf(state: WorldState, species: Creature['species']): number {
  return state.creatures.filter((c) => c.species === species).length;
}

/** How many more of this species the valley can hold. */
function headroom(state: WorldState, species: Creature['species']): number {
  return Math.max(0, SPECIES[species].population.hardCap - countOf(state, species));
}

/* ------------------------------ helpers ------------------------------ */

/** Override unless the creature is passing (nothing interrupts that). */
function overrideActivity(c: Creature, activity: Creature['activity']): void {
  if (c.activity.id === 'pass') return;
  if (c.activity.id === activity.id) return; // keep progress
  c.activity = activity;
}

/** Softer override: don't interrupt urgent self-care (critical hunger). */
function setIfFree(c: Creature, activity: Creature['activity']): void {
  if (c.activity.id === 'pass' || c.activity.id === 'gather') return;
  if (c.needs.hunger > 0.85 && c.activity.id === 'forage') return;
  if (c.activity.id === activity.id) return;
  c.activity = activity;
}

/**
 * Remove families with no parents left — whether or not children remain.
 * A parentless family can never do anything again (stepFamily short-circuits
 * on `parents.length === 0`), so any lingering children (e.g. a phoenix
 * rebirth chick attached just before the last parent's passing completed)
 * are released as free agents rather than left as permanent orphans. Also
 * covers ordinary families with no members at all; frees the claimed home.
 */
function cleanupFamilies(state: WorldState): void {
  for (const fam of [...state.families]) {
    if (fam.parentIds.length === 0) {
      for (const c of state.creatures) {
        if (c.familyId === fam.id) c.familyId = null;
      }
      const home = homeOf(state, fam);
      if (home) home.familyId = null;
      state.families.splice(state.families.indexOf(fam), 1);
    }
  }
}
