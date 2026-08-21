/**
 * Ordered migration chain: v(n) → v(n+1). Each step is a pure function.
 * migrate() walks unknown data up to SAVE_VERSION or returns null if the
 * data is unrecognizable — a bad save must never crash the game.
 */
import { SAVE_VERSION, type SaveFile } from './schema';
import type { HomeKind, Vec2, WorldState } from '../sim/state';
import { DREY_SITES, FROG_SPAWN_CLUMPS, TURTLE_SAND_NESTS, SHADE_SCRAPES } from '../sim/valley';
import { MOURNING_GATHER_MIN_TICKS } from '../sim/behaviors';

/**
 * M10 added three home kinds (drey/spawnClump/sandNest) but SAVE_VERSION
 * didn't bump — createWorld() is the only place that ever seeds state.homes
 * from these static site lists, so a save made before M10 shipped has zero
 * homes of these kinds, forever; loading it does not top them up. Meanwhile
 * squirrel/frog/turtle are wandersIn species (species.ts) with population
 * floors, so the regulator brings them into any loaded world regardless of
 * save age — they pair, enter 'nesting', and claimHome (family.ts) finds no
 * home of the matching kind and sits stuck forever. Defensive top-up below
 * appends the missing static sites, same as the lastWandererTick defaulting
 * further down: pure data placement, zero RNG draws, so it can't perturb
 * replay determinism or any seeded fixture/test baseline.
 *
 * M11 added a fourth (shadeScrape, for the kangaroo) the same way, and this
 * regression shipped for real in M10 (commit df20058) before being caught by
 * a test — see tests/persist.test.ts's dedicated shadeScrape top-up case.
 */
const NEW_HOME_SITE_GROUPS: [HomeKind, Vec2[]][] = [
  ['drey', DREY_SITES],
  ['spawnClump', FROG_SPAWN_CLUMPS],
  ['sandNest', TURTLE_SAND_NESTS],
  ['shadeScrape', SHADE_SCRAPES],
];

/** v(n) → v(n+1) steps, indexed by source version. Empty until v2 exists. */
const STEPS: Record<number, (save: SaveFile) => SaveFile> = {};

export function migrate(raw: unknown): SaveFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SaveFile>;
  if (
    typeof candidate.version !== 'number' ||
    candidate.version < 1 ||
    candidate.version > SAVE_VERSION ||
    typeof candidate.savedAtEpochMs !== 'number' ||
    typeof candidate.sim !== 'object' ||
    candidate.sim === null ||
    !isValidWorldShape(candidate.sim)
  ) {
    return null;
  }
  let save = candidate as SaveFile;
  while (save.version < SAVE_VERSION) {
    const step = STEPS[save.version];
    if (!step) return null;
    save = step(save);
  }
  // Defensive defaulting for fields added after older hand-rolled/tampered
  // saves were written — never reject on this alone.
  if (typeof save.sim.lastWandererTick !== 'object' || save.sim.lastWandererTick === null) {
    save.sim.lastWandererTick = {};
  }
  // M12 pouch-carry (Creature.carriedBy). Same defensive shape as the
  // lastWandererTick default above — a new optional field, so SAVE_VERSION
  // stays 1 and the STEPS chain stays empty. Two jobs: normalise a missing
  // or non-numeric value to null (every pre-M12 save), and cut any link
  // naming an id that is not in this save's `creatures` — the
  // orphaned-reference guard. A dangling id would leave a joey with its
  // behavior selection switched off and no carrier to derive a position
  // from: frozen where it stood, forever. Pure data, zero RNG draws, and
  // idempotent across repeated migrate() calls.
  const liveCreatureIds = new Set(save.sim.creatures.map((c) => c.id));
  for (const c of save.sim.creatures) {
    if (
      typeof c.carriedBy !== 'number' ||
      c.carriedBy === c.id ||
      !liveCreatureIds.has(c.carriedBy)
    ) {
      c.carriedBy = null;
    }
  }
  // M13 defensive normalization: a creature latched in a non-vigil 'gather'
  // activity before the leash bug was fixed would remain frozen forever even
  // after loading into fixed code, because the fixed leash logic only
  // re-evaluates *babies inside a rearing family* — a latched juvenile or
  // family-less adult would otherwise stay in 'gather' indefinitely. Only
  // nesting-phase gathers (minTicks >= 30, not MOURNING_GATHER_MIN_TICKS, so
  // minTicks < MOURNING_GATHER_MIN_TICKS catches all non-vigil types including
  // nest-building and feeding-hold anchors) that have ticks near or exceeding
  // 500 are normalized, assuming creatures fresher than that have not yet hit
  // pathological stuck states. The mourning vigil 'gather'
  // (minTicks >= MOURNING_GATHER_MIN_TICKS) is never touched. Same defensive
  // data normalization shape as carriedBy above: pure data placement, zero RNG
  // draws, idempotent across repeated migrate() calls.
  for (const c of save.sim.creatures) {
    if (
      c.activity?.id === 'gather' &&
      typeof c.activity.minTicks === 'number' &&
      typeof c.activity.ticks === 'number' &&
      c.activity.minTicks < MOURNING_GATHER_MIN_TICKS &&
      c.activity.ticks >= 500
    ) {
      c.activity = { id: 'idle', ticks: 0, minTicks: 0 };
    }
  }
  // M10 defensive top-up (see NEW_HOME_SITE_GROUPS above): if a save has no
  // home of a given new kind at all, seed it from the same static sites
  // createWorld() would have used. Kind-presence (not exact count) is the
  // check, so this is idempotent across repeated migrate() calls on an
  // already-topped-up save.
  const presentKinds = new Set(save.sim.homes.map((h) => h.kind));
  for (const [kind, sites] of NEW_HOME_SITE_GROUPS) {
    if (presentKinds.has(kind)) continue;
    for (const pos of sites) {
      save.sim.homes.push({ id: save.sim.nextId++, kind, pos: { ...pos }, familyId: null });
    }
  }
  return save;
}

/**
 * Deep-enough shape check on the sim body so a bad save is rejected here,
 * never crashes mid-tick (e.g. rng.ts indexing into an undefined RngState).
 */
function isValidWorldShape(sim: object): sim is WorldState {
  const s = sim as Partial<WorldState>;
  return (
    typeof s.tick === 'number' &&
    typeof s.nextId === 'number' &&
    Array.isArray(s.rng) &&
    s.rng.length === 4 &&
    s.rng.every((n) => typeof n === 'number') &&
    Array.isArray(s.creatures) &&
    Array.isArray(s.families) &&
    Array.isArray(s.homes) &&
    Array.isArray(s.memorials) &&
    Array.isArray(s.eventLog)
  );
}
