/**
 * Real-calendar seasons and moons (G4). Visual only: the sim never sees the
 * real date. Hemisphere is guessed from the device's timezone setting — no
 * location permission, nothing leaves the device.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Hemisphere = 'north' | 'south';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

const SOUTHERN_TZ = new RegExp(
  [
    '^(Australia|Antarctica)/',
    '^Pacific/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Norfolk)',
    '^America/(Argentina/|Santiago|Sao_Paulo|Montevideo|Asuncion|La_Paz|Lima|Punta_Arenas|Campo_Grande|Cuiaba)',
    '^Africa/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi)',
    '^Indian/(Antananarivo|Mauritius|Reunion|Mayotte)',
    '^Atlantic/(Stanley|South_Georgia)',
  ].join('|'),
);

/** Unknown or empty timezones read as the northern hemisphere (most of the world's people). */
export function hemisphereFor(timeZone: string): Hemisphere {
  return SOUTHERN_TZ.test(timeZone) ? 'south' : 'north';
}

/** Meteorological seasons: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter (north). */
export function seasonFor(date: Date, hemisphere: Hemisphere): Season {
  const m = (date.getMonth() + (hemisphere === 'south' ? 6 : 0)) % 12;
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export const SYNODIC_DAYS = 29.530588853;
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);
const FULL_MOON_WINDOW_DAYS = 1.25;

/** 0 = new moon, 0.5 = full moon (mean lunation; within about half a day of the real moon). */
export function moonPhase(date: Date): number {
  const lunations = (date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000 / SYNODIC_DAYS;
  return lunations - Math.floor(lunations);
}

export function isFullMoon(date: Date): boolean {
  return Math.abs(moonPhase(date) - 0.5) * SYNODIC_DAYS <= FULL_MOON_WINDOW_DAYS;
}

export const SEASON_ICON: Record<Season, string> = {
  spring: '🌸',
  summer: '🌻',
  autumn: '🍂',
  winter: '❄️',
};

/** Shown once when a visit finds the season has changed since the last one. */
export const SEASON_WELCOME: Record<Season, { title: string; line: string }> = {
  spring: { title: 'Spring has come to the valley 🌸', line: 'Blossom is out and the meadow is fresh and green.' },
  summer: { title: 'Summer has come to the valley 🌻', line: 'Long warm days, and more fireflies at night.' },
  autumn: { title: 'Autumn has come to the valley 🍂', line: 'The trees are turning gold and russet.' },
  winter: { title: 'Winter has come to the valley ❄️', line: 'A light frost sparkles on the meadow.' },
};

/** Unlisted testing overrides: `?season=autumn`, `?moon=full`. */
export function seasonOverrides(search: string): { season: Season | null; fullMoon: boolean } {
  const params = new URLSearchParams(search);
  const s = params.get('season');
  return {
    season: s !== null && (SEASONS as readonly string[]).includes(s) ? (s as Season) : null,
    fullMoon: params.get('moon') === 'full',
  };
}
