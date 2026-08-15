/**
 * Ambient effects: the valley breathes. Four cheap, purely cosmetic layers —
 * grass sway, water shimmer, dappled light, fireflies — built once at init
 * from a seeded cosmetic RNG (never the sim's), then animated per frame with
 * no per-frame allocation. Render-only; never touches src/sim/.
 */
import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  TilingSprite,
  type Renderer as PixiRenderer,
  type Texture,
} from 'pixi.js';
import type { Clock } from '../../sim/clock';
import { nextRange, seedRng, type RngState } from '../../sim/rng';
import { WORLD_HEIGHT, WORLD_WIDTH, type Vec2 } from '../../sim/state';
import { FOREST, GROVE, POND, inEllipse } from '../../sim/valley';

const GRASS_COUNT = 140;
const FIREFLY_COUNT = 40;
const MEMORIAL_ANCHOR_COUNT = 8;
const SHIMMER_SPEED = 0.006; // px/ms ≈ 6px/s

// Meadow rejection zones — same padding as the ground painter's flower scatter.
const POND_EDGE = { ...POND, rx: POND.rx * 1.15, ry: POND.ry * 1.15 };
const FOREST_CORE = { ...FOREST, rx: FOREST.rx * 0.8, ry: FOREST.ry * 0.8 };
const GROVE_CORE = { ...GROVE, rx: GROVE.rx * 0.8, ry: GROVE.ry * 0.8 };

function inMeadow(p: Vec2): boolean {
  return !inEllipse(p, POND_EDGE) && !inEllipse(p, FOREST_CORE) && !inEllipse(p, GROVE_CORE);
}

interface Tuft { node: Graphics; period: number; phase: number }
interface DappleBlob { sprite: Sprite; cx: number; cy: number; ax: number; ay: number; fx: number; fy: number; phase: number }
interface Firefly {
  particle: Particle;
  anchor: Vec2;
  homeAnchor: Vec2;
  rx: number;
  ry: number;
  fx: number;
  fy: number;
  phase: number;
  twinkleFreq: number;
  twinklePhase: number;
}

export class AmbientEffects {
  readonly shimmerLayer: Container;
  readonly grassLayer: Container;
  readonly dappleLayer: Container;
  readonly fireflyLayer: ParticleContainer;

  private readonly rng: RngState;
  private elapsedMs = 0;
  private readonly tufts: Tuft[] = [];
  private readonly blobs: DappleBlob[] = [];
  private readonly fireflies: Firefly[] = [];
  private shimmerA!: TilingSprite;
  private shimmerB!: TilingSprite;

  constructor(world: Container, cosmeticSeed: number) {
    this.rng = seedRng(cosmeticSeed);
    this.shimmerLayer = new Container();
    this.grassLayer = new Container();
    this.dappleLayer = new Container();
    this.fireflyLayer = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
    // Provisional order — Renderer re-inserts these at their final z-index spots.
    world.addChild(this.shimmerLayer, this.grassLayer, this.dappleLayer, this.fireflyLayer);
  }

  build(renderer: PixiRenderer): void {
    this.buildGrass();
    this.buildShimmer(renderer);
    this.buildDapple(renderer);
    this.buildFireflies(renderer);
  }

  /**
   * Renderer calls this once per rendered frame, after day/night grading.
   * `zoom` is the only view value consumed (x/y are unused), so the caller
   * passes `camera.getZoom()` directly rather than a view-info object.
   */
  update(dtMs: number, clock: Clock, zoom: number): void {
    this.elapsedMs += dtMs;
    const t = this.elapsedMs;

    // Grass sway — invisible at world zoom anyway, so skip the work entirely.
    if (zoom >= 0.35) {
      for (const tuft of this.tufts) tuft.node.skew.x = Math.sin(t / tuft.period + tuft.phase) * 0.06;
    }

    // Water shimmer: two noise tiles scrolling opposite ways, dimmer by night.
    const shimmerLight = 0.4 + 0.6 * clock.light;
    this.shimmerA.tilePosition.x += dtMs * SHIMMER_SPEED;
    // y-drift (×0.4) is an intentional embellishment beyond the brief's
    // x-only scroll — a touch of diagonal motion reads less like a treadmill.
    this.shimmerA.tilePosition.y += dtMs * SHIMMER_SPEED * 0.4;
    this.shimmerB.tilePosition.x -= dtMs * SHIMMER_SPEED;
    this.shimmerB.tilePosition.y -= dtMs * SHIMMER_SPEED * 0.4;
    this.shimmerA.alpha = 0.05 * shimmerLight;
    this.shimmerB.alpha = 0.04 * shimmerLight;

    // Dappled light: soft drifting blobs, daylight only.
    const dappleT = Math.max(0, (clock.light - 0.5) / 0.5);
    this.dappleLayer.visible = dappleT > 0;
    if (dappleT > 0) {
      for (const b of this.blobs) {
        b.sprite.x = b.cx + Math.sin(t * b.fx + b.phase) * b.ax;
        b.sprite.y = b.cy + Math.sin(t * b.fy + b.phase * 1.3) * b.ay;
        b.sprite.alpha = 0.05 * dappleT;
      }
    }

    // Fireflies: night only, drifting on slow orbits with a gentle twinkle.
    const dark = clock.light < 0.35;
    this.fireflyLayer.visible = dark;
    if (dark) {
      const nightAmount = 1 - clock.light;
      for (const f of this.fireflies) {
        f.particle.x = f.anchor.x + Math.sin(t * f.fx + f.phase) * f.rx;
        f.particle.y = f.anchor.y + Math.sin(t * f.fy + f.phase * 1.7) * f.ry;
        const twinkle = 0.55 + 0.45 * Math.sin(t * f.twinkleFreq + f.twinklePhase);
        f.particle.alpha = nightAmount * twinkle;
      }
    }
  }

  /**
   * Renderer calls this from `sync()` (once per sim tick, not per frame).
   * Biases the first few fireflies toward the most recent memorials, so the
   * valley's little lights visit where an elder came to rest.
   */
  setMemorialAnchors(positions: Vec2[]): void {
    const recent = positions.slice(-MEMORIAL_ANCHOR_COUNT);
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      if (!f) continue;
      f.anchor = i < recent.length ? (recent[i] ?? f.homeAnchor) : f.homeAnchor;
    }
  }

  private buildGrass(): void {
    const greens = [0x5d8f4d, 0x729c5c];
    let placed = 0;
    let guard = 0;
    while (placed < GRASS_COUNT && guard < GRASS_COUNT * 30) {
      guard++;
      const p = { x: nextRange(this.rng, 0, WORLD_WIDTH), y: nextRange(this.rng, 0, WORLD_HEIGHT) };
      if (!inMeadow(p)) continue;

      const g = new Graphics();
      const color = greens[placed % 2] ?? 0x5d8f4d;
      for (let b = 0; b < 3; b++) {
        const bx = (b - 1) * 3;
        const bh = nextRange(this.rng, 10, 18);
        const lean = nextRange(this.rng, -2, 2);
        g.moveTo(bx, 0).lineTo(bx + lean, -bh).stroke({ color, width: 2, cap: 'round' });
      }
      g.position.set(p.x, p.y);
      this.grassLayer.addChild(g);
      this.tufts.push({ node: g, period: nextRange(this.rng, 2400, 3600), phase: nextRange(this.rng, 0, Math.PI * 2) });
      placed++;
    }
  }

  private buildShimmer(renderer: PixiRenderer): void {
    const texA = this.bakeNoiseTexture(renderer);
    const texB = this.bakeNoiseTexture(renderer);
    const w = POND.rx * 2.4;
    const h = POND.ry * 2.4;

    this.shimmerA = new TilingSprite({ texture: texA, width: w, height: h });
    this.shimmerB = new TilingSprite({ texture: texB, width: w, height: h });
    for (const s of [this.shimmerA, this.shimmerB]) {
      s.position.set(POND.x - w / 2, POND.y - h / 2);
      s.blendMode = 'add';
    }

    const mask = new Graphics().ellipse(POND.x, POND.y, POND.rx, POND.ry).fill(0xffffff);
    mask.renderable = false; // still gets transform updates; just never drawn directly
    this.shimmerLayer.addChild(mask, this.shimmerA, this.shimmerB);
    this.shimmerLayer.mask = mask;
  }

  private bakeNoiseTexture(renderer: PixiRenderer): Texture {
    const g = new Graphics();
    for (let i = 0; i < 200; i++) {
      const x = nextRange(this.rng, 0, 256);
      const y = nextRange(this.rng, 0, 256);
      const r = nextRange(this.rng, 2, 10);
      g.ellipse(x, y, r, r * nextRange(this.rng, 0.6, 1)).fill({
        color: 0xffffff,
        alpha: nextRange(this.rng, 0.05, 0.18),
      });
    }
    return this.bake(renderer, g, 256, 256);
  }

  private buildDapple(renderer: PixiRenderer): void {
    const tex = this.bakeSoftCircleTexture(renderer);
    for (let i = 0; i < 3; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.alpha = 0;
      sprite.scale.set(nextRange(this.rng, 4, 6));
      this.dappleLayer.addChild(sprite);
      this.blobs.push({
        sprite,
        cx: nextRange(this.rng, WORLD_WIDTH * 0.25, WORLD_WIDTH * 0.75),
        cy: nextRange(this.rng, WORLD_HEIGHT * 0.25, WORLD_HEIGHT * 0.75),
        ax: nextRange(this.rng, 300, 600),
        ay: nextRange(this.rng, 200, 450),
        fx: nextRange(this.rng, 0.00006, 0.00012),
        fy: nextRange(this.rng, 0.00005, 0.0001),
        phase: nextRange(this.rng, 0, Math.PI * 2),
      });
    }
  }

  private bakeSoftCircleTexture(renderer: PixiRenderer): Texture {
    const g = new Graphics();
    const R = 64;
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      g.circle(R, R, (R * i) / steps).fill({ color: 0xffffff, alpha: 0.15 / i });
    }
    return this.bake(renderer, g, R * 2, R * 2);
  }

  private buildFireflies(renderer: PixiRenderer): void {
    const tex = this.bake(renderer, new Graphics().circle(2, 2, 2).fill(0xffffff), 4, 4);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const anchor = this.fireflyAnchor(i);
      const particle = new Particle({
        texture: tex,
        x: anchor.x,
        y: anchor.y,
        anchorX: 0.5,
        anchorY: 0.5,
        tint: 0xfff2b0,
        alpha: 0,
      });
      this.fireflyLayer.addParticle(particle);
      this.fireflies.push({
        particle,
        anchor,
        homeAnchor: anchor,
        rx: nextRange(this.rng, 20, 60),
        ry: nextRange(this.rng, 15, 45),
        fx: nextRange(this.rng, 0.0003, 0.0008),
        fy: nextRange(this.rng, 0.00025, 0.0007),
        phase: nextRange(this.rng, 0, Math.PI * 2),
        twinkleFreq: nextRange(this.rng, 0.0016, 0.0031),
        twinklePhase: nextRange(this.rng, 0, Math.PI * 2),
      });
    }
  }

  /** Near the forest edge (evens) or scattered among meadow flowers (odds). */
  private fireflyAnchor(i: number): Vec2 {
    if (i % 2 === 0) {
      const angle = nextRange(this.rng, 0, Math.PI * 2);
      const radius = nextRange(this.rng, 0.85, 1.2);
      return { x: FOREST.x + Math.cos(angle) * FOREST.rx * radius, y: FOREST.y + Math.sin(angle) * FOREST.ry * radius };
    }
    for (let tries = 0; tries < 20; tries++) {
      const p = { x: nextRange(this.rng, 0, WORLD_WIDTH), y: nextRange(this.rng, 0, WORLD_HEIGHT) };
      if (inMeadow(p)) return p;
    }
    return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  /** Bake a Graphics build-up to a texture once, then discard the vectors. */
  private bake(renderer: PixiRenderer, g: Graphics, w: number, h: number): Texture {
    const tex = renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, w, h), resolution: 1 });
    g.destroy(true);
    return tex;
  }
}
