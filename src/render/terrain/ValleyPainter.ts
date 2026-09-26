/**
 * Paints the valley from the sim's own zone data (sim/valley.ts) — what you
 * see IS the world the creatures reason about.
 *
 * Two layers:
 *  - ground: soft washes (meadow, forest floor, grove rock, pond water),
 *    meant to be baked once to a texture — painterly and cheap.
 *  - detail: crisp vector stamps (trees, reeds, lilies, rocks, the ancient
 *    tree) that stay sharp at close zoom. Static after build.
 */
import { Container, Graphics } from 'pixi.js';
import { seedRng, nextRange, type RngState } from '../../sim/rng';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../sim/state';
import {
  FOOD_SPOTS,
  FOREST,
  GROVE,
  LONE_TREES,
  NEST_TREES,
  POND,
  inEllipse,
  type EllipseZone,
  type FoodSpot,
} from '../../sim/valley';
import type { Season } from '../../app/season';

const COSMETIC_SEED = 20260813;

export interface ValleyLayers {
  ground: Container;
  detail: Container;
}

/** The colours that change with the real season (G4). Layout never changes — only colour. */
export interface ValleyPalette {
  meadow: number;
  meadowBand: number;
  patch: number;
  forestFloor: number;
  flowers: number[];
  treeGreens: number[];
  treeTop: number;
  bush: [number, number];
  blossom: number[];
  lily: [number, number];
  reed: number;
}

export const SEASON_PALETTES: Record<Season, ValleyPalette> = {
  // The valley's original look.
  summer: {
    meadow: 0x90b475, meadowBand: 0x84a968, patch: 0x7da861, forestFloor: 0x5f8a4e,
    flowers: [0xf7f3d7, 0xf2d8e4, 0xfdf6b8, 0xe8eef5],
    treeGreens: [0x4f7d42, 0x5d8f4d, 0x6da05a], treeTop: 0x86b370,
    bush: [0x567f47, 0x618c50], blossom: [0xf4cddd, 0xf9e0e8, 0xfdf0e4, 0xf0bfd4],
    lily: [0x5f9451, 0x79ab68], reed: 0x5a7d4a,
  },
  spring: {
    meadow: 0x9cc27e, meadowBand: 0x8fb870, patch: 0x8ab96a, forestFloor: 0x679a55,
    flowers: [0xf6c9dc, 0xfdf6b8, 0xf2d8e4, 0xf7f3d7],
    treeGreens: [0x5f9450, 0x72a85e, 0x86b86c], treeTop: 0xa3cf8a,
    bush: [0x5e8c4d, 0x6c9a58], blossom: [0xf4c2d6, 0xf9d8e6, 0xfce9f0, 0xefb3cc],
    lily: [0x66a057, 0x86b973], reed: 0x62914f,
  },
  autumn: {
    meadow: 0xa8ac6f, meadowBand: 0x9c9d60, patch: 0xa7a060, forestFloor: 0x8a7446,
    flowers: [0xf2d6a2, 0xe9b87a, 0xfdf0c8, 0xe3a56f],
    treeGreens: [0xc98a3c, 0xb8642f, 0xd9a441], treeTop: 0xe8bd62,
    bush: [0x8a7a3f, 0x9c8a48], blossom: [0xe7a86a, 0xf0c48a, 0xd98a5f, 0xf4d6a8],
    lily: [0x7f8f4a, 0x9aa25e], reed: 0x9a8a55,
  },
  winter: {
    meadow: 0xb7c3b3, meadowBand: 0xa9b7a6, patch: 0xc8d2c7, forestFloor: 0x6f8a78,
    flowers: [0xf4f7fb, 0xe8eef5, 0xdfe7f0, 0xffffff],
    treeGreens: [0x4f6f58, 0x5c7b63, 0x6a8a70], treeTop: 0xe6eef0,
    bush: [0x55705a, 0x617d64], blossom: [0xf4f7fb, 0xe9eef3, 0xf6eef2, 0xe8dde8],
    lily: [0x6f8a6a, 0x87a080], reed: 0x7f8a74,
  },
};

export function buildValley(palette: ValleyPalette = SEASON_PALETTES.summer): ValleyLayers {
  const rng = seedRng(COSMETIC_SEED);
  return {
    ground: buildGround(rng, palette),
    detail: buildDetail(rng, palette),
  };
}

/* ------------------------------ ground ------------------------------ */

function buildGround(rng: RngState, p: ValleyPalette): Container {
  const ground = new Container();

  // Base meadow wash: warm green, deepening gently toward the south
  // (stacked low-alpha bands read as a smooth gradient once baked soft).
  const base = new Graphics();
  base.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(p.meadow);
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    const y = WORLD_HEIGHT * (0.4 + (0.6 * i) / bands);
    base.rect(0, y, WORLD_WIDTH, WORLD_HEIGHT - y).fill({ color: p.meadowBand, alpha: 0.09 });
  }
  ground.addChild(base);

  // Organic meadow patches.
  const patches = new Graphics();
  for (let i = 0; i < 70; i++) {
    const x = nextRange(rng, 0, WORLD_WIDTH);
    const y = nextRange(rng, 0, WORLD_HEIGHT);
    const r = nextRange(rng, 90, 340);
    patches.ellipse(x, y, r, r * nextRange(rng, 0.5, 0.8)).fill({
      color: p.patch,
      alpha: nextRange(rng, 0.15, 0.4),
    });
  }
  ground.addChild(patches);

  // Forest floor: layered mossy washes with feathered edges.
  ground.addChild(featheredZone(FOREST, p.forestFloor, 0.5));
  // Grove: rocky lavender-grey mountain foot.
  ground.addChild(featheredZone(GROVE, 0x9a9aa6, 0.45));
  ground.addChild(featheredZone({ ...GROVE, rx: GROVE.rx * 0.55, ry: GROVE.ry * 0.55 }, 0xa8a5b4, 0.4));

  // Pond: sandy shore ring, then shallow-to-deep water.
  ground.addChild(featheredZone({ ...POND, rx: POND.rx * 1.18, ry: POND.ry * 1.18 }, 0xcfc39a, 0.55));
  const water = new Graphics();
  water.ellipse(POND.x, POND.y, POND.rx, POND.ry).fill(0x7fb5b8);
  water.ellipse(POND.x, POND.y, POND.rx * 0.78, POND.ry * 0.78).fill({ color: 0x64a3ad, alpha: 0.9 });
  water.ellipse(POND.x + POND.rx * 0.05, POND.y + POND.ry * 0.08, POND.rx * 0.5, POND.ry * 0.5).fill({
    color: 0x4e8d9c,
    alpha: 0.9,
  });
  // Soft sun glint.
  water.ellipse(POND.x - POND.rx * 0.25, POND.y - POND.ry * 0.3, POND.rx * 0.28, POND.ry * 0.16).fill({
    color: 0xd8ecec,
    alpha: 0.35,
  });
  ground.addChild(water);

  // Meadow flowers (kept off water, forest core, and grove core).
  const flowers = new Graphics();
  const flowerColors = p.flowers;
  for (let i = 0; i < 280; i++) {
    const p = { x: nextRange(rng, 0, WORLD_WIDTH), y: nextRange(rng, 0, WORLD_HEIGHT) };
    if (inEllipse(p, POND) || inEllipse(p, { ...POND, rx: POND.rx * 1.15, ry: POND.ry * 1.15 })) continue;
    if (inEllipse(p, { ...FOREST, rx: FOREST.rx * 0.8, ry: FOREST.ry * 0.8 })) continue;
    if (inEllipse(p, { ...GROVE, rx: GROVE.rx * 0.8, ry: GROVE.ry * 0.8 })) continue;
    const color = flowerColors[Math.floor(nextRange(rng, 0, flowerColors.length))] ?? 0xf7f3d7;
    flowers.circle(p.x, p.y, nextRange(rng, 3, 6)).fill({ color, alpha: 0.9 });
  }
  ground.addChild(flowers);

  return ground;
}

/** Nested fading ellipses fake a feathered, painterly zone edge cheaply. */
function featheredZone(z: EllipseZone, color: number, alpha: number): Graphics {
  const g = new Graphics();
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = 1.15 - (i * 0.45) / steps; // 1.15 → 0.7
    g.ellipse(z.x, z.y, z.rx * t, z.ry * t).fill({ color, alpha: (alpha / steps) * (i + 1) * 0.9 });
  }
  return g;
}

/* ------------------------------ detail ------------------------------ */

function buildDetail(rng: RngState, p: ValleyPalette): Container {
  const detail = new Container();
  const g = new Graphics();

  // Forest trees.
  for (let i = 0; i < 20; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const rad = Math.sqrt(nextRange(rng, 0, 1));
    const x = FOREST.x + Math.cos(angle) * FOREST.rx * 0.85 * rad;
    const y = FOREST.y + Math.sin(angle) * FOREST.ry * 0.85 * rad;
    drawTree(g, rng, x, y, nextRange(rng, 0.8, 1.4), p);
  }
  // Nest-bearing trees (positions shared with the sim's home sites).
  for (const t of LONE_TREES) drawTree(g, rng, t.x, t.y, 1.15, p);
  for (const t of NEST_TREES) drawTree(g, rng, t.x, t.y, 1.05, p);

  // Berry bushes at the forest edge.
  for (let i = 0; i < 6; i++) {
    const angle = nextRange(rng, -0.6, 1.4);
    const x = FOREST.x + Math.cos(angle) * FOREST.rx * nextRange(rng, 0.9, 1.05);
    const y = FOREST.y + Math.sin(angle) * FOREST.ry * nextRange(rng, 0.9, 1.05);
    drawBush(g, rng, x, y, p);
  }

  // Reeds around the pond shore.
  for (let i = 0; i < 26; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const x = POND.x + Math.cos(angle) * POND.rx * nextRange(rng, 1.02, 1.14);
    const y = POND.y + Math.sin(angle) * POND.ry * nextRange(rng, 1.02, 1.14);
    drawReeds(g, rng, x, y, p);
  }

  // The valley's larder (M9 task 5): a small cluster at every FOOD_SPOT
  // (sim/valley.ts) so foraging treks visibly aim somewhere real — what a
  // creature forages at is what you see painted here. Pond-shore spots get
  // an extra reed tuft instead, to match the surrounding shore art.
  for (const spot of FOOD_SPOTS) drawFoodCluster(g, rng, spot, p);

  // Lily pads near the pond's edge.
  for (let i = 0; i < 10; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const x = POND.x + Math.cos(angle) * POND.rx * nextRange(rng, 0.55, 0.85);
    const y = POND.y + Math.sin(angle) * POND.ry * nextRange(rng, 0.55, 0.85);
    const r = nextRange(rng, 14, 26);
    g.circle(x, y, r).fill({ color: p.lily[0], alpha: 0.95 });
    g.circle(x - r * 0.3, y - r * 0.3, r * 0.35).fill({ color: p.lily[1], alpha: 0.8 });
  }

  // Grove rocks.
  for (let i = 0; i < 14; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const rad = Math.sqrt(nextRange(rng, 0, 1));
    const x = GROVE.x + Math.cos(angle) * GROVE.rx * 0.8 * rad;
    const y = GROVE.y + Math.sin(angle) * GROVE.ry * 0.8 * rad;
    drawRock(g, rng, x, y, nextRange(rng, 0.7, 1.6));
  }
  // A few meadow stones.
  drawRock(g, rng, 1800, 1700, 0.8);
  drawRock(g, rng, 3300, 1200, 0.7);

  detail.addChild(g);

  // The ancient blossom tree — the grove's heart (phoenix home, M5).
  const ancient = new Graphics();
  const ax = GROVE.x;
  const ay = GROVE.y + 60;
  ancient.ellipse(ax, ay + 95, 150, 34).fill({ color: 0x4a4a58, alpha: 0.25 }); // shadow
  ancient.roundRect(ax - 22, ay - 60, 44, 160, 18).fill(0x7a5c48); // trunk
  ancient.roundRect(ax - 60, ay - 10, 50, 20, 10).fill(0x7a5c48); // low bough
  ancient.roundRect(ax + 14, ay - 30, 55, 18, 9).fill(0x7a5c48);
  // Blossom canopy: soft pinks and creams.
  const blossom = p.blossom;
  for (let i = 0; i < 16; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const rad = nextRange(rng, 0, 130);
    const color = blossom[Math.floor(nextRange(rng, 0, blossom.length))] ?? 0xf4cddd;
    ancient
      .circle(ax + Math.cos(angle) * rad, ay - 120 + Math.sin(angle) * rad * 0.6, nextRange(rng, 40, 85))
      .fill({ color, alpha: 0.85 });
  }
  // A hint of magic: faint warm glow at the roots.
  ancient.ellipse(ax, ay + 70, 110, 40).fill({ color: 0xffdda6, alpha: 0.18 });
  detail.addChild(ancient);

  return detail;
}

function drawTree(g: Graphics, rng: RngState, x: number, y: number, s: number, p: ValleyPalette): void {
  g.ellipse(x, y + 46 * s, 52 * s, 15 * s).fill({ color: 0x3d5a2e, alpha: 0.25 }); // shadow
  g.roundRect(x - 9 * s, y - 20 * s, 18 * s, 70 * s, 8 * s).fill(0x77563f); // trunk
  const greens = p.treeGreens;
  for (let i = 0; i < 4; i++) {
    const color = greens[Math.floor(nextRange(rng, 0, greens.length))] ?? 0x5d8f4d;
    g.circle(x + nextRange(rng, -34, 34) * s, y - 55 * s + nextRange(rng, -26, 26) * s, nextRange(rng, 32, 52) * s).fill(
      { color, alpha: 0.92 },
    );
  }
  g.circle(x - 14 * s, y - 78 * s, 24 * s).fill({ color: p.treeTop, alpha: 0.75 }); // sun-kissed top
}

function drawBush(g: Graphics, rng: RngState, x: number, y: number, p: ValleyPalette): void {
  g.ellipse(x, y + 14, 34, 10).fill({ color: 0x3d5a2e, alpha: 0.2 });
  g.circle(x - 12, y, 18).fill(p.bush[0]);
  g.circle(x + 10, y - 4, 20).fill(p.bush[1]);
  g.circle(x + 2, y + 6, 16).fill(p.bush[0]);
  for (let i = 0; i < 7; i++) {
    g.circle(x + nextRange(rng, -22, 22), y + nextRange(rng, -12, 12), 3.2).fill(0xc9556a);
  }
}

function drawReeds(g: Graphics, rng: RngState, x: number, y: number, p: ValleyPalette): void {
  const n = Math.floor(nextRange(rng, 3, 6));
  for (let i = 0; i < n; i++) {
    const rx = x + nextRange(rng, -14, 14);
    const h = nextRange(rng, 30, 55);
    const lean = nextRange(rng, -6, 6);
    g.moveTo(rx, y).lineTo(rx + lean, y - h).stroke({ color: p.reed, width: 3, cap: 'round' });
    if (nextRange(rng, 0, 1) > 0.5) {
      g.ellipse(rx + lean, y - h - 6, 4, 10).fill(0x8a6f4d); // cattail head
    }
  }
}

/** A small berry/grass cluster marking a FOOD_SPOT, or (on the pond shore)
 * an extra reed tuft to match the surrounding art (M9 task 5). */
function drawFoodCluster(g: Graphics, rng: RngState, spot: FoodSpot, p: ValleyPalette): void {
  if (spot.zone === 'pond') {
    drawReeds(g, rng, spot.x, spot.y, p);
    return;
  }
  // Forest/grove edges read as berries + a leaf; the open meadow leans
  // clover-green with just a hint of berry.
  const colors =
    spot.zone === 'meadow' ? [0xd8e8c0, 0xeef0d8, 0xc9556a] : [0xc9556a, 0xb03f52, 0x8fae5c];
  for (let i = 0; i < 3; i++) {
    const dx = nextRange(rng, -6, 6);
    const dy = nextRange(rng, -4, 4);
    const color = colors[i % colors.length] ?? 0xc9556a;
    g.circle(spot.x + dx, spot.y + dy, nextRange(rng, 2.5, 4)).fill({ color, alpha: 0.9 });
  }
}

function drawRock(g: Graphics, rng: RngState, x: number, y: number, s: number): void {
  g.ellipse(x, y + 12 * s, 30 * s, 9 * s).fill({ color: 0x3d3d48, alpha: 0.2 });
  g.ellipse(x, y, 28 * s, 20 * s).fill(0x8f8d99);
  g.ellipse(x - 8 * s, y - 6 * s, 12 * s, 8 * s).fill({ color: 0xb0aebb, alpha: 0.8 });
  void rng;
}
