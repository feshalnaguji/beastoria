/**
 * Per-frame audibility (spec §4.5): world view = beds prominent + faint calls;
 * close view = nearby creatures forward. Zone beds: water near the pond,
 * ember glow near the grove. Beds crossfade with the day phase.
 */
import type { Clock } from '../sim/clock';
import { GROVE, POND } from '../sim/valley';
import type { Vec2, WorldState } from '../sim/state';
import type { BedName } from './manifest';

export interface ViewInfo {
  x: number;
  y: number;
  zoom: number;
}

export interface Mix {
  beds: Record<BedName, number>;
  callGainDb: (pos: Vec2) => number;
}

export function computeMix(clock: Clock, view: ViewInfo, _state: WorldState): Mix {
  const { phase, light } = clock;
  const closeness = Math.min(1, Math.max(0, (view.zoom - 0.25) / 1.0)); // 0 world … 1 close

  const nearPond = proximity(view, POND.x, POND.y, 1400);
  const nearGrove = proximity(view, GROVE.x, GROVE.y, 1100);

  const beds: Record<BedName, number> = {
    dawnChorus: phase === 'dawn' ? 0.9 : 0,
    dayMeadow: phase === 'day' ? 0.7 : phase === 'dusk' ? 0.35 : 0,
    nightCrickets: phase === 'night' ? 0.8 : phase === 'dusk' ? 0.4 : 0,
    waterLap: nearPond * (0.25 + 0.55 * closeness),
    windSoft: 0.25 + 0.15 * (1 - light) - 0.1 * closeness,
    emberGlow: nearGrove * (0.2 + 0.5 * closeness) * (phase === 'night' || phase === 'dusk' ? 1.4 : 0.8),
  };
  for (const k of Object.keys(beds) as BedName[]) beds[k] = clamp01(beds[k]);

  const callGainDb = (pos: Vec2): number => {
    const d = Math.hypot(pos.x - view.x, pos.y - view.y);
    // World view: everything is a distant murmur. Close view: framed +6dB, far −9dB and below.
    if (closeness < 0.15) return d < 1600 ? -14 : -22;
    const framed = d < 420 / Math.max(0.4, view.zoom);
    return framed ? 6 * closeness : Math.max(-24, -9 - d / 260);
  };

  return { beds, callGainDb };
}

function proximity(view: ViewInfo, x: number, y: number, radius: number): number {
  return clamp01(1 - Math.hypot(view.x - x, view.y - y) / radius);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
