/**
 * SaveFile: the versioned envelope around WorldState (spec §4.6).
 * Save = JSON passthrough of the sim's POJO state; version bumps require
 * a migrations.ts entry + frozen fixture test, never casual edits.
 */
import type { WorldState } from '../sim/state';

export const SAVE_VERSION = 2;
/** Every save written before v2 was created from this hardcoded seed. */
export const LEGACY_SEED = 1234;

export interface SaveNames {
  creatures: Record<number, string>;
  families: Record<number, string>;
}
export const emptyNames = (): SaveNames => ({ creatures: {}, families: {} });

export interface SaveFile {
  version: number;
  savedAtEpochMs: number;
  /** The createWorld() seed this valley was born from — what a share link carries. */
  seed: number;
  /** Player-given names, local-only (spec: never in links or postcards). */
  names: SaveNames;
  sim: WorldState;
}
