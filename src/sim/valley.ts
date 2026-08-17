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

/** Lone meadow trees — drawn by the painter AND used as robin nest sites. */
export const LONE_TREES: Vec2[] = [
  { x: 2700, y: 1300 },
  { x: 1500, y: 2200 },
  { x: 900, y: 1900 },
];

/** Forest-edge trees that also carry nests. */
export const NEST_TREES: Vec2[] = [
  { x: 1450, y: 650 },
  { x: 1620, y: 1120 },
  { x: 760, y: 1560 },
];

/** Rabbit burrow sites in the open meadow. */
export const BURROW_SITES: Vec2[] = [
  { x: 1700, y: 1400 },
  { x: 2400, y: 1800 },
  { x: 1350, y: 1050 },
  { x: 2650, y: 1080 },
  { x: 2050, y: 2250 },
];

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

/** Duck nests tucked into the reeds on the pond's dry shore. */
export const REED_NESTS: Vec2[] = [
  { x: 2600, y: 2050 },
  { x: 3350, y: 1870 },
  { x: 2700, y: 2680 },
];

/** Koi spawning beds among the lily pads (inside the pond). */
export const LILY_PATCHES: Vec2[] = [
  { x: 2950, y: 2250 },
  { x: 3300, y: 2400 },
];

/** Old forest trees with owl hollows. */
export const HOLLOW_TREES: Vec2[] = [
  { x: 700, y: 600 },
  { x: 1150, y: 950 },
];

/** Sheltered meadow clearings where deer bed down. */
export const GLADES: Vec2[] = [
  { x: 2200, y: 1500 },
  { x: 1800, y: 1900 },
];

/** Dodo ground nests at the forest edge. */
export const GROUND_NESTS: Vec2[] = [
  { x: 1400, y: 1300 },
  { x: 600, y: 1200 },
];

/** The one nest at the ancient tree's roots — the phoenix's, always. */
export const GROVE_NEST: Vec2 = { x: 2300, y: 430 };

/** Squirrel dreys — twiggy balls woven high in the forest canopy (M10). */
export const DREY_SITES: Vec2[] = [
  { x: 850, y: 500 },
  { x: 550, y: 950 },
  { x: 1100, y: 650 },
];

/**
 * Frog spawn clumps laid among the reeds on the pond's shore band (M10).
 * Placed at their own compass points (not the lily beds' own coordinates —
 * review fix, see M10 task 3's justification table row 1): every site here
 * sits >=160 units from every other home site, old or new, so no two home
 * markers or family labels visibly intersect.
 */
export const FROG_SPAWN_CLUMPS: Vec2[] = [
  { x: 2947, y: 1854 },
  { x: 3642, y: 2537 },
  { x: 2479, y: 2388 },
];

/**
 * Turtle sand nests scooped into the pond's shore band (M10, review fix: see
 * FROG_SPAWN_CLUMPS above — re-placed for the same >=160-unit spacing rule).
 */
export const TURTLE_SAND_NESTS: Vec2[] = [
  { x: 3727, y: 2178 },
  { x: 3111, y: 2772 },
];

/**
 * Kangaroo shade scrapes — scraped dirt hollows under scrub, out on the open
 * meadow (M11). Each sits >=160 units from every other home site, old or
 * new, so no two home markers or family labels visibly intersect.
 */
export const SHADE_SCRAPES: Vec2[] = [
  { x: 1950, y: 1050 },
  { x: 3050, y: 1550 },
  { x: 1150, y: 2550 },
];

/**
 * How a creature relates to water (spec §4.3 walkability).
 * 'air' is the flying media: nowhere in the valley is off-limits in passing.
 * Where a flier may come to REST is its species' `landingMedium` instead.
 */
export type Medium = 'land' | 'water' | 'amphibious' | 'air';

export function canOccupy(medium: Medium, p: Vec2): boolean {
  if (medium === 'amphibious' || medium === 'air') return true;
  return medium === 'water' ? isWater(p) : !isWater(p);
}

/**
 * The nearest point `medium` can rest at — draw-free, so it never consumes or
 * reorders RNG and can be used to fix up any authored/derived point. Projects
 * radially (relative to the pond) out of, or into, the water.
 */
export function nearestRestable(medium: Medium, p: Vec2): Vec2 {
  if (canOccupy(medium, p)) return { x: p.x, y: p.y };
  const nx = (p.x - POND.x) / POND.rx;
  const ny = (p.y - POND.y) / POND.ry;
  const r = Math.hypot(nx, ny);
  const targetR = medium === 'water' ? 0.85 : 1.08;
  if (r === 0) {
    // Only dry-resting media can hit this (the pond centre is always water).
    return { x: POND.x, y: POND.y - POND.ry * targetR };
  }
  return {
    x: POND.x + (nx / r) * targetR * POND.rx,
    y: POND.y + (ny / r) * targetR * POND.ry,
  };
}

/**
 * The valley's larder. Foraging aims here instead of at random empty grass,
 * so the painted berry thickets, forest-edge grasses and pond reeds are the
 * places creatures are actually seen eating.
 *
 * Deterministic authored data (like POND itself): 12 grass/berry spots just
 * inside the forest and grove edges (ellipse ×0.98), 4 reed spots on the
 * pond's dry shore (ellipse ×1.10), and 3 open-meadow grass patches so the
 * meadow dwellers aren't commuting to the treeline for every meal. Every
 * spot is dry land inside the world rect, so land, air and amphibious
 * creatures can all reach one.
 *
 * `zone` names the spot's anchor zone — for reeds that is the pond they hug,
 * even though the spot itself is (by construction) outside the water.
 */
export interface FoodSpot extends Vec2 {
  zone: ZoneId;
}

function onEllipse(z: EllipseZone, zone: ZoneId, scale: number, deg: number): FoodSpot {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round(z.x + Math.cos(a) * z.rx * scale),
    y: Math.round(z.y + Math.sin(a) * z.ry * scale),
    zone,
  };
}

export const FOOD_SPOTS: readonly FoodSpot[] = [
  // Forest edge: berry thickets and shaded grass all round the canopy.
  ...[0, 45, 90, 135, 180, 225, 270, 315].map((d) => onEllipse(FOREST, 'forest', 0.98, d)),
  // Grove edge: the sunlit southern half (the northern rim runs off the map).
  ...[0, 45, 90, 135].map((d) => onEllipse(GROVE, 'grove', 0.98, d)),
  // Pond shore: reeds and waterweed, just clear of the water.
  ...[0, 90, 180, 270].map((d) => onEllipse(POND, 'pond', 1.1, d)),
  // Open meadow: clover and long grass, clear of every zone and the shore.
  { x: 1600, y: 1900, zone: 'meadow' },
  { x: 2500, y: 1400, zone: 'meadow' },
  { x: 1200, y: 2300, zone: 'meadow' },
];
