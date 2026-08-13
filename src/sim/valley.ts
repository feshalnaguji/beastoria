/**
 * The valley's geography — single source of truth, owned by the sim.
 * The renderer paints from this same data, so what you see IS the world.
 * Zones are soft ellipses; the map is authored open (no pathfinding needed).
 */
import type { Vec2 } from './state';

export interface EllipseZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Pond in the south-east. Water: land creatures steer around it. */
export const POND: EllipseZone = { x: 3100, y: 2300, rx: 550, ry: 400 };

/** Forest in the north-west. */
export const FOREST: EllipseZone = { x: 900, y: 800, rx: 700, ry: 650 };

/** Mountain grove in the north — home of the ancient tree. */
export const GROVE: EllipseZone = { x: 2300, y: 400, rx: 480, ry: 400 };

export type ZoneId = 'meadow' | 'pond' | 'forest' | 'grove';

export function inEllipse(p: Vec2, z: EllipseZone): boolean {
  const dx = (p.x - z.x) / z.rx;
  const dy = (p.y - z.y) / z.ry;
  return dx * dx + dy * dy <= 1;
}

export function isWater(p: Vec2): boolean {
  return inEllipse(p, POND);
}

export function zoneAt(p: Vec2): ZoneId {
  if (inEllipse(p, POND)) return 'pond';
  if (inEllipse(p, FOREST)) return 'forest';
  if (inEllipse(p, GROVE)) return 'grove';
  return 'meadow';
}
