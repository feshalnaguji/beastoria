/**
 * SaveFile: the versioned envelope around WorldState (spec §4.6).
 * Save = JSON passthrough of the sim's POJO state; version bumps require
 * a migrations.ts entry + frozen fixture test, never casual edits.
 */
import type { WorldState } from '../sim/state';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  savedAtEpochMs: number;
  sim: WorldState;
}
