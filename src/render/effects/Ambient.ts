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
/** Moment sparkles (M9 task 5): a hatch/birth/pairing spawns 10 particles;
 * the pool is generously sized for several moments landing close together
 * without particles cutting each other off, reused via a rolling cursor so
 * spawning never allocates. */
const SPARKLE_PER_MOMENT = 10;
const SPARKLE_POOL_SIZE = 60;
const SPARKLE_LIFE_MS = 1500;
const SPARKLE_TINT = 0xfff6df; // soft cream

/** Hatch crack overlay (M10 task 4): a hatch is rare enough that a small
 * Sprite pool (texture-swapped, unlike the Particle pools above) is cheap —
 * generous enough for several families hatching close together, or a burst
 * of buffered 'hatched' events landing in one post-catch-up sync. */
const HATCH_POOL_SIZE = 10;
/** whole -> cracked -> halves, ~700ms each, then the halves fade over 800ms. */
const HATCH_STAGE_MS = 700;
const HATCH_FADE_MS = 800;
const HATCH_TOTAL_MS = HATCH_STAGE_MS * 3 + HATCH_FADE_MS;

/** Drifting sleep 'z's (M10 task 4): small, frequent, capped pool — a
 * napping population could otherwise emit indefinitely. */
const ZZZ_POOL_SIZE = 12;
const ZZZ_LIFE_MS = 2000;
const ZZZ_RISE_PX = 14;

/** Feed motes (M11, legibility pass M12 task 3): a small burst of motes
 * arcs from parent to baby at the moment of feeding — one burst per
 * sequenced carry delivery, one per staggered nurse suckle beat. Short and
 * frequent, so a bounded pool (spawnHatch's pattern) covers a whole family
 * feeding without ever allocating. Pool doubled (12 -> 24) to cover the
 * 3-mote burst per event (Renderer.onFeedings) at the same headroom as
 * before; radius and lifetime both grew so the moment reads clearly instead
 * of flickering past. */
const FEED_MOTE_POOL_SIZE = 24;
const FEED_MOTE_MS = 900;
const FEED_MOTE_RADIUS_PX = 5;

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

/** A single pooled moment-sparkle particle — rises and fades once spawned,
 * then sits inert until `spawnSparkle` recycles it. */
interface Sparkle {
  particle: Particle;
  active: boolean;
  ageMs: number;
  lifeMs: number;
  baseX: number;
  baseY: number;
  vx: number; // px/ms
  vy: number; // px/ms (negative = rising)
}

/** A single pooled hatch-crack overlay — cycles through the three baked
 * shell textures, then fades out. Sprite-based (not Particle) because it
 * needs per-instance texture swaps, which the Particle pools above never do. */
interface HatchOverlay {
  sprite: Sprite;
  active: boolean;
  ageMs: number;
  scale: number; // Per-home-kind scale to fit different egg sizes (M10 task 4 fix).
  tint: number; // Per-home-kind tint for spawnClump (soft green, M10 task 4 fix).
}

/** A single pooled drifting sleep 'z' — rises and fades once spawned. */
interface Zzz {
  sprite: Sprite;
  active: boolean;
  ageMs: number;
  baseX: number;
  baseY: number;
}

/** A single pooled feed mote — eases from parent to baby along a gentle,
 * upward-bowed arc, fading over its last 40% (M11). Sprite-based (like
 * HatchOverlay) because it needs a per-instance tint swap (amber vs
 * milk-white), which the Particle pools above never do. */
interface FeedMote {
  sprite: Sprite;
  active: boolean;
  ageMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Peak upward bow (world px, negative = up) — scaled to the hop's own
   * length so a short suckle and a long carry-delivery both read as a
   * gentle lift, not a fixed-height jump. */
  bowPx: number;
  /** M12 task 3: ms remaining before this mote actually starts easing —
   * lets a burst of 3 read as a small trailing flourish instead of 3 dots
   * perfectly overlapping. Counted down in update(); the mote stays
   * invisible while > 0, then starts its normal ageMs-driven ease the
   * instant it hits 0 (any overflow from the frame that crossed 0 is
   * folded straight into that first ageMs tick, so the delay never costs
   * an extra idle frame). 0 for an un-staggered spawn (spawnHatch/spawnZ's
   * single-shot pattern still needs zero code changes elsewhere). */
  delayMs: number;
}

export class AmbientEffects {
  readonly shimmerLayer: Container;
  readonly grassLayer: Container;
  readonly dappleLayer: Container;
  readonly fireflyLayer: ParticleContainer;
  readonly sparkleLayer: ParticleContainer;
  /** Hatch crack overlays, drawn over the nest (M10 task 4). */
  readonly hatchLayer: Container;
  /** Drifting sleep 'z's (M10 task 4). */
  readonly zzzLayer: Container;
  /** Feed motes (M11). */
  readonly feedMoteLayer: Container;

  private readonly rng: RngState;
  private elapsedMs = 0;
  private readonly tufts: Tuft[] = [];
  private readonly blobs: DappleBlob[] = [];
  private readonly fireflies: Firefly[] = [];
  private readonly sparkles: Sparkle[] = [];
  private sparkleCursor = 0;
  private readonly hatches: HatchOverlay[] = [];
  private hatchCursor = 0;
  private hatchTextures: [Texture, Texture, Texture] | undefined;
  private readonly zzzs: Zzz[] = [];
  private zzzCursor = 0;
  private readonly feedMotes: FeedMote[] = [];
  private feedMoteCursor = 0;
  private shimmerA!: TilingSprite;
  private shimmerB!: TilingSprite;

  constructor(world: Container, cosmeticSeed: number) {
    this.rng = seedRng(cosmeticSeed);
    this.shimmerLayer = new Container();
    this.grassLayer = new Container();
    this.dappleLayer = new Container();
    this.fireflyLayer = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
    this.sparkleLayer = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
    this.hatchLayer = new Container();
    this.zzzLayer = new Container();
    this.feedMoteLayer = new Container();
    // Provisional order — Renderer re-inserts these at their final z-index spots.
    world.addChild(
      this.shimmerLayer,
      this.grassLayer,
      this.dappleLayer,
      this.fireflyLayer,
      this.sparkleLayer,
      this.hatchLayer,
      this.zzzLayer,
      this.feedMoteLayer,
    );
  }

  build(renderer: PixiRenderer): void {
    this.buildGrass();
    this.buildShimmer(renderer);
    this.buildDapple(renderer);
    this.buildFireflies(renderer);
    this.buildSparkles(renderer);
    this.buildHatches(renderer);
    this.buildZzzs(renderer);
    this.buildFeedMotes(renderer);
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

    // Moment sparkles: a slow rise-and-fade envelope (peaks mid-life), at
    // any hour — a hatch or a pairing reads the same by day or by night.
    for (const s of this.sparkles) {
      if (!s.active) continue;
      s.ageMs += dtMs;
      if (s.ageMs >= s.lifeMs) {
        s.active = false;
        s.particle.alpha = 0;
        continue;
      }
      const st = s.ageMs / s.lifeMs;
      s.particle.x = s.baseX + s.vx * s.ageMs;
      s.particle.y = s.baseY + s.vy * s.ageMs;
      s.particle.alpha = Math.sin(Math.PI * st) * 0.9;
    }

    // Hatch crack overlays: 3 baked states in sequence, then the last
    // (halves) eases out — see spawnHatch below.
    for (const h of this.hatches) {
      if (!h.active) continue;
      h.ageMs += dtMs;
      if (h.ageMs >= HATCH_TOTAL_MS) {
        h.active = false;
        h.sprite.visible = false;
        continue;
      }
      const textures = this.hatchTextures;
      if (textures) {
        if (h.ageMs < HATCH_STAGE_MS) h.sprite.texture = textures[0];
        else if (h.ageMs < HATCH_STAGE_MS * 2) h.sprite.texture = textures[1];
        else h.sprite.texture = textures[2];
      }
      const sinceHalves = h.ageMs - HATCH_STAGE_MS * 3;
      h.sprite.alpha = sinceHalves <= 0 ? 1 : Math.max(0, 1 - sinceHalves / HATCH_FADE_MS);
    }

    // Drifting sleep 'z's: rise and fade once, then sit inert until recycled.
    for (const z of this.zzzs) {
      if (!z.active) continue;
      z.ageMs += dtMs;
      if (z.ageMs >= ZZZ_LIFE_MS) {
        z.active = false;
        z.sprite.visible = false;
        continue;
      }
      const zt = z.ageMs / ZZZ_LIFE_MS;
      z.sprite.y = z.baseY - ZZZ_RISE_PX * zt;
      z.sprite.alpha = (1 - zt) * 0.85;
    }

    // Feed motes: ease-out from parent to baby along a gentle, upward-bowed
    // arc (a parabola peaking at the midpoint), fading over the last 40% of
    // their short life — see spawnFeedMote (M11). M12 task 3: a mote spawned
    // with a delay (part of a staggered burst) sits invisible until its
    // delayMs counts down to 0, then starts easing exactly as before.
    for (const m of this.feedMotes) {
      if (!m.active) continue;
      if (m.delayMs > 0) {
        m.delayMs -= dtMs;
        if (m.delayMs > 0) continue;
        // Crossed 0 this frame: reveal it and fold the overflow (how far
        // past 0 delayMs went) into this frame's age, so the ease starts
        // exactly on time rather than losing up to a frame to the delay.
        m.sprite.visible = true;
        m.ageMs = -m.delayMs;
        m.delayMs = 0;
      } else {
        m.ageMs += dtMs;
      }
      if (m.ageMs >= FEED_MOTE_MS) {
        m.active = false;
        m.sprite.visible = false;
        continue;
      }
      const mt = m.ageMs / FEED_MOTE_MS;
      const ease = 1 - (1 - mt) * (1 - mt); // ease-out quad
      m.sprite.x = m.fromX + (m.toX - m.fromX) * ease;
      m.sprite.y = m.fromY + (m.toY - m.fromY) * ease + m.bowPx * 4 * mt * (1 - mt);
      m.sprite.alpha = mt < 0.6 ? 1 : 1 - (mt - 0.6) / 0.4;
    }
  }

  /**
   * Spawns one moment's worth of soft cream sparkles at a world position —
   * a hatch, a birth, a new pair (M9 task 5). Never allocates: particles are
   * drawn from a fixed pool via a rolling cursor, so a burst of moments in
   * quick succession simply recycles the oldest sparkles early rather than
   * growing anything.
   */
  spawnSparkle(pos: Vec2): void {
    for (let i = 0; i < SPARKLE_PER_MOMENT; i++) {
      const s = this.sparkles[this.sparkleCursor];
      this.sparkleCursor = (this.sparkleCursor + 1) % SPARKLE_POOL_SIZE;
      if (!s) continue;
      s.active = true;
      s.ageMs = 0;
      s.lifeMs = SPARKLE_LIFE_MS + nextRange(this.rng, -150, 150);
      const angle = nextRange(this.rng, 0, Math.PI * 2);
      const dist = nextRange(this.rng, 0, 14);
      s.baseX = pos.x + Math.cos(angle) * dist;
      s.baseY = pos.y + Math.sin(angle) * dist;
      s.vx = nextRange(this.rng, -6, 6) / 1000;
      s.vy = nextRange(this.rng, -22, -14) / 1000; // a slow rise
      s.particle.x = s.baseX;
      s.particle.y = s.baseY;
      s.particle.alpha = 0;
    }
  }

  /**
   * Starts (or restarts, via the rolling pool cursor) a shell-crack overlay
   * at a nest position — the hatch itself is the moment, so this replaces
   * the generic moment sparkle for 'hatched' events (M10 task 4). Never
   * allocates: recycles the oldest pooled sprite exactly like spawnSparkle.
   */
  spawnHatch(pos: Vec2, scale: number = 1, tint: number = 0xffffff): void {
    const h = this.hatches[this.hatchCursor];
    this.hatchCursor = (this.hatchCursor + 1) % HATCH_POOL_SIZE;
    if (!h) return;
    h.active = true;
    h.ageMs = 0;
    h.scale = scale;
    h.tint = tint;
    h.sprite.visible = true;
    h.sprite.alpha = 1;
    h.sprite.position.set(pos.x, pos.y);
    h.sprite.scale.set(scale);
    h.sprite.tint = tint;
    if (this.hatchTextures) h.sprite.texture = this.hatchTextures[0];
  }

  /** Starts one drifting sleep 'z' at a crown position (M10 task 4). */
  spawnZ(pos: Vec2): void {
    const z = this.zzzs[this.zzzCursor];
    this.zzzCursor = (this.zzzCursor + 1) % ZZZ_POOL_SIZE;
    if (!z) return;
    z.active = true;
    z.ageMs = 0;
    z.baseX = pos.x;
    z.baseY = pos.y;
    z.sprite.visible = true;
    z.sprite.alpha = 0.85;
    z.sprite.position.set(pos.x, pos.y);
  }

  /**
   * Starts (or restarts, via the rolling pool cursor) a feed mote arcing
   * from `from` to `to` — the moment of a feeding (M11). `tint` is amber for
   * a carried mouthful, milk-white for a suckle (Renderer picks the tint off
   * the parent's own feedMode). `delayMs` (M12 task 3, default 0) staggers
   * this mote's start within a burst — see FeedMote.delayMs; the sprite
   * stays hidden at its spawn point until the delay elapses. Never
   * allocates: recycles the oldest pooled sprite exactly like
   * spawnHatch/spawnZ.
   */
  spawnFeedMote(from: Vec2, to: Vec2, tint: number, delayMs = 0): void {
    const m = this.feedMotes[this.feedMoteCursor];
    this.feedMoteCursor = (this.feedMoteCursor + 1) % FEED_MOTE_POOL_SIZE;
    if (!m) return;
    m.active = true;
    m.ageMs = 0;
    m.delayMs = delayMs;
    m.fromX = from.x;
    m.fromY = from.y;
    m.toX = to.x;
    m.toY = to.y;
    m.bowPx = -Math.min(28, Math.hypot(to.x - from.x, to.y - from.y) * 0.35 + 6);
    m.sprite.visible = delayMs <= 0;
    m.sprite.alpha = 1;
    m.sprite.tint = tint;
    m.sprite.position.set(from.x, from.y);
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

  /** A pool of inert, off-screen (alpha 0) sparkle particles, baked once
   * against a tiny 3px texture — `spawnSparkle` is the only thing that ever
   * moves or reveals one. */
  private buildSparkles(renderer: PixiRenderer): void {
    const tex = this.bake(renderer, new Graphics().circle(1.5, 1.5, 1.5).fill(0xffffff), 3, 3);
    for (let i = 0; i < SPARKLE_POOL_SIZE; i++) {
      const particle = new Particle({
        texture: tex,
        x: 0,
        y: 0,
        anchorX: 0.5,
        anchorY: 0.5,
        tint: SPARKLE_TINT,
        alpha: 0,
      });
      this.sparkleLayer.addParticle(particle);
      this.sparkles.push({ particle, active: false, ageMs: 0, lifeMs: SPARKLE_LIFE_MS, baseX: 0, baseY: 0, vx: 0, vy: 0 });
    }
  }

  /** Three baked shell states — whole, cracked, halves — reused by every
   * hatch anywhere in the valley (Ambient's bake-once pattern). */
  private buildHatches(renderer: PixiRenderer): void {
    const W = 20;
    const H = 26;
    const shell = 0xf1ead6;
    const shade = 0xcdbf9c;

    const gWhole = new Graphics().ellipse(W / 2, H / 2, W / 2 - 1, H / 2 - 1).fill(shell);
    const wholeTex = this.bake(renderer, gWhole, W, H);

    const gCracked = new Graphics().ellipse(W / 2, H / 2, W / 2 - 1, H / 2 - 1).fill(shell);
    gCracked
      .moveTo(W * 0.32, H * 0.18)
      .lineTo(W * 0.58, H * 0.42)
      .lineTo(W * 0.34, H * 0.56)
      .lineTo(W * 0.6, H * 0.82)
      .stroke({ color: shade, width: 1.4, join: 'round', cap: 'round' });
    const crackedTex = this.bake(renderer, gCracked, W, H);

    // Two shell halves, tipped apart with a gap between — the moment of hatch.
    const gHalves = new Graphics();
    gHalves
      .moveTo(1, H * 0.46)
      .quadraticCurveTo(W / 2, -H * 0.02, W - 1, H * 0.4)
      .quadraticCurveTo(W * 0.65, H * 0.3, 1, H * 0.46)
      .fill(shell);
    gHalves
      .moveTo(1, H * 0.62)
      .quadraticCurveTo(W * 0.5, H * 0.5, W - 1, H * 0.58)
      .quadraticCurveTo(W / 2, H * 1.04, 1, H * 0.62)
      .fill(shell);
    const halvesTex = this.bake(renderer, gHalves, W, H);

    this.hatchTextures = [wholeTex, crackedTex, halvesTex];
    for (let i = 0; i < HATCH_POOL_SIZE; i++) {
      const sprite = new Sprite(wholeTex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.hatchLayer.addChild(sprite);
      this.hatches.push({ sprite, active: false, ageMs: 0, scale: 1, tint: 0xffffff });
    }
  }

  /** A tiny baked 'z' glyph, reused by every drifting sleep particle. */
  private buildZzzs(renderer: PixiRenderer): void {
    const s = 6;
    const g = new Graphics();
    g.moveTo(0, 0.5)
      .lineTo(s, 0.5)
      .lineTo(0, s - 0.5)
      .lineTo(s, s - 0.5)
      .stroke({ color: 0xf4f7ef, width: 1.3, join: 'round', cap: 'round' });
    const tex = this.bake(renderer, g, s, s);
    for (let i = 0; i < ZZZ_POOL_SIZE; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.zzzLayer.addChild(sprite);
      this.zzzs.push({ sprite, active: false, ageMs: 0, baseX: 0, baseY: 0 });
    }
  }

  /** A tiny baked dot, reused (tint-swapped per spawn) by every feed mote —
   * amber for a carried mouthful, milk-white for a suckle (M11; radius
   * grown 3 -> 5px in M12 task 3 for legibility). */
  private buildFeedMotes(renderer: PixiRenderer): void {
    const d = FEED_MOTE_RADIUS_PX * 2;
    const tex = this.bake(
      renderer,
      new Graphics().circle(FEED_MOTE_RADIUS_PX, FEED_MOTE_RADIUS_PX, FEED_MOTE_RADIUS_PX).fill(0xffffff),
      d,
      d,
    );
    for (let i = 0; i < FEED_MOTE_POOL_SIZE; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.feedMoteLayer.addChild(sprite);
      this.feedMotes.push({
        sprite,
        active: false,
        ageMs: 0,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        bowPx: 0,
        delayMs: 0,
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
