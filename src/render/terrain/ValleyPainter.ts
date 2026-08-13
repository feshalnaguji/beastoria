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
import { FOREST, GROVE, POND, inEllipse, type EllipseZone } from '../../sim/valley';

const COSMETIC_SEED = 20260813;

export interface ValleyLayers {
  ground: Container;
  detail: Container;
}

export function buildValley(): ValleyLayers {
  const rng = seedRng(COSMETIC_SEED);
  return {
    ground: buildGround(rng),
    detail: buildDetail(rng),
  };
}

/* ------------------------------ ground ------------------------------ */

function buildGround(rng: RngState): Container {
  const ground = new Container();

  // Base meadow wash: warm green, deepening gently toward the south
  // (stacked low-alpha bands read as a smooth gradient once baked soft).
  const base = new Graphics();
  base.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x90b475);
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    const y = WORLD_HEIGHT * (0.4 + (0.6 * i) / bands);
    base.rect(0, y, WORLD_WIDTH, WORLD_HEIGHT - y).fill({ color: 0x84a968, alpha: 0.09 });
  }
  ground.addChild(base);

  // Organic meadow patches.
  const patches = new Graphics();
  for (let i = 0; i < 70; i++) {
    const x = nextRange(rng, 0, WORLD_WIDTH);
    const y = nextRange(rng, 0, WORLD_HEIGHT);
    const r = nextRange(rng, 90, 340);
    patches.ellipse(x, y, r, r * nextRange(rng, 0.5, 0.8)).fill({
      color: 0x7da861,
      alpha: nextRange(rng, 0.15, 0.4),
    });
  }
  ground.addChild(patches);

  // Forest floor: layered mossy washes with feathered edges.
  ground.addChild(featheredZone(FOREST, 0x5f8a4e, 0.5));
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
  const flowerColors = [0xf7f3d7, 0xf2d8e4, 0xfdf6b8, 0xe8eef5];
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

function buildDetail(rng: RngState): Container {
  const detail = new Container();
  const g = new Graphics();

  // Forest trees.
  for (let i = 0; i < 20; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const rad = Math.sqrt(nextRange(rng, 0, 1));
    const x = FOREST.x + Math.cos(angle) * FOREST.rx * 0.85 * rad;
    const y = FOREST.y + Math.sin(angle) * FOREST.ry * 0.85 * rad;
    drawTree(g, rng, x, y, nextRange(rng, 0.8, 1.4));
  }
  // A few lone meadow trees.
  drawTree(g, rng, 2700, 1300, 1.2);
  drawTree(g, rng, 1500, 2200, 1.0);
  drawTree(g, rng, 900, 1900, 0.9);

  // Berry bushes at the forest edge.
  for (let i = 0; i < 6; i++) {
    const angle = nextRange(rng, -0.6, 1.4);
    const x = FOREST.x + Math.cos(angle) * FOREST.rx * nextRange(rng, 0.9, 1.05);
    const y = FOREST.y + Math.sin(angle) * FOREST.ry * nextRange(rng, 0.9, 1.05);
    drawBush(g, rng, x, y);
  }

  // Reeds around the pond shore.
  for (let i = 0; i < 26; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const x = POND.x + Math.cos(angle) * POND.rx * nextRange(rng, 1.02, 1.14);
    const y = POND.y + Math.sin(angle) * POND.ry * nextRange(rng, 1.02, 1.14);
    drawReeds(g, rng, x, y);
  }

  // Lily pads near the pond's edge.
  for (let i = 0; i < 10; i++) {
    const angle = nextRange(rng, 0, Math.PI * 2);
    const x = POND.x + Math.cos(angle) * POND.rx * nextRange(rng, 0.55, 0.85);
    const y = POND.y + Math.sin(angle) * POND.ry * nextRange(rng, 0.55, 0.85);
    const r = nextRange(rng, 14, 26);
    g.circle(x, y, r).fill({ color: 0x5f9451, alpha: 0.95 });
    g.circle(x - r * 0.3, y - r * 0.3, r * 0.35).fill({ color: 0x79ab68, alpha: 0.8 });
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
  const blossom = [0xf4cddd, 0xf9e0e8, 0xfdf0e4, 0xf0bfd4];
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

function drawTree(g: Graphics, rng: RngState, x: number, y: number, s: number): void {
  g.ellipse(x, y + 46 * s, 52 * s, 15 * s).fill({ color: 0x3d5a2e, alpha: 0.25 }); // shadow
  g.roundRect(x - 9 * s, y - 20 * s, 18 * s, 70 * s, 8 * s).fill(0x77563f); // trunk
  const greens = [0x4f7d42, 0x5d8f4d, 0x6da05a];
  for (let i = 0; i < 4; i++) {
    const color = greens[Math.floor(nextRange(rng, 0, greens.length))] ?? 0x5d8f4d;
    g.circle(x + nextRange(rng, -34, 34) * s, y - 55 * s + nextRange(rng, -26, 26) * s, nextRange(rng, 32, 52) * s).fill(
      { color, alpha: 0.92 },
    );
  }
  g.circle(x - 14 * s, y - 78 * s, 24 * s).fill({ color: 0x86b370, alpha: 0.75 }); // sun-kissed top
}

function drawBush(g: Graphics, rng: RngState, x: number, y: number): void {
  g.ellipse(x, y + 14, 34, 10).fill({ color: 0x3d5a2e, alpha: 0.2 });
  g.circle(x - 12, y, 18).fill(0x567f47);
  g.circle(x + 10, y - 4, 20).fill(0x618c50);
  g.circle(x + 2, y + 6, 16).fill(0x567f47);
  for (let i = 0; i < 7; i++) {
    g.circle(x + nextRange(rng, -22, 22), y + nextRange(rng, -12, 12), 3.2).fill(0xc9556a);
  }
}

function drawReeds(g: Graphics, rng: RngState, x: number, y: number): void {
  const n = Math.floor(nextRange(rng, 3, 6));
  for (let i = 0; i < n; i++) {
    const rx = x + nextRange(rng, -14, 14);
    const h = nextRange(rng, 30, 55);
    const lean = nextRange(rng, -6, 6);
    g.moveTo(rx, y).lineTo(rx + lean, y - h).stroke({ color: 0x5a7d4a, width: 3, cap: 'round' });
    if (nextRange(rng, 0, 1) > 0.5) {
      g.ellipse(rx + lean, y - h - 6, 4, 10).fill(0x8a6f4d); // cattail head
    }
  }
}

function drawRock(g: Graphics, rng: RngState, x: number, y: number, s: number): void {
  g.ellipse(x, y + 12 * s, 30 * s, 9 * s).fill({ color: 0x3d3d48, alpha: 0.2 });
  g.ellipse(x, y, 28 * s, 20 * s).fill(0x8f8d99);
  g.ellipse(x - 8 * s, y - 6 * s, 12 * s, 8 * s).fill({ color: 0xb0aebb, alpha: 0.8 });
  void rng;
}
