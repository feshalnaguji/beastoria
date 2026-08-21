/**
 * Family life (spec §4.3): pairing, the family FSM, brooding turns, feeding
 * young, baby leashes, dispersal, and the gentle passing.
 *
 * Runs AFTER utility behavior selection each tick and overrides activities
 * for creatures with family duties. Family-directed activities are released
 * back to 'idle' when the duty ends.
 */
import { FEED_CONTACT_RANGE, feedContactRing, idHash, idOffsetAngle } from './behaviors';
import { TICKS_PER_DAY } from './clock';
import { emit } from './events';
import { nextRange } from './rng';
import { landingMediumOf, SPECIES } from './species';
import {
  isCarried,
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
/**
 * Total ticks for the nurse hold's full settle -> nurse -> linger sequence
 * (behaviors.ts: NURSE_SETTLE_TICKS 30 + NURSING_TICKS 90 + FEED_LINGER_TICKS
 * 40 = 160; M12, was a single 80-tick hold). Used only as the activity's
 * initial minTicks bookkeeping — the actual step transitions are driven by
 * behaviors.ts's own per-step durations, not this field.
 */
const NURSE_HOLD_TICKS = 160;
const BABY_LEASH = 140;
/**
 * The nurse-hold and carry-delivery steps during which a parent is actively
 * holding a feeding meeting — babies get pulled to the tight feeding-contact
 * ring instead of merely kept within BABY_LEASH of home (M12; was step 1
 * only for nurse / step 3 only for carry, before the settle/linger steps
 * existed).
 */
const NURSE_HOLDING_STEPS = new Set([1, 2, 3]);
const CARRY_HOLDING_STEPS = new Set([3, 4]);
const PASS_GATHER_TICKS = 200;
const PASS_GATHER_RANGE = 700;
const MEMORIAL_TICKS = 2 * TICKS_PER_DAY;

/* --------------------------- pouch-carry (M12) --------------------------- */

/**
 * How close a joey must be to its mother to climb into the pouch. Sits
 * between the two radii this file already lives by: FEED_CONTACT_RANGE (40 —
 * "touching, close enough to nurse") and BABY_LEASH (140 — "somewhere in the
 * yard"). 60 reads as "right at her side" — near enough that the mount looks
 * like a reach-and-climb rather than a teleport across the meadow, but loose
 * enough that a joey doesn't have to thread a needle to get aboard. It is
 * also the radius M11 used for its nurse-gather ring, i.e. the distance this
 * codebase already calls "gathered in".
 */
const MOUNT_RANGE = 60;
/**
 * The graze window: every POUCH_GRAZE_PERIOD ticks a joey hops out for
 * POUCH_GRAZE_TICKS ticks to feed itself, then climbs back in. 600/120 is
 * one minute of real time at 1x with a twelve-second break in it — an
 * occasional pause from riding, not a way of life: a kangaroo baby stage
 * lasts ~3360 ticks (33600 mean lifespan × 0.1), so a joey grazes about five
 * or six times in its whole infancy and spends 80% of it aboard.
 *
 * Phased by `idHash(joey.id)` so two joeys in the valley never hop out on
 * the same tick — the same draw-free trick the feed-mote stagger and the
 * socialize ring already use. Nothing here consults the RNG.
 */
const POUCH_GRAZE_PERIOD = 600;
const POUCH_GRAZE_TICKS = 120;
/**
 * How far a grazing joey may potter from its mother before it is called
 * back. Same distance as BABY_LEASH — "in the yard" — but anchored on HER
 * rather than on the nest, because while she is carrying it around the
 * valley the nest is nowhere near either of them.
 */
const GRAZE_LEASH = BABY_LEASH;

/**
 * Is this joey in its graze window right now? Pure arithmetic on the tick
 * count and the joey's own id — deterministic, replay-safe, and (the point)
 * completely free of RNG draws.
 */
function inGrazeWindow(tick: number, joeyId: number): boolean {
  return (tick + idHash(joeyId)) % POUCH_GRAZE_PERIOD < POUCH_GRAZE_TICKS;
}

export function familySystem(state: WorldState): void {
  handlePassings(state);
  formPairs(state);
  for (const fam of state.families) stepFamily(state, fam);
  cleanupFamilies(state);
  releaseStrandedRiders(state);
  state.memorials = state.memorials.filter((m) => state.tick - m.tick < MEMORIAL_TICKS);
}

/**
 * The pouch's backstop: any carry link that no longer makes sense is cut.
 * stepFamily's rearing case only ever sees families that still exist and are
 * still rearing, so a link can outlive its own preconditions — a family
 * dissolving with both members alive (cleanupFamilies), a carrier removed
 * mid-ride, a rider aged out on a tick its family didn't step. Without this,
 * such a joey would be glued to a creature forever with its own behavior
 * selection switched off: a permanent freeze, exactly the failure class
 * tests/stuck.test.ts exists for. Draw-free.
 */
function releaseStrandedRiders(state: WorldState): void {
  for (const rider of state.creatures) {
    if (!isCarried(rider)) continue;
    const carrier = state.creatures.find((o) => o.id === rider.carriedBy);
    const valid =
      carrier !== undefined &&
      carrier.id !== rider.id &&
      rider.familyId !== null &&
      rider.familyId === carrier.familyId &&
      rider.stage === 'baby' &&
      SPECIES[rider.species].reproduction.pouchCarry === true;
    if (!valid) dismount(rider);
  }
}

/** Put a rider back on its own feet, free to choose again next tick. */
function dismount(joey: Creature): void {
  joey.carriedBy = null;
  if (joey.activity.id === 'pass') return; // nothing interrupts a passing
  // Released to 'idle' with no minimum, not left in whatever it was doing
  // when it climbed in: 'idle' is a free-agent activity, so selectBehavior
  // takes it back over on the very next tick and it wanders off to graze.
  // Assignment, not startActivity() — no RNG draw.
  joey.activity = { id: 'idle', ticks: 0, minTicks: 0 };
}

/**
 * One joey's ride, evaluated once per tick during its family's 'rearing'
 * phase. Mounts, dismounts, and (on foot) leashes the joey to its MOTHER
 * rather than to the nest — the nest is irrelevant while she is carrying it
 * across the valley. Every branch is pure arithmetic on positions, ticks and
 * ids: no RNG draws anywhere on this path.
 */
function stepPouch(
  state: WorldState,
  joey: Creature,
  mother: Creature,
  motherIsFeeding: boolean,
): void {
  if (joey.activity.id === 'pass') {
    joey.carriedBy = null;
    return;
  }
  // Grown out of the pouch, or the mother is passing: back on its own feet.
  if (joey.stage !== 'baby' || mother.activity.id === 'pass') {
    if (isCarried(joey)) dismount(joey);
    return;
  }

  const grazing = inGrazeWindow(state.tick, joey.id);

  if (isCarried(joey)) {
    if (joey.carriedBy === mother.id && !grazing) return; // riding on
    dismount(joey); // the graze window opened (or somebody else had it)
  }

  const d = Math.hypot(joey.pos.x - mother.pos.x, joey.pos.y - mother.pos.y);
  if (!grazing && d <= MOUNT_RANGE) {
    joey.carriedBy = mother.id;
    // Same draw-free reset as dismount: while carried, selectBehavior returns
    // immediately, so 'idle' is simply what the joey is doing up there.
    joey.activity = { id: 'idle', ticks: 0, minTicks: 0 };
    return;
  }

  // On foot. Anchored on the mother, with three radii:
  //  - she is holding a feeding meeting: the tight contact ring, exactly as
  //    the ordinary baby leash does, so the joey is fed rather than watching;
  //  - grazing: GRAZE_LEASH, room to potter and forage around her feet;
  //  - otherwise: MOUNT_RANGE — it wants back in, so it beelines to her.
  const landing = landingMediumOf(joey.species);
  const radius = motherIsFeeding ? FEED_CONTACT_RANGE : grazing ? GRAZE_LEASH : MOUNT_RANGE;
  if (d > radius) {
    const target = motherIsFeeding
      ? feedContactRing(mother.pos, joey.id, landing)
      : nearestRestable(landing, { x: mother.pos.x, y: mother.pos.y });
    // Re-targeted EVERY tick (unlike the nest leash, which only fires on
    // crossing the radius): the anchor is a creature that moves, and a joey
    // chasing where its mother stood a minute ago would never arrive.
    joey.activity = {
      id: 'gather',
      ticks: joey.activity.id === 'gather' ? joey.activity.ticks : 0,
      minTicks: 0,
      targetPos: target,
    };
  } else if (joey.activity.id === 'gather') {
    // Arrived. Explicitly released, because nothing else ever lets a baby out
    // of 'gather' — selectBehavior skips family activities, and the 'gather'
    // case in applyActivity has no exit of its own.
    joey.activity = { id: 'idle', ticks: 0, minTicks: 0 };
  }
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
  // Nobody rides a creature that no longer exists (M12). Done before the
  // familyId early-return below, because a carry link can outlive the family
  // that created it — and done here as well as in releaseStrandedRiders so
  // the dangling id never survives even a single tick, let alone into a save.
  c.carriedBy = null;
  for (const rider of state.creatures) {
    if (rider.carriedBy === c.id) dismount(rider);
  }
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
      const rep = SPECIES[fam.species].reproduction;
      const feedMode = rep.feedMode;
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

      // Babies stay near the home — EXCEPT while a parent is actively
      // holding a feeding meeting (a nursing mother in feedYoung steps
      // 1-3 — settle, nurse, linger — or a carry parent in its steps 3-4 —
      // deliver, linger), when the leash's anchor becomes that parent's
      // position instead: same leash mechanism (distance check + gather
      // target), just a different point, so babies visibly gather in to be
      // fed rather than merely tolerating the parent being elsewhere in
      // the yard.
      const deliveringParent = parents.find(
        (p) =>
          p.activity.id === 'feedYoung' &&
          p.activity.step !== undefined &&
          ((feedMode === 'nurse' && NURSE_HOLDING_STEPS.has(p.activity.step)) ||
            (feedMode === 'carry' && CARRY_HOLDING_STEPS.has(p.activity.step))),
      );
      const leashAnchor = deliveringParent?.pos ?? home?.pos;
      // While a parent holds, the leash tightens to the tighter feeding
      // contact radius, so babies land within actual feeding range and
      // visibly gather in rather than stopping just outside it (M11,
      // tightened again in M12). The re-gather target is now a
      // deterministic point on feedContactRing's ring around the parent
      // (M12) — zero RNG draws — replacing the old two-draw ±25/±18
      // scatter; the out-of-hold fallback to home below is untouched.
      const leashRadius = deliveringParent ? FEED_CONTACT_RANGE : BABY_LEASH;

      // The pouch (M12): for a marsupial, the mother replaces the nest as the
      // baby's whole world — she carries it, and when it is on its own feet
      // it is leashed to her, not to the scrape. So a joey is governed
      // entirely by stepPouch and skips the nest leash below. Everything
      // here is draw-free.
      //
      // Deliberately NO `?? parents[0]` fallback, unlike the nurse-feeder and
      // brood-sitter selections elsewhere in this file: a pouch is not a duty
      // that can be handed over. `rearing` only ends when there are no
      // children left or every child has grown up, so a family whose mother
      // has passed stays in `rearing` with the father still on the parent
      // list — and that fallback would have put the joey in HIS pouch.
      // Undefined here instead means a motherless joey falls through to the
      // ordinary nest leash below, which is the right home for it.
      const carrier =
        rep.pouchCarry === true ? parents.find((p) => p.sex === 'f') : undefined;
      if (carrier) {
        for (const child of children) {
          stepPouch(state, child, carrier, deliveringParent !== undefined);
        }
      }

      if (leashAnchor) {
        for (const child of children) {
          if (child.stage !== 'baby') continue;
          if (carrier) continue; // stepPouch above owns this one
          const d = Math.hypot(child.pos.x - leashAnchor.x, child.pos.y - leashAnchor.y);
          if (d > leashRadius && child.activity.id !== 'gather') {
            child.activity = {
              id: 'gather',
              ticks: 0,
              minTicks: 30,
              targetPos: deliveringParent
                ? feedContactRing(leashAnchor, child.id, landingMediumOf(child.species))
                : {
                    x: leashAnchor.x + nextRange(state.rng, -40, 40),
                    y: leashAnchor.y + nextRange(state.rng, -30, 30),
                  },
            };
          }
        }
      }

      // Feeding: when a baby is hungry, the duty parent fetches food — except
      // 'self' species (koi fry etc.), which are never fed by a parent at
      // all; they graze passively instead (decayNeeds, behaviors.ts).
      if (feedMode !== 'self') {
        const hungryBaby = children.some(
          (c) => c.stage === 'baby' && c.needs.hunger > FEED_TRIGGER_HUNGER,
        );
        const feeding = parents.some((p) => p.activity.id === 'feedYoung');
        if (home && hungryBaby && !feeding) {
          let feeder: Creature | undefined;
          switch (feedMode) {
            case 'nurse':
              // The mother always nurses — no duty rotation to hand off.
              feeder = parents.find((p) => p.sex === 'f') ?? parents[0];
              break;
            case 'carry':
              fam.dutyParent = (fam.dutyParent + 1) % Math.max(1, parents.length);
              feeder = parents[fam.dutyParent % parents.length];
              break;
            default:
              assertNever(feedMode);
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

/**
 * Exhaustiveness guard for feedMode dispatch (mirrors behaviors.ts's): a
 * compile error here means a new feedMode value needs a case above; a
 * runtime throw means some invariant broke.
 */
function assertNever(x: never): never {
  throw new Error(`unreachable feedMode: ${JSON.stringify(x)}`);
}

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
