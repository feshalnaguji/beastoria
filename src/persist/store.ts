/**
 * idb-keyval wrapper. Failures degrade to warnings — a blocked IndexedDB
 * (privacy mode) must never take the valley down.
 */
import { del, get, set } from 'idb-keyval';
import { migrate } from './migrations';
import { SAVE_VERSION, type SaveFile } from './schema';
import type { WorldState } from '../sim/state';

const SAVE_KEY = 'beastoria.save';

// Reset-resurrection guard: location.reload() fires visibilitychange/pagehide
// on its way out, and those handlers call saveWorld — which would otherwise
// re-persist the very world clearSave() just deleted. DevPanel's reset
// handler calls suppressSaves() before clearSave()+reload() so every save
// attempt in that window is a no-op.
let suppressed = false;

/** Silence saveWorld until resumeSaves() is called. Call before clearSave()+reload(). */
export function suppressSaves(): void {
  suppressed = true;
}

/** Test/reset support: lift a suppressSaves() latch. */
export function resumeSaves(): void {
  suppressed = false;
}

let warnedSave = false;
let warnedLoad = false;

export async function saveWorld(state: WorldState, nowMs: number): Promise<void> {
  if (suppressed) return;
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAtEpochMs: nowMs,
    // Structured clone via JSON keeps the stored value detached from the live sim.
    sim: JSON.parse(JSON.stringify(state)) as WorldState,
  };
  try {
    await set(SAVE_KEY, file);
  } catch (err) {
    if (!warnedSave) {
      warnedSave = true;
      console.warn('[persist] save failed (further save failures will be silent):', err);
    }
  }
}

export async function loadSave(): Promise<SaveFile | null> {
  try {
    return migrate(await get(SAVE_KEY));
  } catch (err) {
    if (!warnedLoad) {
      warnedLoad = true;
      console.warn('[persist] load failed (further load failures will be silent):', err);
    }
    return null;
  }
}

export async function clearSave(): Promise<void> {
  try {
    await del(SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}
