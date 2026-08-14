# M5 — All Eight Species Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the valley from 2 species to the full roster of 8 — deer, duck, koi, owl, dodo, phoenix join rabbit and robin — with swimming, nocturnal owls, deer herd cohesion, dodo wanderer arrivals, phoenix rebirth, and a population-balance property test suite.

**Architecture:** New species are data (species defs + rig files), plus three genuinely new sim mechanics: movement media (land/water/amphibious), a population regulator (wanderer arrivals), and phoenix special-casing (single family + rebirth). All sim work is pure/deterministic (`state.rng` only, array-order iteration); all art is vector rig data following the existing `rabbitRig.ts`/`robinRig.ts` pattern.

**Tech Stack:** TypeScript strict, Vitest (sim tests only), PixiJS v8 (render layer, eyeballed), existing sfc32 RNG.

## Global Constraints

- `src/sim/` NEVER imports Pixi/DOM, never uses `Math.random`/`Date.now`/`performance.now` (lint-enforced). All randomness via `state.rng` + `src/sim/rng.ts` helpers.
- Creatures iterated in array order; `WorldState` stays a serializable POJO (save = JSON passthrough).
- NO on-screen predation ever; passings are gentle (spec "gentle realism").
- Art is 100% code-crafted vector rig data — no images, no asset packs.
- Unit tests cover sim (+ pure rig data integrity) only; rendering is eyeballed via DevPanel (`~` key, speed 64x).
- Every task ends with `npx vitest run` green; milestone ends with `npm test` + `npm run lint` + `npm run build` clean.
- Keep rabbit/robin entries FIRST in `STARTING_CAST` (tests/behaviors.test.ts slices the first N creatures and assumes rabbits).
- Commit after every task with a `feat:`/`test:` message ending in the Claude Code trailer.

## Key existing interfaces (already in repo — do not redefine)

- `SPECIES: Record<SpeciesId, SpeciesParams>` in `src/sim/species.ts`
- `spawnCreature(state, species, pos, ageFrac?)` in `src/sim/state.ts` — pushes + returns a Creature (sex rolled randomly; overwrite after if needed)
- `emit(state, event)` in `src/sim/events.ts`
- `moveToward(c, target, speed)` / `wanderStep(rng, c, speed)` in `src/sim/movement.ts` (signatures change in Task 2)
- `turnToward(current, target, maxDelta)` in `src/sim/movement.ts` (exported)
- `isWater(p)`, `POND`, `FOREST`, `GROVE`, `inEllipse` in `src/sim/valley.ts`
- `CreatureRig` in `src/rigs/format.ts` — parts must be ordered so parents appear before children (RigRenderer resolves `containers.get(part.parent)` while iterating)
- Family FSM in `src/sim/family.ts`: `formPairs`, `handlePassings`, `stepFamily`, `enterPhase(fam, phase)`, `populationAllowsPairing`

---

### Task 1: Species registry — 8 species defs, home kinds, valley sites, render fallback

**Files:**
- Modify: `src/sim/state.ts` (SpeciesId + HomeKind unions)
- Modify: `src/sim/species.ts` (SpeciesParams fields + 6 new entries)
- Modify: `src/sim/valley.ts` (new site constants, `Medium`, `canOccupy`)
- Modify: `src/render/Renderer.ts` (RIGS becomes Partial + `rigFor()` fallback so tsc stays green until rigs land)
- Test: `tests/species.test.ts` (new)

**Interfaces:**
- Consumes: existing `SpeciesParams`, `EllipseZone`, `inEllipse`, `isWater`.
- Produces: `SpeciesId = 'rabbit'|'robin'|'deer'|'duck'|'koi'|'owl'|'dodo'|'phoenix'`; `HomeKind = 'burrow'|'treeNest'|'reedNest'|'lilyPatch'|'treeHollow'|'glade'|'groundNest'|'groveNest'`; `type Medium = 'land'|'water'|'amphibious'` and `canOccupy(medium, p): boolean` in valley.ts; new SpeciesParams fields `medium: Medium`, `wandersIn: boolean`, `herd?: boolean`, `singleFamily?: boolean`, `rebirth?: boolean`; site constants `REED_NESTS`, `LILY_PATCHES`, `HOLLOW_TREES`, `GLADES`, `GROUND_NESTS`, `GROVE_NEST` in valley.ts.

- [ ] **Step 1: Write the failing test** — `tests/species.test.ts`:

```ts
/**
 * The full 8-species registry: every species defined, params sane,
 * home kinds and movement media consistent with the valley.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/sim/species';
import { canOccupy, GROVE_NEST, isWater, LILY_PATCHES, POND, REED_NESTS } from '../src/sim/valley';
import type { SpeciesId } from '../src/sim/state';

const ALL: SpeciesId[] = ['rabbit', 'robin', 'deer', 'duck', 'koi', 'owl', 'dodo', 'phoenix'];

describe('species registry', () => {
  it('defines all eight species', () => {
    expect(Object.keys(SPECIES).sort()).toEqual([...ALL].sort());
  });

  it('has sane params for every species', () => {
    for (const id of ALL) {
      const p = SPECIES[id];
      expect(p.speed).toBeGreaterThan(0);
      const f = p.stageFractions;
      expect(f.baby + f.juvenile + f.adult).toBeLessThan(1);
      expect(p.population.floor).toBeLessThanOrEqual(p.population.softCap);
      expect(p.population.softCap).toBeLessThanOrEqual(p.population.hardCap);
      expect(p.reproduction.clutchMin).toBeLessThanOrEqual(p.reproduction.clutchMax);
    }
  });

  it('special flags: koi swims, duck is amphibious, owl is nocturnal, phoenix is singular', () => {
    expect(SPECIES.koi.medium).toBe('water');
    expect(SPECIES.duck.medium).toBe('amphibious');
    expect(SPECIES.owl.diurnal).toBe(false);
    expect(SPECIES.deer.herd).toBe(true);
    expect(SPECIES.phoenix.singleFamily).toBe(true);
    expect(SPECIES.phoenix.rebirth).toBe(true);
    expect(SPECIES.phoenix.wandersIn).toBe(false);
    expect(SPECIES.dodo.wandersIn).toBe(true);
  });

  it('home sites sit in the right medium', () => {
    for (const p of LILY_PATCHES) expect(isWater(p)).toBe(true); // koi homes in the pond
    for (const p of REED_NESTS) expect(isWater(p)).toBe(false); // duck nests on the shore
    expect(isWater(GROVE_NEST)).toBe(false);
  });

  it('canOccupy: land avoids water, water requires it, amphibious goes anywhere', () => {
    const wet = { x: POND.x, y: POND.y };
    const dry = { x: 2000, y: 1500 };
    expect(canOccupy('land', wet)).toBe(false);
    expect(canOccupy('land', dry)).toBe(true);
    expect(canOccupy('water', wet)).toBe(true);
    expect(canOccupy('water', dry)).toBe(false);
    expect(canOccupy('amphibious', wet)).toBe(true);
    expect(canOccupy('amphibious', dry)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails** — `npx vitest run tests/species.test.ts` — expect FAIL (missing exports / species).

- [ ] **Step 3: Implement.**

`src/sim/state.ts` — replace the two unions:

```ts
export type SpeciesId =
  | 'rabbit' | 'robin' | 'deer' | 'duck' | 'koi' | 'owl' | 'dodo' | 'phoenix';
// ...
export type HomeKind =
  | 'burrow' | 'treeNest' | 'reedNest' | 'lilyPatch'
  | 'treeHollow' | 'glade' | 'groundNest' | 'groveNest';
```

`src/sim/valley.ts` — append:

```ts
/** Duck nests tucked into the reeds on the pond's dry shore. */
export const REED_NESTS: Vec2[] = [
  { x: 2600, y: 2050 },
  { x: 3350, y: 1870 },
  { x: 2700, y: 2680 },
];

/** Koi spawning beds among the lily pads (inside the pond). */
export const LILY_PATCHES: Vec2[] = [
  { x: 2950, y: 2250 },
  { x: 3300, y: 2400 },
];

/** Old forest trees with owl hollows. */
export const HOLLOW_TREES: Vec2[] = [
  { x: 700, y: 600 },
  { x: 1150, y: 950 },
];

/** Sheltered meadow clearings where deer bed down. */
export const GLADES: Vec2[] = [
  { x: 2200, y: 1500 },
  { x: 1800, y: 1900 },
];

/** Dodo ground nests at the forest edge. */
export const GROUND_NESTS: Vec2[] = [
  { x: 1400, y: 1300 },
  { x: 600, y: 1200 },
];

/** The one nest at the ancient tree's roots — the phoenix's, always. */
export const GROVE_NEST: Vec2 = { x: 2300, y: 430 };

/** How a creature relates to water (spec §4.3 walkability). */
export type Medium = 'land' | 'water' | 'amphibious';

export function canOccupy(medium: Medium, p: Vec2): boolean {
  if (medium === 'amphibious') return true;
  return medium === 'water' ? isWater(p) : !isWater(p);
}
```

`src/sim/species.ts` — extend the interface (after `homeKind`):

```ts
  /** How the species relates to water: koi water-only, ducks amphibious. */
  medium: Medium;
  /** Below-floor / missing-sex arrivals from the map edge (spec §4.3 layer 2). */
  wandersIn: boolean;
  /** Herd species drift back toward their herd's centroid while wandering. */
  herd?: boolean;
  /** At most one family of this species may ever exist (phoenix). */
  singleFamily?: boolean;
  /** An elder's passing leaves a new chick at the grove (phoenix). */
  rebirth?: boolean;
```

Import `type Medium` from `./valley`. Add `medium: 'land'` + `wandersIn: true` to rabbit and robin. Then add the six new entries (homeKind values need the widened `HomeKind`; the `SpeciesParams.homeKind` field type becomes `HomeKind` imported from `./state`):

```ts
  deer: {
    speed: 7,
    diurnal: true,
    lifespanTicksMean: 33600, // ≈ 14 game days — the valley's gentle giants
    stageFractions: { baby: 0.1, juvenile: 0.15, adult: 0.55 },
    needRates: { hunger: 1 / 1400, rest: 1 / 2600, social: 1 / 1600 },
    eatRate: 0.0035,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'glade',
    reproduction: { mode: 'live', clutchMin: 1, clutchMax: 2, broodTicks: 700, cooldownTicks: 2400 },
    population: { floor: 3, softCap: 7, hardCap: 10 },
    medium: 'land',
    wandersIn: true,
    herd: true,
  },
  duck: {
    speed: 6,
    diurnal: true,
    lifespanTicksMean: 21600, // ≈ 9 game days
    stageFractions: { baby: 0.1, juvenile: 0.15, adult: 0.55 },
    needRates: { hunger: 1 / 1100, rest: 1 / 2400, social: 1 / 1500 },
    eatRate: 0.0045,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'reedNest',
    reproduction: { mode: 'egg', clutchMin: 2, clutchMax: 4, broodTicks: 750, cooldownTicks: 1700 },
    population: { floor: 3, softCap: 8, hardCap: 12 },
    medium: 'amphibious',
    wandersIn: true,
  },
  koi: {
    speed: 5,
    diurnal: true,
    lifespanTicksMean: 36000, // ≈ 15 game days — koi live long
    stageFractions: { baby: 0.1, juvenile: 0.14, adult: 0.6 },
    needRates: { hunger: 1 / 1500, rest: 1 / 3000, social: 1 / 2000 },
    eatRate: 0.004,
    sleepRate: 0.0025,
    socialRate: 0.005,
    homeKind: 'lilyPatch',
    reproduction: { mode: 'egg', clutchMin: 2, clutchMax: 4, broodTicks: 600, cooldownTicks: 2000 },
    population: { floor: 3, softCap: 9, hardCap: 13 },
    medium: 'water',
    wandersIn: true,
  },
  owl: {
    speed: 8,
    diurnal: false, // wakes at dusk as the robins roost
    lifespanTicksMean: 26400, // ≈ 11 game days
    stageFractions: { baby: 0.1, juvenile: 0.14, adult: 0.56 },
    needRates: { hunger: 1 / 1300, rest: 1 / 2400, social: 1 / 1800 },
    eatRate: 0.0045,
    sleepRate: 0.003,
    socialRate: 0.005,
    homeKind: 'treeHollow',
    reproduction: { mode: 'egg', clutchMin: 1, clutchMax: 3, broodTicks: 800, cooldownTicks: 2200 },
    population: { floor: 2, softCap: 6, hardCap: 9 },
    medium: 'land',
    wandersIn: true,
  },
  dodo: {
    speed: 4, // an unhurried waddle
    diurnal: true,
    lifespanTicksMean: 28800, // ≈ 12 game days
    stageFractions: { baby: 0.12, juvenile: 0.16, adult: 0.5 },
    needRates: { hunger: 1 / 1200, rest: 1 / 2200, social: 1 / 1400 },
    eatRate: 0.004,
    sleepRate: 0.003,
    socialRate: 0.006,
    homeKind: 'groundNest',
    reproduction: { mode: 'egg', clutchMin: 1, clutchMax: 2, broodTicks: 900, cooldownTicks: 2600 },
    population: { floor: 2, softCap: 5, hardCap: 8 },
    medium: 'land',
    wandersIn: true, // canonically: dodos wander into the valley from beyond
  },
  phoenix: {
    speed: 7,
    diurnal: true,
    lifespanTicksMean: 16800, // ≈ 7 game days — short, so a rebirth is witnessed
    stageFractions: { baby: 0.12, juvenile: 0.16, adult: 0.5 },
    needRates: { hunger: 1 / 1600, rest: 1 / 2600, social: 1 / 2000 },
    eatRate: 0.004,
    sleepRate: 0.003,
    socialRate: 0.005,
    homeKind: 'groveNest',
    reproduction: { mode: 'egg', clutchMin: 1, clutchMax: 1, broodTicks: 700, cooldownTicks: 4000 },
    population: { floor: 1, softCap: 3, hardCap: 4 }, // softCap 3 lets the lone pair re-nest
    medium: 'land',
    wandersIn: false, // never wanders in — rebirth is the phoenix's failsafe
    singleFamily: true,
    rebirth: true,
  },
```

`src/render/Renderer.ts` — keep tsc green while rigs don't exist yet: change `RIGS` to `Partial<Record<SpeciesId, CreatureRig>>` and add below it:

```ts
/** Placeholder until each species' rig lands (Tasks 8–11). */
function rigFor(species: SpeciesId): CreatureRig {
  return RIGS[species] ?? rabbitRig;
}
```

Replace every `RIGS[c.species]` / `RIGS[view.species]` / `RIGS[species]` read in `createView`, `applyStage`, `bakeFrames`, and `positionLabel` with `rigFor(...)`.

- [ ] **Step 4: Run tests** — `npx vitest run tests/species.test.ts` PASS, then `npx vitest run` (full suite must stay green — no behavior changed yet) and `npm run build`.
- [ ] **Step 5: Commit** — `feat: full 8-species registry, home kinds, valley sites, movement media data`

---

### Task 2: Movement media — koi swim, ducks cross, land creatures keep dry feet

**Files:**
- Modify: `src/sim/movement.ts` (medium-aware `moveToward`/`wanderStep`/`advance`)
- Modify: `src/sim/behaviors.ts` (pass medium; target picking via `canOccupy`)
- Test: `tests/swimming.test.ts` (new)

**Interfaces:**
- Consumes: `canOccupy`, `Medium`, `POND` from valley; `SPECIES[c.species].medium`.
- Produces: `moveToward(c: Creature, target: Vec2, speed: number, medium: Medium): number` and `wanderStep(rng: RngState, c: Creature, speed: number, medium: Medium): void`. All behavior-layer callers pass `SPECIES[c.species].medium`.

- [ ] **Step 1: Write the failing test** — `tests/swimming.test.ts`:

```ts
/**
 * Movement media: koi never leave the pond, land creatures never enter it,
 * and amphibious ducks can walk right in.
 */
import { describe, expect, it } from 'vitest';
import { moveToward } from '../src/sim/movement';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { isWater, POND } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

/** Empty world (keeps homes) ready for hand-placed casts. */
function bareWorld(seed = 3): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  return state;
}

describe('movement media', () => {
  it('koi stay in the pond for days on end', () => {
    const state = bareWorld();
    for (let i = 0; i < 4; i++) {
      spawnCreature(state, 'koi', { x: POND.x - 100 + i * 60, y: POND.y + 40 }, 0.4);
    }
    for (let s = 0; s < 80; s++) {
      runTicks(state, 50);
      for (const c of state.creatures) expect(isWater(c.pos)).toBe(true);
    }
  });

  it('land creatures never end up in the water', () => {
    const state = bareWorld();
    spawnCreature(state, 'rabbit', { x: 2500, y: 2000 }, 0.4); // near the shore
    spawnCreature(state, 'deer', { x: 2600, y: 1900 }, 0.4);
    for (let s = 0; s < 60; s++) {
      runTicks(state, 50);
      for (const c of state.creatures) expect(isWater(c.pos)).toBe(false);
    }
  });

  it('an amphibious duck walks into the pond; a land rabbit cannot', () => {
    const state = bareWorld();
    const duck = spawnCreature(state, 'duck', { x: 2400, y: 2300 }, 0.4);
    const rabbit = spawnCreature(state, 'rabbit', { x: 2400, y: 2250 }, 0.4);
    const target = { x: POND.x, y: POND.y };
    for (let i = 0; i < 500; i++) moveToward(duck, target, 6, 'amphibious');
    for (let i = 0; i < 500; i++) moveToward(rabbit, target, 6, 'land');
    expect(isWater(duck.pos)).toBe(true);
    expect(isWater(rabbit.pos)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/swimming.test.ts` — FAIL (moveToward has no medium param; koi walk out of the pond).

- [ ] **Step 3: Implement.** `src/sim/movement.ts`:
  - Import `canOccupy, type Medium` from `./valley` (keep `POND`).
  - `moveToward(c, target, speed, medium)`: in the `dist <= speed` arrival branch, replace `if (!isWater(target))` with `if (canOccupy(medium, target))`; pass `medium` to `advance`.
  - `wanderStep(rng, c, speed, medium)`: pass `medium` to `advance`.
  - `advance(c, speed, medium)`: replace the `isWater(candidate)` check with `!canOccupy(medium, candidate)`; when blocked, steer back to the medium's heart:

```ts
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
  } else { ... unchanged ... }
```

  `src/sim/behaviors.ts`:
  - In `applyActivity`, add `const medium = p.medium;` and pass it to every `wanderStep`/`moveToward` call (forage, socialize/court, brood, feedYoung, gather).
  - In `startActivity` forage target picking and in the feedYoung fetch-point picking, replace `isWater(candidate)` rejection with `!canOccupy(SPECIES[c.species].medium, candidate)` (so koi pick in-pond targets and ducks may dabble in the pond). Drop the now-unused `isWater` import if nothing else uses it.

- [ ] **Step 4: Run tests** — `npx vitest run tests/swimming.test.ts` PASS; full `npx vitest run` green; `npm run build` clean.
- [ ] **Step 5: Commit** — `feat: movement media — swimming koi, amphibious ducks, dry-footed land creatures`

---

### Task 3: World seeding — homes and starting cast for all eight; nocturnal owls verified

**Files:**
- Modify: `src/sim/state.ts` (homes for 6 new kinds, spawn anchors, starting cast)
- Modify: `tests/family.test.ts` (both-sexes check covers all 8)
- Test: `tests/nocturnal.test.ts` (new)

**Interfaces:**
- Consumes: valley site constants from Task 1; `spawnCreature`.
- Produces: `createWorld` registers homes for every `HomeKind` and spawns a cast containing every species in its own zone (koi in water, phoenix at the grove).

- [ ] **Step 1: Write the failing tests.**

Extend `tests/family.test.ts` — replace the species loop in the "starting cast has both sexes" test with all eight:

```ts
    for (const species of ['rabbit', 'robin', 'deer', 'duck', 'koi', 'owl', 'dodo', 'phoenix'] as const) {
```

New `tests/nocturnal.test.ts`:

```ts
/**
 * The owl keeps night hours: with identical mild needs, an owl naps at midday
 * and is out and about at midnight — exactly opposite the diurnal robin.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, isWaterSpecies, type WorldState } from '../src/sim/state';
import { isWater } from '../src/sim/valley';

function soloWorld(species: 'owl' | 'robin', atDayFrac: number): WorldState {
  const state = createWorld(9);
  state.creatures = [];
  state.families = [];
  state.tick = Math.floor(TICKS_PER_DAY * 10 + TICKS_PER_DAY * atDayFrac);
  const c = spawnCreature(state, species, { x: 2000, y: 1500 }, 0.4);
  c.needs = { hunger: 0.3, rest: 0.3, social: 0 };
  return state;
}

function activitiesOver(state: WorldState, n: number): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    tick(state, []);
    const c = state.creatures[0];
    if (c) seen.add(c.activity.id);
  }
  return seen;
}

describe('nocturnal owls', () => {
  it('owl naps at midday', () => {
    expect(activitiesOver(soloWorld('owl', 0.3), 40).has('nap')).toBe(true);
  });
  it('owl is active (never naps) at midnight', () => {
    expect(activitiesOver(soloWorld('owl', 0.8), 40).has('nap')).toBe(false);
  });
  it('robin does the reverse: active at midday, napping at midnight', () => {
    expect(activitiesOver(soloWorld('robin', 0.3), 40).has('nap')).toBe(false);
    expect(activitiesOver(soloWorld('robin', 0.8), 40).has('nap')).toBe(true);
  });
});

describe('starting world', () => {
  it('koi start in the pond; every creature starts somewhere it can be', () => {
    const state = createWorld(1234);
    for (const c of state.creatures) {
      if (c.species === 'koi') expect(isWater(c.pos)).toBe(true);
      else expect(isWater(c.pos)).toBe(false);
    }
  });
  it('homes exist for every home kind', () => {
    const state = createWorld(1);
    const kinds = new Set(state.homes.map((h) => h.kind));
    for (const k of ['burrow', 'treeNest', 'reedNest', 'lilyPatch', 'treeHollow', 'glade', 'groundNest', 'groveNest']) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });
});
```

Note: drop the `isWaterSpecies` import above — it does not exist; import only what is used (`createWorld`, `spawnCreature`, `WorldState`).

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/nocturnal.test.ts tests/family.test.ts` — FAIL (no owls/koi in cast, no new home kinds).

- [ ] **Step 3: Implement** in `src/sim/state.ts`:
  - Import the new site constants from `./valley`.
  - In `createWorld`, after the existing home registration, add one home per site:

```ts
  const siteGroups: [HomeKind, Vec2[]][] = [
    ['reedNest', REED_NESTS],
    ['lilyPatch', LILY_PATCHES],
    ['treeHollow', HOLLOW_TREES],
    ['glade', GLADES],
    ['groundNest', GROUND_NESTS],
    ['groveNest', [GROVE_NEST]],
  ];
  for (const [kind, sites] of siteGroups) {
    for (const pos of sites) {
      state.homes.push({ id: state.nextId++, kind, pos: { ...pos }, familyId: null });
    }
  }
```

  - Add spawn anchors + a generalized spawn position (keep `randomMeadowPos` semantics for rabbit/robin):

```ts
/** Where each species wakes up on day one (koi in water, phoenix at the grove). */
const SPAWN_ANCHORS: Record<SpeciesId, { x: number; y: number; rx: number; ry: number }> = {
  rabbit: { x: 2048, y: 1536, rx: 700, ry: 500 },
  robin: { x: 2048, y: 1536, rx: 700, ry: 500 },
  deer: { x: 2100, y: 1600, rx: 400, ry: 300 },
  duck: { x: 2850, y: 2020, rx: 180, ry: 100 },
  koi: { x: 3100, y: 2300, rx: 300, ry: 200 },
  owl: { x: 950, y: 850, rx: 300, ry: 250 },
  dodo: { x: 1300, y: 1250, rx: 200, ry: 150 },
  phoenix: { x: 2300, y: 480, rx: 120, ry: 80 },
};

function spawnPosFor(rng: RngState, species: SpeciesId): Vec2 {
  const a = SPAWN_ANCHORS[species];
  return { x: a.x + nextRange(rng, -a.rx, a.rx), y: a.y + nextRange(rng, -a.ry, a.ry) };
}
```

  - Append to `STARTING_CAST` (AFTER the rabbit/robin entries — behavior tests slice the head of the array):

```ts
  { species: 'deer', ageFrac: 0.45, sex: 'm' },
  { species: 'deer', ageFrac: 0.5, sex: 'f' },
  { species: 'deer', ageFrac: 0.3, sex: 'f' },
  { species: 'deer', ageFrac: 0.2, sex: 'm' }, // young stag tags along
  { species: 'duck', ageFrac: 0.45, sex: 'm' },
  { species: 'duck', ageFrac: 0.5, sex: 'f' },
  { species: 'duck', ageFrac: 0.12, sex: 'f' }, // duckling
  { species: 'koi', ageFrac: 0.45, sex: 'm' },
  { species: 'koi', ageFrac: 0.5, sex: 'f' },
  { species: 'koi', ageFrac: 0.3, sex: 'f' },
  { species: 'koi', ageFrac: 0.6, sex: 'm' },
  { species: 'owl', ageFrac: 0.45, sex: 'm' },
  { species: 'owl', ageFrac: 0.5, sex: 'f' },
  { species: 'dodo', ageFrac: 0.5, sex: 'm' },
  { species: 'dodo', ageFrac: 0.45, sex: 'f' },
  { species: 'phoenix', ageFrac: 0.5, sex: 'm' },
  { species: 'phoenix', ageFrac: 0.55, sex: 'f' },
```

  - In the cast loop, use `spawnPosFor(rng, species)` instead of `randomMeadowPos(rng)` (delete `randomMeadowPos` — the anchors table replaces it).
- [ ] **Step 4: Run the full suite** — `npx vitest run`. The nocturnal + family tests pass. If any pre-existing test trips on the larger cast, fix the *test's* assumption only if it hard-codes the old cast size; sim behavior must not be changed to appease it.
- [ ] **Step 5: Commit** — `feat: all eight species wake up in the valley — homes, spawn zones, starting cast`

---

### Task 4: Deer herd cohesion

**Files:**
- Modify: `src/sim/behaviors.ts` (herd pull during wander)
- Test: `tests/herd.test.ts` (new)

**Interfaces:**
- Consumes: `SPECIES[c.species].herd`, `turnToward` from movement.
- Produces: wandering herd creatures beyond 350 units of their herd centroid steer gently back toward it.

- [ ] **Step 1: Write the failing test** — `tests/herd.test.ts`:

```ts
/**
 * Deer keep loose company: scattered to the corners of the valley, the herd
 * drifts back together within a couple of game days.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';

function meanDistToCentroid(state: WorldState): number {
  const deer = state.creatures.filter((c) => c.species === 'deer');
  const cx = deer.reduce((s, c) => s + c.pos.x, 0) / deer.length;
  const cy = deer.reduce((s, c) => s + c.pos.y, 0) / deer.length;
  return deer.reduce((s, c) => s + Math.hypot(c.pos.x - cx, c.pos.y - cy), 0) / deer.length;
}

describe('deer herd cohesion', () => {
  it('a scattered herd regathers', () => {
    const state = createWorld(21);
    state.creatures = [];
    state.families = [];
    const corners = [
      { x: 400, y: 400 },
      { x: 3700, y: 400 },
      { x: 400, y: 2700 },
      { x: 3700, y: 2700 },
      { x: 2000, y: 1500 },
    ];
    for (const pos of corners) spawnCreature(state, 'deer', pos, 0.4);
    const before = meanDistToCentroid(state);
    for (let i = 0; i < 5000; i++) tick(state, []);
    const after = meanDistToCentroid(state);
    expect(after).toBeLessThan(before * 0.5);
    expect(after).toBeLessThan(600);
  }, 20000);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/herd.test.ts` — FAIL (random walkers stay scattered).

- [ ] **Step 3: Implement** in `src/sim/behaviors.ts`:

```ts
const HERD_RADIUS = 350;
const HERD_TURN = 0.1;

/** Beyond the herd's edge, lean the wander heading back toward the others. */
function applyHerdPull(state: WorldState, c: Creature): void {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const other of state.creatures) {
    if (other.id === c.id || other.species !== c.species) continue;
    sx += other.pos.x;
    sy += other.pos.y;
    n++;
  }
  if (n === 0) return;
  const cx = sx / n;
  const cy = sy / n;
  if (Math.hypot(cx - c.pos.x, cy - c.pos.y) <= HERD_RADIUS) return;
  c.heading = turnToward(c.heading, Math.atan2(cy - c.pos.y, cx - c.pos.x), HERD_TURN);
}
```

Import `turnToward` from `./movement`. In `applyActivity`'s `'wander'` case, before `wanderStep`: `if (p.herd) applyHerdPull(state, c);`. Also apply the same pull when picking forage targets for herd species: in `startActivity`'s forage case, for herd species re-center the candidate sampling on the midpoint between the creature and the herd centroid — implement by computing the centroid the same way and sampling `angle` around `Math.atan2(cy - c.pos.y, cx - c.pos.x) ± 1.2` instead of the full circle when the creature is beyond `HERD_RADIUS`. (If that block gets long, extract `herdCentroid(state, c): Vec2 | undefined` and use it from both places.)

- [ ] **Step 4: Run tests** — `npx vitest run tests/herd.test.ts` PASS; full suite green.
- [ ] **Step 5: Commit** — `feat: deer herd cohesion — wanderers drift back to the herd`

---

### Task 5: Population regulator — wanderer arrivals from the map edge

**Files:**
- Create: `src/sim/population.ts`
- Modify: `src/sim/state.ts` (`lastWandererTick` field), `src/sim/events.ts` ('wandererArrived'), `src/sim/Sim.ts` (pipeline)
- Test: `tests/population.test.ts` (new)

**Interfaces:**
- Consumes: `SPECIES`, `spawnCreature`, `emit`, `POND`, world bounds.
- Produces: `regulatePopulation(state: WorldState): void` called in `tick()` after `familySystem`; `WorldState.lastWandererTick: Partial<Record<SpeciesId, number>>` (initialized `{}` in `createWorld`); event kind `'wandererArrived'`.

- [ ] **Step 1: Write the failing test** — `tests/population.test.ts`:

```ts
/**
 * The wanderer failsafe (spec §4.3 layer 2): when a species falls below its
 * floor — or its singles are all one sex — a new adult wanders in from the
 * map edge. Canonically, this is how dodos keep finding the valley.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { isWater } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

function count(state: WorldState, species: string): number {
  return state.creatures.filter((c) => c.species === species).length;
}

describe('wanderer arrivals', () => {
  it('a vanished dodo population is refounded from the map edge', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'dodo');
    runTicks(state, 2500);
    expect(count(state, 'dodo')).toBeGreaterThan(0);
    expect(state.eventLog.some((e) => e.kind === 'wandererArrived' && e.species === 'dodo')).toBe(true);
  });

  it('arrivals trickle in on a cooldown, never a flood', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'dodo');
    runTicks(state, 1900);
    const arrivals = state.eventLog.filter(
      (e) => e.kind === 'wandererArrived' && e.species === 'dodo',
    ).length;
    expect(arrivals).toBe(1);
  });

  it('two bachelor ducks attract a female wanderer', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'duck');
    state.families = state.families.filter((f) => f.species !== 'duck');
    for (let i = 0; i < 3; i++) {
      const d = spawnCreature(state, 'duck', { x: 2850 + i * 30, y: 2000 }, 0.4);
      d.sex = 'm';
    }
    runTicks(state, 2500);
    expect(state.creatures.some((c) => c.species === 'duck' && c.sex === 'f')).toBe(true);
  });

  it('a koi wanderer arrives in the water, not on a hilltop', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'koi');
    runTicks(state, 2500);
    const koi = state.creatures.filter((c) => c.species === 'koi');
    expect(koi.length).toBeGreaterThan(0);
    for (const k of koi) expect(isWater(k.pos)).toBe(true);
  });

  it('the phoenix never wanders in', () => {
    const state = createWorld(31);
    state.creatures = state.creatures.filter((c) => c.species !== 'phoenix');
    state.families = state.families.filter((f) => f.species !== 'phoenix');
    runTicks(state, 5000);
    expect(state.eventLog.some((e) => e.kind === 'wandererArrived' && e.species === 'phoenix')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/population.test.ts` — FAIL (`wandererArrived` doesn't exist).

- [ ] **Step 3: Implement.**
  - `src/sim/events.ts`: `export type SimEventKind = 'paired' | 'nested' | 'eggLaid' | 'born' | 'hatched' | 'passed' | 'wandererArrived' | 'reborn';` (add `'reborn'` now too — Task 6 uses it).
  - `src/sim/state.ts`: add `lastWandererTick: Partial<Record<SpeciesId, number>>;` to `WorldState`, initialize `lastWandererTick: {}` in `createWorld`.
  - `src/sim/population.ts`:

```ts
/**
 * Population regulator, layer 2 (spec §4.3): the wanderer floor failsafe.
 * When a species dwindles below its floor — or its unpaired adults are all
 * one sex with no family carrying the line — a new adult wanders in from
 * the map edge (or glides into the pond, for koi). Rate-limited per species
 * so recoveries feel like quiet arrivals, not a flood.
 */
import { emit } from './events';
import { nextRange } from './rng';
import { SPECIES } from './species';
import {
  spawnCreature,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from './state';
import { POND } from './valley';

const WANDERER_COOLDOWN = 2000;
const ARRIVAL_AGE_FRAC = 0.4; // arrives as a settled adult, for every species

export function regulatePopulation(state: WorldState): void {
  for (const species of Object.keys(SPECIES) as SpeciesId[]) {
    const p = SPECIES[species];
    if (!p.wandersIn) continue;
    const last = state.lastWandererTick[species];
    if (last !== undefined && state.tick - last < WANDERER_COOLDOWN) continue;

    const members = state.creatures.filter((c) => c.species === species);
    const belowFloor = members.length < p.population.floor;
    const singles = members.filter((c) => c.familyId === null && c.stage === 'adult');
    const hasFamily = state.families.some((f) => f.species === species);
    const missingSex =
      !hasFamily &&
      singles.length > 0 &&
      (singles.every((c) => c.sex === 'm') || singles.every((c) => c.sex === 'f'));
    if (!belowFloor && !missingSex) continue;

    const pos = p.medium === 'water' ? pondEdgePos(state) : mapEdgePos(state);
    const wanderer = spawnCreature(state, species, pos, ARRIVAL_AGE_FRAC);
    if (missingSex && singles[0]) wanderer.sex = singles[0].sex === 'm' ? 'f' : 'm';
    state.lastWandererTick[species] = state.tick;
    emit(state, { kind: 'wandererArrived', tick: state.tick, species, pos: { ...pos } });
  }
}

function mapEdgePos(state: WorldState): Vec2 {
  const rng = state.rng;
  const side = Math.floor(nextRange(rng, 0, 4));
  const m = 60;
  if (side === 0) return { x: nextRange(rng, m, WORLD_WIDTH - m), y: m };
  if (side === 1) return { x: WORLD_WIDTH - m, y: nextRange(rng, m, WORLD_HEIGHT - m) };
  if (side === 2) return { x: nextRange(rng, m, WORLD_WIDTH - m), y: WORLD_HEIGHT - m };
  return { x: m, y: nextRange(rng, m, WORLD_HEIGHT - m) };
}

/** Koi slip in at the pond's rim, already in the water. */
function pondEdgePos(state: WorldState): Vec2 {
  const a = nextRange(state.rng, 0, Math.PI * 2);
  return { x: POND.x + Math.cos(a) * POND.rx * 0.8, y: POND.y + Math.sin(a) * POND.ry * 0.8 };
}
```

  - `src/sim/Sim.ts`: import and call `regulatePopulation(state)` immediately after `familySystem(state)` (spec pipeline order: family FSM → population regulator).
- [ ] **Step 4: Run tests** — `npx vitest run tests/population.test.ts` PASS; full suite green (note: determinism tests still pass because the regulator is part of the same deterministic pipeline).
- [ ] **Step 5: Commit** — `feat: population regulator — wanderers arrive when a species dwindles`

---

### Task 6: Phoenix — exactly one family, rebirth at the ancient tree

**Files:**
- Modify: `src/sim/family.ts` (singleFamily gate; rebirth on passing)
- Test: `tests/phoenix.test.ts` (new)

**Interfaces:**
- Consumes: `SPECIES[..].singleFamily` / `.rebirth`, `GROVE_NEST` from valley, `spawnCreature`, `emit`, `enterPhase`.
- Produces: at most one phoenix family ever exists; a passing phoenix elder leaves one new chick at the grove and a `'reborn'` event; phoenixes never go extinct in an untouched world.

- [ ] **Step 1: Write the failing test** — `tests/phoenix.test.ts`:

```ts
/**
 * The phoenix (spec §4.3 layer 3): exactly one family ever, and an elder's
 * passing IS the rebirth — a new chick left in soft embers at the grove.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';
import { GROVE_NEST } from '../src/sim/valley';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

function phoenixes(state: WorldState) {
  return state.creatures.filter((c) => c.species === 'phoenix');
}

describe('phoenix rebirth', () => {
  it('a passing elder leaves a new chick at the grove', () => {
    const state = createWorld(55);
    for (const p of phoenixes(state)) p.ageTicks = p.lifespanTicks - 20;
    runTicks(state, 600);
    expect(state.eventLog.some((e) => e.kind === 'reborn')).toBe(true);
    const flock = phoenixes(state);
    expect(flock.length).toBeGreaterThan(0);
    const chick = flock.find((c) => c.stage === 'baby');
    expect(chick).toBeDefined();
    if (chick) {
      expect(Math.hypot(chick.pos.x - GROVE_NEST.x, chick.pos.y - GROVE_NEST.y)).toBeLessThan(200);
    }
  });

  it('the world never has more than one phoenix family', () => {
    const state = createWorld(55);
    // Tempt fate: four extra unattached adults right at the grove.
    for (let i = 0; i < 4; i++) {
      spawnCreature(state, 'phoenix', { x: 2280 + i * 20, y: 460 }, 0.4);
    }
    for (let i = 0; i < 8000; i++) {
      tick(state, []);
      const fams = state.families.filter((f) => f.species === 'phoenix').length;
      expect(fams).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('phoenixes never disappear from an untouched world', () => {
    const state = createWorld(55);
    for (let s = 0; s < 100; s++) {
      runTicks(state, 240);
      expect(phoenixes(state).length).toBeGreaterThan(0);
    }
  }, 60000);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/phoenix.test.ts` — FAIL (no rebirth; possibly multiple families).

- [ ] **Step 3: Implement** in `src/sim/family.ts`:
  - Import `GROVE_NEST` from `./valley`.
  - In `formPairs`, after the `populationAllowsPairing` check:

```ts
    if (SPECIES[a.species].singleFamily && state.families.some((f) => f.species === a.species)) {
      continue;
    }
```

  - In `handlePassings`, in the completion loop, before `removeCreature(state, c)`:

```ts
    if (SPECIES[c.species].rebirth) rebirth(state, c);
```

  - Add:

```ts
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
```

  (An orphan chick — family already gone — simply grows up free at the grove; the singleFamily gate lets it found the next family. The memorial still blooms; the renderer gives phoenix memorials embers instead of flowers in Task 12.)
- [ ] **Step 4: Run tests** — `npx vitest run tests/phoenix.test.ts` PASS; full suite green.
- [ ] **Step 5: Commit** — `feat: phoenix — one family only, rebirth in soft embers at the ancient tree`

---

### Task 7: Population balance property suite

**Files:**
- Test: `tests/balance.test.ts` (new)
- Possibly modify: `src/sim/species.ts` (tuning only — reproduction/cooldown/caps values)

**Interfaces:**
- Consumes: the whole sim via `createWorld` + `tick`.
- Produces: CI-guarded invariants: no species ever exceeds hardCap; no species is extinct at the end of a long run; phoenix families ≤ 1 throughout and phoenix count within [1, hardCap].

- [ ] **Step 1: Write the test** — `tests/balance.test.ts`:

```ts
/**
 * Population balance property tests (spec §5). The spec calls for 100
 * game-days × 10 seeds; to keep CI under a couple of minutes we run
 * 30 game-days × 6 seeds plus one 100-day deep soak. Invariants:
 * counts never exceed hardCap, nothing is extinct at the end, and the
 * phoenix stays singular. Sampled every 60 ticks.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import { createWorld, type SpeciesId, type WorldState } from '../src/sim/state';

const ALL = Object.keys(SPECIES) as SpeciesId[];

function counts(state: WorldState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ALL) out[id] = 0;
  for (const c of state.creatures) out[c.species] = (out[c.species] ?? 0) + 1;
  return out;
}

function soak(seed: number, days: number): void {
  const state = createWorld(seed);
  const totalTicks = days * TICKS_PER_DAY;
  for (let t = 0; t < totalTicks; t++) {
    tick(state, []);
    if (t % 60 !== 0) continue;
    const c = counts(state);
    for (const id of ALL) {
      expect(c[id], `${id} over hardCap at tick ${state.tick} (seed ${seed})`).toBeLessThanOrEqual(
        SPECIES[id].population.hardCap,
      );
    }
    const phoenixFams = state.families.filter((f) => f.species === 'phoenix').length;
    expect(phoenixFams, `phoenix families at tick ${state.tick}`).toBeLessThanOrEqual(1);
    expect(c.phoenix, `phoenix extinct at tick ${state.tick}`).toBeGreaterThanOrEqual(1);
  }
  const end = counts(state);
  for (const id of ALL) {
    expect(end[id], `${id} extinct after ${days} days (seed ${seed})`).toBeGreaterThanOrEqual(1);
  }
}

describe('population balance', () => {
  it.each([11, 23, 37, 58, 71, 94])('30 game-days stay in band (seed %i)', (seed) => {
    soak(seed, 30);
  }, 120000);

  it('100 game-day deep soak (seed 7)', () => {
    soak(7, 100);
  }, 300000);
});
```

- [ ] **Step 2: Run it** — `npx vitest run tests/balance.test.ts`. This is the milestone's balance gate; first run may FAIL.
- [ ] **Step 3: Tune until green — using only these dials, in this order:**
  1. A species exceeds hardCap → raise its `reproduction.cooldownTicks`, or lower `clutchMax`, or lower `softCap` (fertility gates at softCap; hard cap is enforced by pairing pressure, so the controller must converge below it).
  2. A species goes extinct → check the wanderer path first (is `wandersIn: true`? is the floor sensible?); then lengthen `lifespanTicksMean` or shorten `cooldownTicks`.
  3. Phoenix count drifts above hardCap → verify `clutchMax: 1` and the singleFamily gate; lengthen phoenix `cooldownTicks`.
  Never change sim *mechanics* here — data values only. If a mechanic is genuinely broken, fix it in its own task's file with a regression test, not by tuning.
- [ ] **Step 4: Full suite + timing** — `npx vitest run`; note the balance suite's wall time in the commit message. If total suite exceeds ~4 minutes, cut the deep soak to 60 days (leave a comment referencing spec §5).
- [ ] **Step 5: Commit** — `test: population balance property suite — 6 seeds × 30 days + 100-day soak`

---

### Task 8: Rig registry + integrity tests + the deer rig

**Files:**
- Create: `src/rigs/allRigs.ts`, `src/rigs/deerRig.ts`
- Test: `tests/rigs.test.ts` (new)

**Interfaces:**
- Consumes: `CreatureRig` from `src/rigs/format.ts`.
- Produces: `ALL_RIGS: CreatureRig[]` (single registration point; Renderer consumes it in Task 12); `deerRig: CreatureRig`.

- [ ] **Step 1: Write the failing test** — `tests/rigs.test.ts` (pure data, no Pixi — legal under the sim-only test rule):

```ts
/**
 * Rig data integrity: parts form a valid parent-ordered tree, clips and
 * stage overrides reference real parts, keyframes are well-formed.
 * (How rigs LOOK is eyeballed in the browser; this guards structure only.)
 */
import { describe, expect, it } from 'vitest';
import { ALL_RIGS } from '../src/rigs/allRigs';

describe.each(ALL_RIGS.map((r) => [r.species, r] as const))('%s rig', (_species, rig) => {
  it('parts have unique ids and parents defined before children', () => {
    const seen = new Set<string>();
    for (const part of rig.parts) {
      expect(seen.has(part.id)).toBe(false);
      if (part.parent !== null) expect(seen.has(part.parent)).toBe(true);
      seen.add(part.id);
    }
  });

  it('all four life stages are styled and reference real parts', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const stage of ['baby', 'juvenile', 'adult', 'elder'] as const) {
      const style = rig.stages[stage];
      expect(style.scale).toBeGreaterThan(0);
      for (const partId of Object.keys(style.partScale ?? {})) {
        expect(ids.has(partId)).toBe(true);
      }
    }
  });

  it('all five clips exist, tracks target real parts, keyframes span 0..1 ascending', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const name of ['idle', 'walk', 'sleep', 'eat', 'social'] as const) {
      const clip = rig.clips[name];
      expect(clip.durationMs).toBeGreaterThan(0);
      for (const track of clip.tracks) {
        expect(ids.has(track.partId)).toBe(true);
        for (const channel of [track.rot, track.px, track.py, track.sx, track.sy]) {
          if (!channel) continue;
          expect(channel.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < channel.length; i++) {
            const prev = channel[i - 1];
            const curr = channel[i];
            if (prev && curr) expect(curr.t).toBeGreaterThanOrEqual(prev.t);
          }
          expect(channel[0]?.t).toBe(0);
          expect(channel[channel.length - 1]?.t).toBe(1);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Create `src/rigs/allRigs.ts`:**

```ts
/**
 * The single rig registration point. Renderer and tests both read this list;
 * a species missing here renders as the placeholder until its rig lands.
 */
import type { CreatureRig } from './format';
import { deerRig } from './deerRig';
import { rabbitRig } from './rabbitRig';
import { robinRig } from './robinRig';

export const ALL_RIGS: CreatureRig[] = [rabbitRig, robinRig, deerRig];
```

- [ ] **Step 3: Create `src/rigs/deerRig.ts`** — quadruped like the rabbit but tall, with neck, four legs, and fawn spots that fade after babyhood:

```ts
/**
 * The deer rig: warm fawn coat, cream belly, alert ears, fawn spots that
 * fade after babyhood. Side view facing +x; origin at ground contact.
 */
import type { CreatureRig } from './format';

const COAT = 0xc99b6f;
const COAT_DARK = 0xb0855c;
const CREAM = 0xf1e5d2;

export const deerRig: CreatureRig = {
  species: 'deer',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 46, ry: 12, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'body', parent: null, x: 0, y: -58, z: 0,
      shapes: [
        { kind: 'roundRect', x: -45, y: -20, w: 88, h: 42, r: 20, fill: { color: COAT } },
        { kind: 'ellipse', x: 0, y: 16, rx: 30, ry: 12, fill: { color: CREAM, alpha: 0.75 } },
      ] },
    { id: 'spots', parent: 'body', x: 0, y: -6, z: 1,
      shapes: [
        { kind: 'circle', x: -20, y: -4, r: 3.2, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -8, y: 2, r: 2.8, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -26, y: 6, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 4, y: -6, r: 3, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 14, y: 2, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
      ] },
    { id: 'tail', parent: 'body', x: -45, y: -12, z: -1,
      shapes: [{ kind: 'ellipse', x: -4, y: -2, rx: 7, ry: 5, fill: { color: COAT_DARK } }] },
    { id: 'legBB', parent: 'body', x: -32, y: 18, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -3, y2: 40, width: 7, fill: { color: COAT_DARK } }] },
    { id: 'legBF', parent: 'body', x: -24, y: 20, z: 2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: 38, width: 7, fill: { color: COAT } }] },
    { id: 'legFB', parent: 'body', x: 22, y: 18, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: 40, width: 6.5, fill: { color: COAT_DARK } }] },
    { id: 'legFF', parent: 'body', x: 32, y: 20, z: 2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 3, y2: 38, width: 6.5, fill: { color: COAT } }] },
    { id: 'neck', parent: 'body', x: 38, y: -14, z: 3,
      shapes: [{ kind: 'ellipse', x: 7, y: -16, rx: 11, ry: 22, fill: { color: COAT } }] },
    { id: 'head', parent: 'neck', x: 12, y: -34, z: 1,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 13, fill: { color: COAT } },
        { kind: 'ellipse', x: 11, y: 4, rx: 8, ry: 5.5, fill: { color: CREAM } },
        { kind: 'circle', x: 17, y: 4, r: 2.2, fill: { color: 0x3a3230 } }, // nose
        { kind: 'circle', x: 3, y: -3, r: 2.6, fill: { color: 0x3a3230 } }, // eye
      ] },
    { id: 'earL', parent: 'head', x: -8, y: -9, z: -1,
      shapes: [
        { kind: 'ellipse', x: -3, y: -8, rx: 5, ry: 10, fill: { color: COAT } },
        { kind: 'ellipse', x: -3, y: -7, rx: 2.4, ry: 6, fill: { color: 0xe9c9d4, alpha: 0.85 } },
      ] },
    { id: 'earR', parent: 'head', x: 2, y: -11, z: -2,
      shapes: [
        { kind: 'ellipse', x: 2, y: -8, rx: 5, ry: 10, fill: { color: COAT_DARK } },
        { kind: 'ellipse', x: 2, y: -7, rx: 2.4, ry: 6, fill: { color: 0xe9c9d4, alpha: 0.85 } },
      ] },
  ],
  stages: {
    baby: {
      scale: 0.45, // a wobbly fawn
      partScale: {
        head: { x: 1.3, y: 1.3 },
        neck: { x: 0.9, y: 0.8 },
        legBB: { x: 1, y: 0.85 }, legBF: { x: 1, y: 0.85 },
        legFB: { x: 1, y: 0.85 }, legFF: { x: 1, y: 0.85 },
      },
    },
    juvenile: { scale: 0.72, partScale: { head: { x: 1.1, y: 1.1 }, spots: { x: 0.6, y: 0.6 } } },
    adult: { scale: 1, partScale: { spots: { x: 0, y: 0 } } }, // spots fade with age
    elder: { scale: 0.97, tint: 0xcfcac2, partScale: { spots: { x: 0, y: 0 } } },
  },
  clips: {
    idle: {
      durationMs: 2600,
      tracks: [
        { partId: 'earL', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0 }, { t: 0.48, v: 0.35 }, { t: 0.56, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.7, v: 0 }, { t: 0.78, v: 0.5 }, { t: 0.86, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.06 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 640,
      tracks: [
        { partId: 'legBB', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'legBF', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFB', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFF', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
      ],
    },
    sleep: {
      durationMs: 3800,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 10 }, { t: 1, v: 10 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.91 }, { t: 1, v: 0.95 }] },
      ],
    },
    eat: {
      durationMs: 1400,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 1.05 }, { t: 0.6, v: 1.05 }, { t: 0.8, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1100,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.25 }, { t: 0.6, v: 0.15 }, { t: 1, v: 0 }] },
        { partId: 'earL', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'earR', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/rigs.test.ts` PASS (validates rabbit + robin + deer); `npm run build` clean.
- [ ] **Step 5: Eyeball (optional if headless):** `npm run dev`, `~` panel, follow a deer at close zoom; tune coordinates if something looks off. Structural tests must stay green.
- [ ] **Step 6: Commit** — `feat: rig registry + integrity tests + the deer rig`

---

### Task 9: Duck and koi rigs

**Files:**
- Create: `src/rigs/duckRig.ts`, `src/rigs/koiRig.ts`
- Modify: `src/rigs/allRigs.ts` (register both)

**Interfaces:**
- Consumes/Produces: `CreatureRig` entries appended to `ALL_RIGS`. Integrity tests from Task 8 cover them automatically (they iterate `ALL_RIGS`).

- [ ] **Step 1: Create `src/rigs/duckRig.ts`:**

```ts
/**
 * The duck rig: warm brown paddler with a cream breast, teal wing speculum,
 * cheerful orange bill. Ducklings are golden fluff. Side view facing +x.
 */
import type { CreatureRig } from './format';

const BROWN = 0x9b8262;
const BROWN_DARK = 0x846d4e;
const CREAM = 0xe9dcc0;
const BILL = 0xe8a53c;

export const duckRig: CreatureRig = {
  species: 'duck',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 19, ry: 5.5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'legB', parent: null, x: -4, y: 0, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -1, y2: -9, width: 2.6, fill: { color: BILL } }] },
    { id: 'legF', parent: null, x: 3, y: 0, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 1, y2: -9, width: 2.6, fill: { color: BILL } }] },
    { id: 'body', parent: null, x: 0, y: -16, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 19, ry: 12, fill: { color: BROWN } },
        { kind: 'ellipse', x: 7, y: 4, rx: 11, ry: 8, fill: { color: CREAM } },
      ] },
    { id: 'tail', parent: 'body', x: -16, y: -4, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q -9 -1 -11 -7 Q -6 -3 -1 -3 Z', fill: { color: BROWN_DARK } }] },
    { id: 'wing', parent: 'body', x: -4, y: -2, z: 1,
      shapes: [
        { kind: 'ellipse', x: -3, y: 3, rx: 11, ry: 7, fill: { color: BROWN_DARK } },
        { kind: 'ellipse', x: -6, y: 4, rx: 4, ry: 2.4, fill: { color: 0x3e7d8a } }, // speculum
      ] },
    { id: 'head', parent: 'body', x: 14, y: -12, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 8.5, fill: { color: 0x8a7355 } },
        { kind: 'ellipse', x: 0, y: -4, rx: 7, ry: 4.5, fill: { color: 0x6f8a72, alpha: 0.6 } }, // soft teal crown
        { kind: 'circle', x: 3.5, y: -1.5, r: 1.9, fill: { color: 0x201c1a } },
      ] },
    { id: 'bill', parent: 'head', x: 7.5, y: 1, z: 1,
      shapes: [{ kind: 'path', d: 'M 0 -2.5 L 10 -1 Q 12 0.5 10 2 L 0 3.5 Z', fill: { color: BILL } }] },
  ],
  stages: {
    baby: {
      scale: 0.5,
      partScale: { head: { x: 1.3, y: 1.3 }, tail: { x: 0.5, y: 0.7 }, wing: { x: 0.7, y: 0.7 } },
      tint: 0xf0dc9a, // golden duckling fluff
    },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xd3cfc6 },
  },
  clips: {
    idle: {
      durationMs: 2100,
      tracks: [
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.42, v: 0 }, { t: 0.5, v: 0.4 }, { t: 0.6, v: -0.2 }, { t: 0.68, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.1 }, { t: 0.5, v: -0.08 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 520, // the waddle
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0.12 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.12 }],
          py: [{ t: 0, v: 0 }, { t: 0.25, v: -1.5 }, { t: 0.5, v: 0 }, { t: 0.75, v: -1.5 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.2 }, { t: 0.5, v: 0.2 }, { t: 1, v: -0.2 }] },
      ],
    },
    sleep: {
      durationMs: 3600,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: -0.6 }, { t: 1, v: -0.6 }],
          px: [{ t: 0, v: -6 }, { t: 1, v: -6 }], py: [{ t: 0, v: 4 }, { t: 1, v: 4 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.94 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.94 }] },
      ],
    },
    eat: {
      durationMs: 900, // dabbling, bottoms-up hint
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.9 }, { t: 0.55, v: 0.9 }, { t: 0.75, v: 0.2 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.22 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.35, v: -0.35 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 850,
      tracks: [
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.5 }, { t: 0.4, v: 0 }, { t: 0.6, v: -0.5 }, { t: 0.8, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 2: Create `src/rigs/koiRig.ts`** — origin at body center (koi float in water; the "shadow" is a soft deep-water blur):

```ts
/**
 * The koi rig: cream body with warm orange patches, translucent fins,
 * a slow easy tail. Side view facing +x; origin at body center — koi
 * float in the pond, so the shadow is a soft deep-water blur.
 */
import type { CreatureRig } from './format';

const BODY = 0xf2ede2;
const ORANGE = 0xe07a3f;
const FIN = 0xf5c9a5;

export const koiRig: CreatureRig = {
  species: 'koi',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 7, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 18, ry: 6, fill: { color: 0x2f6a78, alpha: 0.35 } }] },
    { id: 'body', parent: null, x: 0, y: 0, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 20, ry: 9, fill: { color: BODY } },
        { kind: 'circle', x: 13, y: -1.5, r: 2, fill: { color: 0x2a2a2a } }, // eye
      ] },
    { id: 'patch', parent: 'body', x: 0, y: 0, z: 1,
      shapes: [
        { kind: 'ellipse', x: 4, y: -3, rx: 7, ry: 4.5, fill: { color: ORANGE, alpha: 0.95 } },
        { kind: 'circle', x: -8, y: 2, r: 4, fill: { color: ORANGE, alpha: 0.9 } },
      ] },
    { id: 'dorsal', parent: 'body', x: -2, y: -8, z: -1,
      shapes: [{ kind: 'path', d: 'M -6 0 Q 0 -7 8 -1 Z', fill: { color: FIN, alpha: 0.85 } }] },
    { id: 'pectoral', parent: 'body', x: 4, y: 6, z: 1,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 4, ry: 6, fill: { color: FIN, alpha: 0.7 } }] },
    { id: 'tailFin', parent: 'body', x: -19, y: 0, z: -2,
      shapes: [{ kind: 'path', d: 'M 0 0 L -14 -9 L -9 0 L -14 9 Z', fill: { color: FIN, alpha: 0.9 } }] },
  ],
  stages: {
    baby: { scale: 0.45, partScale: { tailFin: { x: 1.2, y: 1.2 } } }, // fry: mostly tail
    juvenile: { scale: 0.7 },
    adult: { scale: 1 },
    elder: { scale: 0.97, tint: 0xdcdce2 },
  },
  clips: {
    idle: {
      durationMs: 2600, // lazy fanning
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.22 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.22 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 700, // swimming
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.55 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.55 }, { t: 1, v: 0 }] },
        { partId: 'body', sx: [{ t: 0, v: 1 }, { t: 0.25, v: 0.97 }, { t: 0.5, v: 1 }, { t: 0.75, v: 0.97 }, { t: 1, v: 1 }] },
        { partId: 'dorsal', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0 }] },
      ],
    },
    sleep: {
      durationMs: 4200, // resting in the shallows, barely a ripple
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.1 }, { t: 1, v: 0 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: 1.5 }, { t: 1, v: 0 }] },
      ],
    },
    eat: {
      durationMs: 800, // surface gulps
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.18 }, { t: 0.6, v: 0 }, { t: 1, v: 0 }],
          sx: [{ t: 0, v: 1 }, { t: 0.35, v: 1.05 }, { t: 0.5, v: 1 }, { t: 1, v: 1 }] },
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.4 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.4 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 600, // excited circling flicks
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.2, v: 0.6 }, { t: 0.5, v: -0.6 }, { t: 0.8, v: 0.4 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.5 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 3: Register both** in `src/rigs/allRigs.ts` (`ALL_RIGS = [rabbitRig, robinRig, deerRig, duckRig, koiRig]`).
- [ ] **Step 4: Run tests** — `npx vitest run tests/rigs.test.ts` PASS; `npm run build` clean.
- [ ] **Step 5: Commit** — `feat: duck and koi rigs`

---

### Task 10: Owl and dodo rigs

**Files:**
- Create: `src/rigs/owlRig.ts`, `src/rigs/dodoRig.ts`
- Modify: `src/rigs/allRigs.ts`

- [ ] **Step 1: Create `src/rigs/owlRig.ts`:**

```ts
/**
 * The owl rig: round tawny body, cream facial disc, deep amber-ringed eyes,
 * little ear tufts. Side view facing +x; origin at the feet.
 */
import type { CreatureRig } from './format';

const TAWNY = 0xa08058;
const TAWNY_DARK = 0x8a6c48;
const DISC = 0xefe4cc;

export const owlRig: CreatureRig = {
  species: 'owl',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 16, ry: 5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'legB', parent: null, x: -4, y: 0, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -1, y2: -7, width: 2.4, fill: { color: 0xc9a86a } }] },
    { id: 'legF', parent: null, x: 3, y: 0, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 1, y2: -7, width: 2.4, fill: { color: 0xc9a86a } }] },
    { id: 'body', parent: null, x: 0, y: -22, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 15, ry: 17, fill: { color: TAWNY } },
        { kind: 'ellipse', x: 3, y: 5, rx: 9, ry: 11, fill: { color: 0xe3d5b8 } },
        { kind: 'ellipse', x: 3, y: 2, rx: 6, ry: 3, fill: { color: TAWNY_DARK, alpha: 0.4 } }, // breast bars
        { kind: 'ellipse', x: 3, y: 8, rx: 6, ry: 3, fill: { color: TAWNY_DARK, alpha: 0.35 } },
      ] },
    { id: 'tail', parent: 'body', x: -9, y: 13, z: -1,
      shapes: [{ kind: 'ellipse', x: -3, y: 3, rx: 6, ry: 9, fill: { color: TAWNY_DARK } }] },
    { id: 'wing', parent: 'body', x: -7, y: -2, z: 1,
      shapes: [{ kind: 'ellipse', x: -2, y: 4, rx: 8, ry: 13, fill: { color: TAWNY_DARK } }] },
    { id: 'head', parent: 'body', x: 3, y: -20, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 12, fill: { color: 0xa88a64 } },
        { kind: 'circle', x: -3, y: -1, r: 6.5, fill: { color: DISC } }, // facial disc
        { kind: 'circle', x: 5, y: -1, r: 6.5, fill: { color: DISC } },
        { kind: 'circle', x: -2, y: -1, r: 3.6, fill: { color: 0xd9a441 } }, // amber rings
        { kind: 'circle', x: 5, y: -1, r: 3.6, fill: { color: 0xd9a441 } },
        { kind: 'circle', x: -2, y: -1, r: 2.2, fill: { color: 0x241f1a } },
        { kind: 'circle', x: 5, y: -1, r: 2.2, fill: { color: 0x241f1a } },
      ] },
    { id: 'tuftL', parent: 'head', x: -9, y: -9, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q -3 -6 1 -8 Q 3 -3 3 2 Z', fill: { color: TAWNY_DARK } }] },
    { id: 'tuftR', parent: 'head', x: 6, y: -10, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q 0 -6 4 -8 Q 5 -2 4 2 Z', fill: { color: TAWNY } }] },
    { id: 'beak', parent: 'head', x: 1.5, y: 2.5, z: 1,
      shapes: [{ kind: 'path', d: 'M -2 0 Q 0 5 2 0 Z', fill: { color: 0x6b5636 } }] },
  ],
  stages: {
    baby: { scale: 0.5, partScale: { head: { x: 1.25, y: 1.25 }, tuftL: { x: 0.4, y: 0.4 }, tuftR: { x: 0.4, y: 0.4 } }, tint: 0xd9cdb8 },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xcac4bd },
  },
  clips: {
    idle: {
      durationMs: 3000, // the slow owlish head-turn
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.3 }, { t: 0.45, v: -0.3 }, { t: 0.6, v: 0.25 }, { t: 0.8, v: 0.25 }, { t: 1, v: 0 }] },
        { partId: 'body', sy: [{ t: 0, v: 1 }, { t: 0.5, v: 0.985 }, { t: 1, v: 1 }] },
      ],
    },
    walk: {
      durationMs: 460,
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -4 }, { t: 1, v: 0 }], rot: [{ t: 0, v: 0.06 }, { t: 0.5, v: -0.06 }, { t: 1, v: 0.06 }] },
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.15 }, { t: 1, v: 0 }] },
      ],
    },
    sleep: {
      durationMs: 4000, // daytime roost
      tracks: [
        { partId: 'head', py: [{ t: 0, v: 5 }, { t: 1, v: 5 }], sy: [{ t: 0, v: 0.9 }, { t: 1, v: 0.9 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.92 }, { t: 1, v: 0.95 }] },
      ],
    },
    eat: {
      durationMs: 700,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.6 }, { t: 0.5, v: 0.6 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.1 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1000, // bobbing display
      tracks: [
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -3 }, { t: 0.5, v: 0 }, { t: 0.75, v: -3 }, { t: 1, v: 0 }] },
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.35 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 2: Create `src/rigs/dodoRig.ts`:**

```ts
/**
 * The dodo rig: plump blue-grey wanderer with a grand hooked beak, tiny
 * hopeful winglet, and a puff of tail plumes. Side view facing +x.
 */
import type { CreatureRig } from './format';

const GREY = 0x9aa0a8;
const GREY_LIGHT = 0xbcc2c8;
const GREY_DARK = 0x848b94;
const BEAK = 0xc9b06a;

export const dodoRig: CreatureRig = {
  species: 'dodo',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 22, ry: 6.5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'legB', parent: null, x: -5, y: 0, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: -11, width: 3.6, fill: { color: 0xd9b13f } }] },
    { id: 'legF', parent: null, x: 4, y: 0, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: -11, width: 3.6, fill: { color: 0xd9b13f } }] },
    { id: 'body', parent: null, x: 0, y: -24, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 20, ry: 15, fill: { color: GREY } },
        { kind: 'ellipse', x: 5, y: 5, rx: 12, ry: 9, fill: { color: GREY_LIGHT } },
      ] },
    { id: 'tailPlume', parent: 'body', x: -17, y: -7, z: -1,
      shapes: [
        { kind: 'circle', x: -3, y: -2, r: 5, fill: { color: 0xd8d3c4 } },
        { kind: 'circle', x: -7, y: 1, r: 4, fill: { color: 0xcfc9b8 } },
        { kind: 'circle', x: -2, y: 3, r: 3.6, fill: { color: 0xd8d3c4 } },
      ] },
    { id: 'winglet', parent: 'body', x: -3, y: 0, z: 1,
      shapes: [{ kind: 'ellipse', x: -1, y: 2, rx: 6, ry: 4, fill: { color: GREY_DARK } }] },
    { id: 'head', parent: 'body', x: 15, y: -16, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 10, fill: { color: 0x8d939c } },
        { kind: 'ellipse', x: 4, y: -1, rx: 5, ry: 4, fill: { color: 0xd6c9a8 } }, // bare face
        { kind: 'circle', x: 2, y: -3, r: 2.2, fill: { color: 0x2a2622 } },
      ] },
    { id: 'beak', parent: 'head', x: 8, y: -1, z: 1,
      shapes: [
        { kind: 'path', d: 'M 0 -3 L 11 -2.5 Q 15 0 11 3.5 L 0 4 Z', fill: { color: BEAK } },
        { kind: 'circle', x: 12, y: 0.5, r: 2.2, fill: { color: 0x8a7440 } }, // hooked tip
      ] },
  ],
  stages: {
    baby: { scale: 0.5, partScale: { head: { x: 1.3, y: 1.3 }, beak: { x: 0.6, y: 0.6 }, tailPlume: { x: 0.5, y: 0.5 } }, tint: 0xcfd2c9 },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xc7c9cd },
  },
  clips: {
    idle: {
      durationMs: 2400,
      tracks: [
        { partId: 'tailPlume', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0 }, { t: 0.5, v: 0.25 }, { t: 0.62, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.12 }, { t: 0.55, v: -0.1 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 680, // the famous waddle
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0.15 }, { t: 0.5, v: -0.15 }, { t: 1, v: 0.15 }],
          py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: -0.08 }, { t: 0.5, v: 0.08 }, { t: 1, v: -0.08 }] },
        { partId: 'tailPlume', rot: [{ t: 0, v: -0.15 }, { t: 0.5, v: 0.15 }, { t: 1, v: -0.15 }] },
      ],
    },
    sleep: {
      durationMs: 3800,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: -0.5 }, { t: 1, v: -0.5 }], px: [{ t: 0, v: -5 }, { t: 1, v: -5 }], py: [{ t: 0, v: 5 }, { t: 1, v: 5 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.94 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.94 }] },
      ],
    },
    eat: {
      durationMs: 760,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.7 }, { t: 0.5, v: 0.7 }, { t: 0.68, v: 0 }, { t: 0.82, v: 0.35 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.12 }, { t: 0.65, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 950, // happy little winglet flaps
      tracks: [
        { partId: 'winglet', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.6 }, { t: 0.4, v: 0 }, { t: 0.6, v: -0.6 }, { t: 0.8, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2.5 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2.5 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 3: Register both** in `allRigs.ts`.
- [ ] **Step 4: Run tests** — `npx vitest run tests/rigs.test.ts` PASS; `npm run build` clean.
- [ ] **Step 5: Commit** — `feat: owl and dodo rigs`

---

### Task 11: Phoenix rig + rig-per-species completeness check

**Files:**
- Create: `src/rigs/phoenixRig.ts`
- Modify: `src/rigs/allRigs.ts`, `tests/rigs.test.ts` (add completeness test)

- [ ] **Step 1: Add the completeness test** to `tests/rigs.test.ts`:

```ts
import { SPECIES } from '../src/sim/species';
// ...
describe('rig coverage', () => {
  it('every species has a rig', () => {
    const rigged = new Set(ALL_RIGS.map((r) => r.species));
    for (const id of Object.keys(SPECIES)) expect(rigged.has(id as never)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — phoenix missing.
- [ ] **Step 3: Create `src/rigs/phoenixRig.ts`:**

```ts
/**
 * The phoenix rig: a crane-elegant firebird — warm gold body, flame wing,
 * long trailing ember plumes, a little flame crest. Elders don't silver;
 * they glow brighter as their rebirth nears. Side view facing +x.
 */
import type { CreatureRig } from './format';

const GOLD = 0xe8a84c;
const GOLD_LIGHT = 0xf4c56a;
const FLAME = 0xd96b35;
const EMBER = 0xf4d03f;

export const phoenixRig: CreatureRig = {
  species: 'phoenix',
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 26, ry: 8, fill: { color: 0xffb36b, alpha: 0.3 } }] }, // warm glow, not shade
    { id: 'legB', parent: null, x: -4, y: 0, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: -16, width: 2.2, fill: { color: 0xc98a3c } }] },
    { id: 'legF', parent: null, x: 4, y: 0, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: -16, width: 2.2, fill: { color: 0xc98a3c } }] },
    { id: 'body', parent: null, x: 0, y: -34, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 17, ry: 12, fill: { color: GOLD } },
        { kind: 'ellipse', x: 6, y: 4, rx: 10, ry: 7, fill: { color: GOLD_LIGHT } },
      ] },
    { id: 'plumeFar', parent: 'body', x: -15, y: 2, z: -2,
      shapes: [
        { kind: 'path', d: 'M 0 0 Q -28 10 -46 4 Q -32 14 -14 10 Z', fill: { color: FLAME, alpha: 0.8 } },
        { kind: 'circle', x: -44, y: 5, r: 3, fill: { color: EMBER, alpha: 0.9 } },
      ] },
    { id: 'plumeNear', parent: 'body', x: -13, y: -2, z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 0 Q -22 4 -36 -2 Q -24 8 -10 8 Z', fill: { color: 0xe89a3c, alpha: 0.9 } },
        { kind: 'circle', x: -34, y: -1, r: 2.6, fill: { color: EMBER } },
      ] },
    { id: 'wing', parent: 'body', x: -4, y: -3, z: 1,
      shapes: [
        { kind: 'ellipse', x: -3, y: 3, rx: 11, ry: 8, fill: { color: FLAME } },
        { kind: 'ellipse', x: -6, y: 5, rx: 6, ry: 4, fill: { color: EMBER, alpha: 0.6 } },
      ] },
    { id: 'neck', parent: 'body', x: 12, y: -7, z: 2,
      shapes: [{ kind: 'ellipse', x: 3, y: -12, rx: 6, ry: 14, fill: { color: GOLD } }] },
    { id: 'head', parent: 'neck', x: 4, y: -24, z: 1,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 7.5, fill: { color: 0xf0b656 } },
        { kind: 'circle', x: 3, y: -1.5, r: 1.9, fill: { color: 0x51321a } },
      ] },
    { id: 'crest', parent: 'head', x: -1, y: -6, z: -1,
      shapes: [{ kind: 'path', d: 'M -2 0 Q 0 -12 4 -4 Q 6 -14 9 -2 Z', fill: { color: FLAME } }] },
    { id: 'beak', parent: 'head', x: 7, y: 0.5, z: 1,
      shapes: [{ kind: 'path', d: 'M 0 -2 L 8 0.5 L 0 2.5 Z', fill: { color: 0xc9822f } }] },
  ],
  stages: {
    baby: {
      scale: 0.45, // an ember chick
      partScale: { head: { x: 1.35, y: 1.35 }, plumeFar: { x: 0.3, y: 0.6 }, plumeNear: { x: 0.3, y: 0.6 }, crest: { x: 0.7, y: 0.7 } },
      tint: 0xf5d9a8,
    },
    juvenile: { scale: 0.75, partScale: { head: { x: 1.1, y: 1.1 }, plumeFar: { x: 0.7, y: 0.9 }, plumeNear: { x: 0.7, y: 0.9 } } },
    adult: { scale: 1 },
    elder: { scale: 1, tint: 0xfff0d0 }, // burning brighter, not fading
  },
  clips: {
    idle: {
      durationMs: 2800, // plumes breathe like slow flame
      tracks: [
        { partId: 'plumeFar', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.14 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.1 }, { t: 1, v: 0 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.12 }, { t: 0.6, v: 0.1 }, { t: 1, v: 0 }] },
        { partId: 'crest', sy: [{ t: 0, v: 1 }, { t: 0.5, v: 1.15 }, { t: 1, v: 1 }] },
      ],
    },
    walk: {
      durationMs: 700, // stately strides
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -3 }, { t: 1, v: 0 }] },
        { partId: 'plumeFar', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.1 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: -0.08 }, { t: 0.5, v: 0.1 }, { t: 1, v: -0.08 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0.04 }, { t: 0.5, v: -0.04 }, { t: 1, v: 0.04 }] },
      ],
    },
    sleep: {
      durationMs: 4200, // banked embers
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: -0.55 }, { t: 1, v: -0.55 }], py: [{ t: 0, v: 6 }, { t: 1, v: 6 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.91 }, { t: 1, v: 0.95 }] },
        { partId: 'crest', sy: [{ t: 0, v: 0.8 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.8 }] },
      ],
    },
    eat: {
      durationMs: 900,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.85 }, { t: 0.55, v: 0.85 }, { t: 0.8, v: 0.2 }, { t: 1, v: 0 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0.15 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1200, // a courtly wing-and-plume flare
      tracks: [
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.25, v: -0.7 }, { t: 0.5, v: -0.5 }, { t: 0.75, v: -0.7 }, { t: 1, v: 0 }] },
        { partId: 'plumeFar', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.3, v: -2 }, { t: 0.6, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
```

- [ ] **Step 4: Register** in `allRigs.ts`; run `npx vitest run tests/rigs.test.ts` PASS (coverage test now green); `npm run build` clean.
- [ ] **Step 5: Commit** — `feat: phoenix rig — the valley's firebird, complete rig coverage`

---

### Task 12: Renderer wiring — rigs live, new home visuals, phoenix embers

**Files:**
- Modify: `src/render/Renderer.ts`

**Interfaces:**
- Consumes: `ALL_RIGS`, new `HomeKind`s, `Memorial.species`.
- Produces: every species renders its own rig at all LOD tiers; every home kind has a painterly marker; phoenix memorials glow as embers.

- [ ] **Step 1: Swap RIGS to the registry.** Replace the `rabbitRig`/`robinRig` imports and the `RIGS` literal with:

```ts
import { ALL_RIGS } from '../rigs/allRigs';

const RIGS: Partial<Record<SpeciesId, CreatureRig>> = Object.fromEntries(
  ALL_RIGS.map((r) => [r.species, r]),
);

const FALLBACK_RIG = ALL_RIGS[0] as CreatureRig;

function rigFor(species: SpeciesId): CreatureRig {
  return RIGS[species] ?? FALLBACK_RIG;
}
```

- [ ] **Step 2: Per-species label heights.** Replace the ternary in `positionLabel` with:

```ts
const LABEL_HEIGHT: Record<SpeciesId, number> = {
  rabbit: -70, robin: -46, deer: -120, duck: -52,
  koi: -34, owl: -70, dodo: -70, phoenix: -110,
};
// in positionLabel:
view.label.position.set(0, LABEL_HEIGHT[view.species] * scale);
```

- [ ] **Step 3: Home visuals.** In `syncHomes`, replace the `if (home.kind === 'burrow') ... else ...` with a `switch (home.kind)`. Keep the existing burrow and treeNest drawings verbatim, and add:

```ts
      case 'reedNest': { // grassy bowl tucked in the reeds
        g.ellipse(home.pos.x, home.pos.y, 22, 10).fill(0xb5a068);
        g.ellipse(home.pos.x, home.pos.y - 2, 16, 7).fill(0x8f7c4e);
        if (fam?.phase === 'expecting') {
          g.ellipse(home.pos.x - 4, home.pos.y - 3, 4.5, 5.5).fill(0xe8e2ce);
          g.ellipse(home.pos.x + 4, home.pos.y - 4, 4.5, 5.5).fill(0xefe9d6);
        }
        break;
      }
      case 'lilyPatch': { // koi spawning bed among the pads
        g.circle(home.pos.x - 10, home.pos.y, 16).fill({ color: 0x5f9451, alpha: 0.95 });
        g.circle(home.pos.x + 14, home.pos.y + 8, 12).fill({ color: 0x6da05a, alpha: 0.9 });
        g.circle(home.pos.x + 4, home.pos.y - 10, 5).fill({ color: 0xf2d8e4 }); // blossom
        if (fam?.phase === 'expecting') {
          for (let i = 0; i < 5; i++) { // roe: tiny amber beads
            g.circle(home.pos.x - 14 + i * 6, home.pos.y + 12, 2).fill({ color: 0xf0c060, alpha: 0.9 });
          }
        }
        break;
      }
      case 'treeHollow': { // a cozy dark hollow in an old trunk
        g.roundRect(home.pos.x - 12, home.pos.y - 30, 24, 46, 10).fill(0x6b4e38);
        g.ellipse(home.pos.x, home.pos.y - 10, 8, 11).fill(0x2e2018);
        if (fam?.phase === 'expecting') {
          g.ellipse(home.pos.x - 2, home.pos.y - 5, 3.5, 4.5).fill(0xf3efe4);
          g.ellipse(home.pos.x + 3, home.pos.y - 6, 3.5, 4.5).fill(0xeae5d8);
        }
        break;
      }
      case 'glade': { // flattened-grass deer bed
        g.ellipse(home.pos.x, home.pos.y, 46, 22).fill({ color: 0xa8bd7e, alpha: 0.7 });
        g.ellipse(home.pos.x, home.pos.y, 32, 14).fill({ color: 0xc0cf94, alpha: 0.8 });
        break;
      }
      case 'groundNest': { // dodo's ring of twigs on the forest floor
        g.ellipse(home.pos.x, home.pos.y, 24, 12).fill(0x8a6f4d);
        g.ellipse(home.pos.x, home.pos.y, 16, 8).fill(0xa89066);
        if (fam?.phase === 'expecting') {
          g.ellipse(home.pos.x, home.pos.y - 2, 6, 7).fill(0xf1ead6); // one grand egg
        }
        break;
      }
      case 'groveNest': { // the phoenix nest: warm stones, faint glow
        g.ellipse(home.pos.x, home.pos.y + 4, 30, 12).fill({ color: 0xffdda6, alpha: 0.35 });
        g.ellipse(home.pos.x, home.pos.y, 20, 9).fill(0xb59a72);
        g.ellipse(home.pos.x, home.pos.y - 2, 13, 6).fill(0x8f7752);
        if (fam?.phase === 'expecting') {
          g.ellipse(home.pos.x, home.pos.y - 3, 5, 6.5).fill(0xf4d03f); // the golden egg
          g.ellipse(home.pos.x, home.pos.y - 3, 8, 9).fill({ color: 0xffb36b, alpha: 0.3 });
        }
        break;
      }
```

- [ ] **Step 4: Phoenix ember memorials.** In `syncMemorials`, branch on species:

```ts
      if (m.species === 'phoenix') {
        // Soft embers, not flowers — the site of a rebirth.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + m.tick * 0.13;
          const r = 5 + ((m.tick + i * 29) % 10);
          g.circle(m.pos.x + Math.cos(a) * r, m.pos.y + Math.sin(a) * r * 0.7, 2.4).fill({
            color: i % 2 === 0 ? 0xf4d03f : 0xd96b35,
            alpha: 0.85,
          });
        }
        g.circle(m.pos.x, m.pos.y, 3).fill({ color: 0xffdda6, alpha: 0.9 });
        continue;
      }
```

- [ ] **Step 5: Verify** — `npm run build` clean; `npx vitest run` green; `npm run dev` and eyeball at 64x: koi glide in the pond, ducks waddle ashore, owls wake at dusk, the deer herd grazes together, dodos waddle by their ground nests, the phoenix pair keeps the grove. Fix any visual glitches (coordinates only).
- [ ] **Step 6: Commit** — `feat: all eight species rendered — home markers for every kind, phoenix ember memorials`

---

### Task 13: Milestone close-out

**Files:**
- Modify: `CLAUDE.md` (Current status section)

- [ ] **Step 1: Full verification** — run and confirm ALL of: `npm test` green, `npm run lint` clean, `npm run build` clean. Paste outputs into the session (verification-before-completion).
- [ ] **Step 2: Update `CLAUDE.md`** Current status: mark M5 done (all 8 species, swimming, nocturnal owls, herd cohesion, wanderers, phoenix rebirth, balance suite); set Next to M6 sound.
- [ ] **Step 3: Commit and push** — `feat: M5 complete — all eight species live in the valley` then push to main (CI deploys to GitHub Pages).
- [ ] **Step 4: Hand the user the review URL** (https://feshalnaguji.github.io/beastoria/) with a short what-to-look-for list (dusk owl/robin handover, pond life, herd, grove). The user reviews in the browser before M6 begins.

## Self-review notes

- Spec coverage: swim ✓ (T2), nocturnal owl ✓ (T1 data + T3 test), deer herd ✓ (T4), dodo wanderers ✓ (T5), phoenix rebirth + exactly-one-family ✓ (T6), balance property tests ✓ (T7, scaled 30d×6+100d×1 vs spec's 100d×10 for CI budget — noted in test header), 8 rigs ✓ (T8–T11 + existing 2), renderer/home/LOD wiring ✓ (T12). Egg life-stage remains abstract (clutch) as in M4 — consistent with existing architecture; spec's "egg renders species egg shape" is covered by per-home egg drawings in T12.
- Type consistency: `Medium` defined once in valley.ts (T1), consumed by species/movement/behaviors (T2) and population (T5). `canOccupy(medium, p)` used in T1 tests, T2 movement/behaviors. `wandererArrived`/`reborn` added to events in T5 (T6 consumes `reborn`). `ALL_RIGS` created T8, consumed T11 test + T12 renderer. `rigFor()` introduced T1 (fallback), retargeted T12 (registry).
- Ordering hazard: rig parts must list parents before children (RigRenderer builds sequentially) — guarded by the T8 integrity test.
