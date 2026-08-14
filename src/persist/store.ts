/**
 * idb-keyval wrapper. Failures degrade to warnings — a blocked IndexedDB
 * (privacy mode) must never take the valley down.
 */
import { del, get, set } from 'idb-keyval';
import { migrate } from './migrations';
import { SAVE_VERSION, type SaveFile } from './schema';
import type { WorldState } from '../sim/state';

const SAVE_KEY = 'beastoria.save';

export async function saveWorld(state: WorldState, nowMs: number): Promise<void> {
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAtEpochMs: nowMs,
    // Structured clone via JSON keeps the stored value detached from the live sim.
    sim: JSON.parse(JSON.stringify(state)) as WorldState,
  };
  try {
    await set(SAVE_KEY, file);
  } catch (err) {
    console.warn('[persist] save failed:', err);
  }
}

export async function loadSave(): Promise<SaveFile | null> {
  try {
    return migrate(await get(SAVE_KEY));
  } catch (err) {
    console.warn('[persist] load failed:', err);
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
