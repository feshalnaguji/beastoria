/**
 * Ordered migration chain: v(n) → v(n+1). Each step is a pure function.
 * migrate() walks unknown data up to SAVE_VERSION or returns null if the
 * data is unrecognizable — a bad save must never crash the game.
 */
import { SAVE_VERSION, type SaveFile } from './schema';
import type { WorldState } from '../sim/state';

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
