/**
 * Ordered migration chain: v(n) → v(n+1). Each step is a pure function.
 * migrate() walks unknown data up to SAVE_VERSION or returns null if the
 * data is unrecognizable — a bad save must never crash the game.
 */
import { SAVE_VERSION, type SaveFile } from './schema';
import type { HomeKind, Vec2, WorldState } from '../sim/state';
import { DREY_SITES, FROG_SPAWN_CLUMPS, TURTLE_SAND_NESTS, SHADE_SCRAPES } from '../sim/valley';

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
