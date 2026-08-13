/**
 * Species parameters as data. One entry in M1 (rabbit); grows to 8 in M5,
 * when this becomes the full SpeciesDef registry of the spec.
 */
import type { SpeciesId } from './state';

export interface SpeciesParams {
  /** World units per tick while moving. */
  speed: number;
  /** Active by day (true) or by night (false, e.g. owls in M5). */
  diurnal: boolean;
  /** Need growth per tick (need goes 0→1 in 1/rate ticks). */
  needRates: { hunger: number; rest: number; social: number };
  /** Need relief per tick while doing the matching activity. */
  eatRate: number;
  sleepRate: number;
  socialRate: number;
}

export const SPECIES: Record<SpeciesId, SpeciesParams> = {
  rabbit: {
    speed: 6,
    diurnal: true,
    needRates: {
      hunger: 1 / 1200, // fills in half a game day
      rest: 1 / 2400, // fills in a full waking day
      social: 1 / 1680, // fills in ~0.7 day
    },
    eatRate: 0.004, // a meal takes ~4 sim minutes once at food
    sleepRate: 0.003,
    socialRate: 0.006,
  },
};
