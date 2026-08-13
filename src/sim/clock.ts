/**
 * Day/night clock: a pure function of tick count. No wall-clock time.
 * 1 in-game day = 4 real minutes = 2400 ticks at 10 tps.
 */
export const TICKS_PER_DAY = 2400;

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Phase boundaries as fractions of a day. */
const DAWN_END = 0.08;
const DAY_END = 0.55;
const DUSK_END = 0.63;

export interface Clock {
  day: number;
  /** Fraction of the current day, 0..1. */
  dayT: number;
  phase: DayPhase;
  /** Progress through the current phase, 0..1. */
  phaseT: number;
  /** Ambient light level, 0 (deep night) .. 1 (midday). */
  light: number;
}

export function getClock(tick: number): Clock {
  const day = Math.floor(tick / TICKS_PER_DAY);
  const dayT = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;

  let phase: DayPhase;
  let phaseT: number;
  if (dayT < DAWN_END) {
    phase = 'dawn';
    phaseT = dayT / DAWN_END;
  } else if (dayT < DAY_END) {
    phase = 'day';
    phaseT = (dayT - DAWN_END) / (DAY_END - DAWN_END);
  } else if (dayT < DUSK_END) {
    phase = 'dusk';
    phaseT = (dayT - DAY_END) / (DUSK_END - DAY_END);
  } else {
    phase = 'night';
    phaseT = (dayT - DUSK_END) / (1 - DUSK_END);
  }

  let light: number;
  switch (phase) {
    case 'dawn':
      light = smoothstep(phaseT);
      break;
    case 'day':
      light = 1;
      break;
    case 'dusk':
      light = 1 - smoothstep(phaseT);
      break;
    case 'night':
      light = 0;
      break;
  }

  return { day, dayT, phase, phaseT, light };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
