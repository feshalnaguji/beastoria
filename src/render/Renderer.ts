/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M3: the rig pipeline — live skeletal rigs at close zoom (T2), baked sprite
 * frames at mid/world zoom (T1/T0), life-stage proportions, day/night grading.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { getClock, TICKS_PER_DAY, type Clock } from '../sim/clock';
import type { SimEvent } from '../sim/events';
import { SPECIES, speedFor } from '../sim/species';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Creature,
  type LifeStage,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../sim/state';
import { isWater } from '../sim/valley';
import type { ClipName, CreatureRig } from '../rigs/format';
import { ALL_RIGS } from '../rigs/allRigs';
import { Camera } from './Camera';
import { lodTier } from './Lod';
import { bakedFrame, type BakedFrame } from './creatures/RigBaker';
import { buildRig, multiplyTints, type RigInstance } from './creatures/RigRenderer';
import { buildValley } from './terrain/ValleyPainter';
import { AmbientEffects } from './effects/Ambient';
import { Rectangle } from 'pixi.js';

/** Cosmetic-only seed for ambient effect placement — never the sim's RNG. */
const AMBIENT_SEED = 20260815;

const RIGS: Partial<Record<SpeciesId, CreatureRig>> = Object.fromEntries(
  ALL_RIGS.map((r) => [r.species, r]),
);

const FALLBACK_RIG = ALL_RIGS[0] as CreatureRig;
/** Matches src/sim/family.ts MEMORIAL_TICKS — memorials linger two game-days. */
const MEMORIAL_TICKS = 2 * TICKS_PER_DAY;

function rigFor(species: SpeciesId): CreatureRig {
  return RIGS[species] ?? FALLBACK_RIG;
}

interface CreatureView {
  id: number;
  node: Container; // world-positioned, flip container
  rig: RigInstance;
  spriteWrap: Container;
  sprite: Sprite;
  frames: {
    idle: BakedFrame;
    walk: BakedFrame[];
    flap?: BakedFrame[];
    swim?: BakedFrame[];
    eat: BakedFrame;
    sleep: BakedFrame;
    carry: BakedFrame;
    sit: BakedFrame;
  };
  label: Text;
  species: SpeciesId;
  stage: LifeStage;
  prev: Vec2;
  curr: Vec2;
  heading: number;
  activityId: string;
  /** Copied from `c.activity.step` each sync (M9 task 5) — distinguishes
   * feedYoung's two legs (0 fetch, 1 carry home) for clipFor. */
  step: number | undefined;
  /** Copied from `c.activity.minTicks` each sync — the only render-visible
   * signal that separates the mourning 'gather' from its two other reuses
   * (see MOURNING_GATHER_MIN_TICKS). */
  minTicks: number;
  /** World-px nudge applied while brooding at a treeNest home, so the
   * sitter renders in the drawn bowl rather than at the tree's own point
   * (0,0 for every other home kind / non-brooding creature). */
  broodOffsetX: number;
  broodOffsetY: number;
  /** The activity glyph currently showing (or fading out), and its eased
   * alpha — see GLYPH_FADE_MS and glyphKindFor(). */
  glyphKind: GlyphKind | undefined;
  glyphAlpha: number;
  /** Ground distance traveled (world px), wrapped at the rig's strideLength —
   * drives T1 flipbook frame selection off actual displacement, not the
   * wall clock (M9 task 2: cadence must track speed, not glide at a fixed
   * blink rate). */
  odometer: number;
  /** Last frame's rendered (interpolated) position, for computing per-frame
   * displacement into the odometer above. */
  lastX: number;
  lastY: number;
  /** Eased 0 (grounded) .. 1 (airborne) progress toward the flight-lift pose
   * (M9 task 4). Stays at 0 for every non-air-medium species — only
   * mutated when this view's species can fly. */
  liftT: number;
  /** The rig's 'shadow' part's authored local y-offset (constant across
   * stages), cached once so the lift illusion doesn't re-scan rig.parts
   * every frame. */
  shadowBaseY: number;
  /** Duck-only: a baked ripple sprite nested in the rig's shadow container,
   * shown instead of the shadow ellipse while swimming. Undefined for every
   * other species. */
  rippleSprite?: Sprite | undefined;
}

/** Baked walk frames per species (Step 1: symmetric 3-key clips sample
 * identically at t=0.25/0.75, so two "alternating" frames were pixel-twins
 * for 7 of 8 species — sampling off the symmetry points fixes it). */
const N_WALK_FRAMES = 6;
/** T1 flap frames baked at poseT 0 and 0.5 (Step 1 of the brief). */
const N_FLAP_FRAMES = 2;
/** Fallback world px per walk cycle when a rig omits strideLength. */
const DEFAULT_STRIDE_LENGTH = 30;

/** Render-only inference (no sim field): an air-medium species reads as
 * "airborne" once it's covering ground at a real clip — this fraction of
 * its own top speed — filtering out the tiny idle/breathing sway so a
 * standing robin never flickers into a wing-beat. */
const AIRBORNE_SPEED_FRACTION = 0.6;
/** Takeoff/landing ease: the body lift and shadow scale/offset ramp over
 * this many ms in both directions, so neither ever pops. */
const LIFT_EASE_MS = 400;
const LIFT_MAX_PX = 12;
const SHADOW_AIRBORNE_OFFSET_PX = 8;
const SHADOW_AIRBORNE_SCALE = 0.6;
/** Duck swim ripple: gentle scale pulse period. */
const RIPPLE_PULSE_MS = 2400;
const RIPPLE_PULSE_AMPLITUDE = 0.15;

/** M9 task 5: a passing elder's view lingers this long, easing out instead
 * of vanishing on the same frame it leaves state.creatures. */
const PASSING_FADE_MS = 1200;
/** How long a glyph takes to fade in or out when its activity starts/ends. */
const GLYPH_FADE_MS = 300;
/** Glyph radius is screen-compensated (constant apparent size at any zoom),
 * clamped to a sane range of world px. */
const GLYPH_RADIUS_K = 3.5;
const GLYPH_RADIUS_MIN = 4;
const GLYPH_RADIUS_MAX = 14;
/** World-px slack around the viewport a glyph may sit in before it's culled
 * as off-screen — generous enough that a glyph never pops in/out at the edge. */
const GLYPH_CULL_MARGIN = 60;
/**
 * Matches src/sim/family.ts PASS_GATHER_TICKS. The 'gather' activity is
 * reused for three different family moments (mourning a passing elder,
 * settling onto a new nest, herding a wandering baby home) that the sim
 * doesn't otherwise distinguish; mourning is the only one with this long a
 * minTicks (30 for the other two), so it cleanly separates the "mourning
 * circle" glyph without any sim change.
 */
const MOURNING_GATHER_MIN_TICKS = 200;
/** Matches the treeNest bowl's draw offset from home.pos (syncHomes, the
 * 'treeNest' case below) — a brooding sitter renders here instead of at the
 * home's own point, so it visibly sits IN the bowl. */
const TREE_NEST_BOWL_OFFSET: Vec2 = { x: 38, y: 26 };
/** Event kinds that spawn a moment sparkle (M9 task 5). 'reborn' added in the
 * final-review fix wave (fix 3) — the phoenix's rebirth deserves the same
 * sparkle as a hatch or birth. */
const SPARKLE_EVENT_KINDS = new Set<SimEvent['kind']>(['hatched', 'born', 'paired', 'reborn']);

/** Small, gentle activity glyphs floating above a creature's crown — the
 * valley's readable vocabulary for its richest loops (M9 task 5). */
type GlyphKind = 'forage' | 'nap' | 'court' | 'carry' | 'brood' | 'mourning';

/** A view mid-fade after leaving state.creatures (M9 task 5's gentle
 * passing) — drained in the render loop rather than destroyed same-frame. */
interface FadingView {
  view: CreatureView;
  remainingMs: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Activity labels this close to a home carrying a family label are hidden
 * (at zoom < 1.5) — the family label wins, per M5 declutter carry-forward. */
const HOME_LABEL_HIDE_RADIUS = 55;
const HOME_LABEL_HIDE_ZOOM = 1.5;

/** Roughly the crown of each species' rig, for label placement. */
const LABEL_HEIGHT: Record<SpeciesId, number> = {
  rabbit: -70,
  robin: -46,
  deer: -120,
  duck: -52,
  koi: -34,
  owl: -70,
  dodo: -70,
  phoenix: -110,
  squirrel: -46,
  frog: -30,
  turtle: -22,
};

/** Day/night multiply-tint ramp, keyed by fraction of day. */
const NIGHT = 0x7580b0;
const TINT_RAMP: [number, number][] = [
  [0.0, NIGHT],
  [0.05, 0xffd9b0], // dawn gold
  [0.1, 0xffffff],
  [0.53, 0xffffff],
  [0.575, 0xffbe8f], // dusk gold
  [0.615, 0xc79a8f],
  [0.66, NIGHT],
  [1.0, NIGHT],
];

export class Renderer {
  private app!: Application;
  private world!: Container;
  private camera!: Camera;
  private groundSprite!: Sprite;
  private detailLayer!: Container;
  private creatureLayer!: Container;
  /** One Graphics redrawn every frame with the small activity glyphs — leaf
   * dot, crescent, rose arcs, etc (M9 task 5). */
  private glyphLayer!: Graphics;
  private homeLayer!: Graphics;
  private memorialLayer!: Graphics;
  private homeLabelLayer!: Container;
  private homeLabels = new Map<number, Text>();
  /** Home positions (not label positions) for homes with an active family
   * label, kept alongside homeLabels for the activity-label declutter check. */
  private homeLabelPos = new Map<number, Vec2>();
  private nightOverlay!: Graphics;
  private glowOverlay!: Graphics;
  private ambient!: AmbientEffects;
  private views = new Map<number, CreatureView>();
  /** Views that have left state.creatures but are still easing out
   * (M9 task 5's gentle passing) — drained each rendered frame. */
  private fading: FadingView[] = [];
  /** eventLog is a tick-stamped ring buffer, not an index-stable one (it
   * shifts once past its cap) — tracking the last-seen TICK, not an index,
   * is what makes moment-sparkle consumption exactly-once and safe across
   * both live play (one sync per tick) and offline catch-up (one sync after
   * many ticks). -1 until the first sync, which seeds it from state.tick
   * without spawning anything for a save's entire history (M9 task 5). */
  private lastSeenEventTick = -1;
  private eventsInitialized = false;
  private clock: Clock = getClock(0);
  private lastFrameTime = 0;
  /** Baked once (Ambient's bake-once pattern): a duck's swim ripple. */
  private rippleTexture!: Texture;
  /** Reused every frame's swimming check — avoids allocating a Vec2 literal
   * per creature per frame just to call isWater(). */
  private readonly scratchPos: Vec2 = { x: 0, y: 0 };

  /** Show per-creature activity labels (toggled from the DevPanel). */
  debugLabels = true;

  /** Creature id the camera should track (DevPanel click-to-follow). */
  followId: number | null = null;

  async init(mount: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: 0x87a96b,
      resizeTo: mount,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      // Single render loop: GameLoop drives one requestAnimationFrame and
      // calls renderFrame() explicitly after camera/ambient updates. Without
      // this, Pixi's own ticker renders on its own rAF registration — which
      // (registered during init(), before GameLoop.start()) fires BEFORE
      // GameLoop's callback each frame, drawing the camera's *previous*
      // frame position and adding a full frame of input latency.
      autoStart: false,
    });
    mount.appendChild(this.app.canvas);

    this.world = new Container();
    this.app.stage.addChild(this.world);

    // Valley: bake the soft ground washes once; keep detail as crisp vectors.
    const { ground, detail } = buildValley();
    const groundTexture = this.app.renderer.generateTexture({
      target: ground,
      resolution: 0.5, // soft painterly bake — half res is a feature here
      frame: new Rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT),
    });
    ground.destroy(true);
    this.groundSprite = new Sprite(groundTexture);
    this.detailLayer = detail;
    this.homeLayer = new Graphics();
    this.memorialLayer = new Graphics();
    this.homeLabelLayer = new Container();
    this.creatureLayer = new Container();
    this.glyphLayer = new Graphics();
    this.ambient = new AmbientEffects(this.world, AMBIENT_SEED);
    this.world.addChild(
      this.groundSprite,
      this.ambient.shimmerLayer, // above ground, below memorials
      this.memorialLayer,
      this.homeLayer,
      this.detailLayer,
      this.ambient.grassLayer, // above terrain detail
      this.ambient.dappleLayer,
      this.creatureLayer,
      this.glyphLayer, // activity glyphs, above creature bodies
      this.ambient.sparkleLayer, // moment sparkles
      this.ambient.fireflyLayer, // above creatures
      this.homeLabelLayer,
    );
    this.ambient.build(this.app.renderer);
    this.rippleTexture = this.bakeRippleTexture();

    // Screen-space ambience: warm additive glow (dawn/dusk) + night wash.
    this.glowOverlay = new Graphics();
    this.glowOverlay.blendMode = 'add';
    this.nightOverlay = new Graphics();
    this.app.stage.addChild(this.glowOverlay, this.nightOverlay);

    this.camera = new Camera(this.world, this.app.canvas);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  centerOn(x: number, y: number, zoom?: number): void {
    this.camera.centerOn(x, y, zoom);
  }

  /**
   * World-space view center + zoom, for the audio mixer. `Camera.toWorld`
   * expects CSS-pixel screen coordinates (it works from `getBoundingClientRect()`,
   * which is CSS pixels, same space as pointer events' clientX/clientY — see
   * `pickCreature` below, which forwards raw client coords unmodified).
   * `this.app.renderer.width/height` are DEVICE pixels (the drawing-buffer size;
   * with `autoDensity: true` the canvas's CSS size is that divided by
   * `resolution`), so we divide by `this.app.renderer.resolution` first to get
   * back to CSS pixels before asking for the canvas center. The #app canvas
   * fills the full viewport at (0,0) (see index.html), so this canvas-center
   * point resolves to exactly the camera's own (x, y) target.
   */
  viewInfo(): { x: number; y: number; zoom: number } {
    const c = this.camera.toWorld(
      this.app.renderer.width / this.app.renderer.resolution / 2,
      this.app.renderer.height / this.app.renderer.resolution / 2,
    );
    return { x: c.x, y: c.y, zoom: this.camera.getZoom() };
  }

  /** Nearest creature to a screen point, within a world-space radius. */
  pickCreature(state: WorldState, screenX: number, screenY: number): Creature | undefined {
    const w = this.camera.toWorld(screenX, screenY);
    const radius = 80 / Math.max(0.2, this.camera.getZoom());
    let best: Creature | undefined;
    let bestDist = radius;
    for (const c of state.creatures) {
      const d = Math.hypot(c.pos.x - w.x, c.pos.y - w.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  /** Snapshot creature state after each sim tick (curr → prev, sim → curr). */
  sync(state: WorldState): void {
    this.clock = getClock(state.tick);
    const alive = new Set<number>();
    for (const c of state.creatures) {
      alive.add(c.id);
      let view = this.views.get(c.id);
      if (!view) {
        view = this.createView(c);
        this.views.set(c.id, view);
        this.creatureLayer.addChild(view.node);
      } else if (view.stage !== c.stage) {
        this.applyStage(view, c.stage); // creatures grow up
      }
      view.prev.x = view.curr.x;
      view.prev.y = view.curr.y;
      view.curr.x = c.pos.x;
      view.curr.y = c.pos.y;
      view.heading = c.heading;
      view.activityId = c.activity.id;
      view.step = c.activity.step;
      view.minTicks = c.activity.minTicks;
      const offset = c.activity.id === 'brood' ? this.broodOffsetFor(state, c) : undefined;
      view.broodOffsetX = offset?.x ?? 0;
      view.broodOffsetY = offset?.y ?? 0;
    }
    // Creatures who have passed ease out instead of vanishing same-frame —
    // see this.fading, drained in render() (M9 task 5).
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        this.views.delete(id);
        if (this.followId === id) this.followId = null;
        this.fading.push({ view, remainingMs: PASSING_FADE_MS });
      }
    }
    this.syncHomes(state);
    this.syncMemorials(state);
    this.ambient.setMemorialAnchors(state.memorials.map((m) => m.pos));
    this.consumeNewEvents(state);
  }

  /** A brooding sitter at a treeNest home renders offset into the drawn
   * nest bowl (Renderer's own +38,+26 in syncHomes' 'treeNest' case) rather
   * than at the home's own point — every other home kind draws its nest
   * right at home.pos, so no offset applies. */
  private broodOffsetFor(state: WorldState, c: Creature): Vec2 | undefined {
    if (c.familyId === null) return undefined;
    const fam = state.families.find((f) => f.id === c.familyId);
    if (!fam || fam.homeId === null) return undefined;
    const home = state.homes.find((h) => h.id === fam.homeId);
    return home?.kind === 'treeNest' ? TREE_NEST_BOWL_OFFSET : undefined;
  }

  /**
   * Spawns a moment sparkle for every hatch/birth/pairing event since the
   * last sync. eventLog is tick-stamped, so filtering by
   * `tick > lastSeenEventTick` (rather than tracking an array index) stays
   * correct even though the log is a ring buffer that shifts once past its
   * cap, and consumes each event exactly once whether sync runs once per
   * tick (live play) or once after a whole offline catch-up drain (many
   * ticks, one call) — see main.ts / CatchUp.ts.
   */
  private consumeNewEvents(state: WorldState): void {
    if (!this.eventsInitialized) {
      // First sync ever (boot, before any tick has run): a loaded save's
      // entire event history is already "seen" — nothing sparkles retroactively.
      this.eventsInitialized = true;
      this.lastSeenEventTick = state.tick;
      return;
    }
    const log = state.eventLog;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (!e || e.tick <= this.lastSeenEventTick) break;
      this.spawnMomentSparkle(state, e);
    }
    this.lastSeenEventTick = state.tick;
  }

  private spawnMomentSparkle(state: WorldState, e: SimEvent): void {
    if (!SPARKLE_EVENT_KINDS.has(e.kind)) return;
    // 'paired' carries no pos (the pair hasn't claimed a home yet) — fall
    // back to either member's current position, looked up by familyId.
    const pos = e.pos ?? state.creatures.find((c) => c.familyId === e.familyId)?.pos;
    if (!pos) return;
    this.ambient.spawnSparkle(pos);
  }

  /** Burrows, nests (with eggs while expecting), and family name labels. */
  private syncHomes(state: WorldState): void {
    const g = this.homeLayer.clear();
    const famById = new Map(state.families.map((f) => [f.id, f]));

    for (const home of state.homes) {
      const fam = home.familyId === null ? undefined : famById.get(home.familyId);
      switch (home.kind) {
        case 'burrow': {
          // Earth mound with a cozy dark entrance.
          g.ellipse(home.pos.x, home.pos.y + 8, 42, 16).fill({ color: 0x9b7e5e, alpha: 0.9 });
          g.ellipse(home.pos.x, home.pos.y - 2, 34, 18).fill({ color: 0xaa8d6a, alpha: 0.95 });
          g.ellipse(home.pos.x, home.pos.y + 4, 15, 10).fill(0x4a3826);
          g.ellipse(home.pos.x - 26, home.pos.y + 10, 8, 3).fill({ color: 0x7da861, alpha: 0.8 });
          g.ellipse(home.pos.x + 28, home.pos.y + 12, 9, 3).fill({ color: 0x7da861, alpha: 0.8 });
          break;
        }
        case 'treeNest': {
          // Twig nest bowl at the tree's foot.
          const nx = home.pos.x + 38;
          const ny = home.pos.y + 26;
          g.ellipse(nx, ny, 20, 9).fill(0x8a6f4d);
          g.ellipse(nx, ny - 2, 15, 6).fill(0x6d563a);
          if (fam?.phase === 'expecting') {
            // Speckled eggs peeking out of the bowl.
            g.ellipse(nx - 5, ny - 4, 4, 5).fill(0xcfe4e8);
            g.ellipse(nx + 3, ny - 5, 4, 5).fill(0xd8ebee);
            g.ellipse(nx + 0.5, ny - 2, 4, 5).fill(0xc8dfe4);
          }
          break;
        }
        case 'reedNest': { // grassy bowl tucked in the reeds
          g.ellipse(home.pos.x, home.pos.y, 22, 10).fill(0xb5a068);
          g.ellipse(home.pos.x, home.pos.y - 2, 16, 7).fill(0x8f7c4e);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 4, home.pos.y - 3, 4.5, 5.5).fill(0xe8e2ce);
            g.ellipse(home.pos.x + 4, home.pos.y - 4, 4.5, 5.5).fill(0xefe9d6);
          }
          break;
        }
        case 'lilyPatch': { // koi spawning bed among the pads
          g.circle(home.pos.x - 10, home.pos.y, 16).fill({ color: 0x5f9451, alpha: 0.95 });
          g.circle(home.pos.x + 14, home.pos.y + 8, 12).fill({ color: 0x6da05a, alpha: 0.9 });
          g.circle(home.pos.x + 4, home.pos.y - 10, 5).fill({ color: 0xf2d8e4 }); // blossom
          if (fam?.phase === 'expecting') {
            for (let i = 0; i < 5; i++) { // roe: tiny amber beads
              g.circle(home.pos.x - 14 + i * 6, home.pos.y + 12, 2).fill({ color: 0xf0c060, alpha: 0.9 });
            }
          }
          break;
        }
        case 'treeHollow': { // a cozy dark hollow in an old trunk
          g.roundRect(home.pos.x - 12, home.pos.y - 30, 24, 46, 10).fill(0x6b4e38);
          g.ellipse(home.pos.x, home.pos.y - 10, 8, 11).fill(0x2e2018);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 2, home.pos.y - 5, 3.5, 4.5).fill(0xf3efe4);
            g.ellipse(home.pos.x + 3, home.pos.y - 6, 3.5, 4.5).fill(0xeae5d8);
          }
          break;
        }
        case 'glade': { // flattened-grass deer bed
          g.ellipse(home.pos.x, home.pos.y, 46, 22).fill({ color: 0xa8bd7e, alpha: 0.7 });
          g.ellipse(home.pos.x, home.pos.y, 32, 14).fill({ color: 0xc0cf94, alpha: 0.8 });
          break;
        }
        case 'groundNest': { // dodo's ring of twigs on the forest floor
          g.ellipse(home.pos.x, home.pos.y, 24, 12).fill(0x8a6f4d);
          g.ellipse(home.pos.x, home.pos.y, 16, 8).fill(0xa89066);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x, home.pos.y - 2, 6, 7).fill(0xf1ead6); // one grand egg
          }
          break;
        }
        case 'groveNest': { // the phoenix nest: warm stones, faint glow
          g.ellipse(home.pos.x, home.pos.y + 4, 30, 12).fill({ color: 0xffdda6, alpha: 0.35 });
          g.ellipse(home.pos.x, home.pos.y, 20, 9).fill(0xb59a72);
          g.ellipse(home.pos.x, home.pos.y - 2, 13, 6).fill(0x8f7752);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x, home.pos.y - 3, 5, 6.5).fill(0xf4d03f); // the golden egg
            g.ellipse(home.pos.x, home.pos.y - 3, 8, 9).fill({ color: 0xffb36b, alpha: 0.3 });
          }
          break;
        }
        case 'drey': { // a twiggy ball nest woven onto a trunk, high in the canopy
          const dx = home.pos.x;
          const ballY = home.pos.y - 18;
          // Trunk stub beneath the ball (bark brown, echoing treeHollow's
          // trunk below) — review fix: the ball no longer floats with
          // nothing under it (M10 task 3 justification table row 2).
          g.roundRect(dx - 4, home.pos.y - 8, 8, 14, 3).fill(0x6b4e38);
          // The ball's own topmost extent is capped at home.pos.y - 30 —
          // exactly treeHollow's ceiling below — so it clears the family
          // label's fixed anchor at home.pos.y - 34 with the same 4px
          // clearance every other home kind already keeps (review fix).
          g.circle(dx, ballY + 4, 13).fill(0x6d563a);
          g.circle(dx, ballY, 12).fill(0x8a6f4d);
          g.circle(dx - 3, ballY - 4, 5).fill({ color: 0xa89066, alpha: 0.85 });
          if (fam?.phase === 'expecting') {
            g.ellipse(dx - 2, ballY - 1, 3, 4).fill(0xf1ead6);
            g.ellipse(dx + 2, ballY - 2, 3, 4).fill(0xe8e2ce);
          }
          break;
        }
        case 'spawnClump': { // frog spawn: a jelly clump among the reeds
          g.ellipse(home.pos.x, home.pos.y + 4, 20, 8).fill({ color: 0x5f9451, alpha: 0.5 });
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            g.circle(home.pos.x + Math.cos(ang) * 7, home.pos.y + Math.sin(ang) * 5, 3.2).fill({
              color: 0xd8e8c8,
              alpha: 0.75,
            });
          }
          g.circle(home.pos.x, home.pos.y, 3.5).fill({ color: 0xc4d9a8, alpha: 0.85 });
          if (fam?.phase === 'expecting') {
            g.circle(home.pos.x, home.pos.y - 1, 2).fill(0x3a3230);
          }
          break;
        }
        case 'sandNest': { // turtle's small sand mound scooped into the shore
          g.ellipse(home.pos.x, home.pos.y + 6, 26, 10).fill({ color: 0xdcc9a0, alpha: 0.9 });
          g.ellipse(home.pos.x, home.pos.y, 18, 8).fill({ color: 0xe8d8b0, alpha: 0.95 });
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 4, home.pos.y - 1, 3.5, 3).fill(0xf1ead6);
            g.ellipse(home.pos.x + 4, home.pos.y - 1, 3.5, 3).fill(0xe8e2ce);
          }
          break;
        }
        default: {
          const _exhaustive: never = home.kind;
          void _exhaustive;
        }
      }
    }

    // Family name labels above claimed homes.
    const claimed = new Set<number>();
    for (const home of state.homes) {
      if (home.familyId === null) continue;
      const fam = famById.get(home.familyId);
      if (!fam) continue;
      claimed.add(home.id);
      let label = this.homeLabels.get(home.id);
      if (!label) {
        label = new Text({
          text: '',
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fill: 0xfffbee,
            stroke: { color: 0x4a4232, width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        this.homeLabels.set(home.id, label);
        this.homeLabelLayer.addChild(label);
      }
      label.text = `The ${familyName(fam.id)} family`;
      label.position.set(home.pos.x, home.pos.y - 34);
      this.homeLabelPos.set(home.id, home.pos);
    }
    for (const [homeId, label] of this.homeLabels) {
      if (!claimed.has(homeId)) {
        label.destroy();
        this.homeLabels.delete(homeId);
        this.homeLabelPos.delete(homeId);
      }
    }
  }

  /** Soft flower clusters where elders have peacefully passed. */
  private syncMemorials(state: WorldState): void {
    const g = this.memorialLayer.clear();
    for (const m of state.memorials) {
      // Bloom fresh, linger, then fade back into the meadow as they age.
      const age = state.tick - m.tick;
      const fade = Math.max(0.15, 1 - age / MEMORIAL_TICKS);
      if (m.species === 'phoenix') {
        // Soft embers, not flowers — the site of a rebirth.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + m.tick * 0.13;
          const r = 5 + ((m.tick + i * 29) % 10);
          g.circle(m.pos.x + Math.cos(a) * r, m.pos.y + Math.sin(a) * r * 0.7, 2.4).fill({
            color: i % 2 === 0 ? 0xf4d03f : 0xd96b35,
            alpha: 0.85 * fade,
          });
        }
        g.circle(m.pos.x, m.pos.y, 3).fill({ color: 0xffdda6, alpha: 0.9 * fade });
        continue;
      }
      const petals = [0xf2d8e4, 0xfdf6b8, 0xe8eef5, 0xf4cddd];
      for (let i = 0; i < 7; i++) {
        // Position petals deterministically off the memorial's own data.
        const a = (i / 7) * Math.PI * 2 + m.tick * 0.1;
        const r = 6 + ((m.tick + i * 37) % 14);
        const color = petals[(m.tick + i) % petals.length] ?? 0xf2d8e4;
        g.circle(m.pos.x + Math.cos(a) * r, m.pos.y + Math.sin(a) * r * 0.7, 3.2).fill({
          color,
          alpha: 0.95 * fade,
        });
      }
      g.circle(m.pos.x, m.pos.y, 2.6).fill({ color: 0xfdf6b8, alpha: 0.9 * fade });
    }
  }

  /** Draw one frame, interpolating between the last two sim snapshots. */
  render(alpha: number): void {
    const now = performance.now();
    const dtMs = this.lastFrameTime === 0 ? 16 : Math.min(now - this.lastFrameTime, 100);
    this.lastFrameTime = now;

    this.updateFading(dtMs);

    const zoom = this.camera.getZoom();
    const tier = lodTier(zoom);
    const grade = rampColor(TINT_RAMP, this.clock.dayT);

    // Glyph culling bounds (world space), computed once per frame rather
    // than per creature — see the on-screen check at the bottom of the
    // per-view loop below (M9 task 5).
    const camCX = this.camera.getCenterX();
    const camCY = this.camera.getCenterY();
    const cw = this.app.renderer.width / this.app.renderer.resolution;
    const ch = this.app.renderer.height / this.app.renderer.resolution;
    const glyphHalfW = cw / 2 / zoom + GLYPH_CULL_MARGIN;
    const glyphHalfH = ch / 2 / zoom + GLYPH_CULL_MARGIN;
    const glyphRadius = clamp(GLYPH_RADIUS_K / zoom, GLYPH_RADIUS_MIN, GLYPH_RADIUS_MAX);
    this.glyphLayer.clear();

    for (const view of this.views.values()) {
      const x = view.prev.x + (view.curr.x - view.prev.x) * alpha;
      const y = view.prev.y + (view.curr.y - view.prev.y) * alpha;
      const tickDisp = Math.hypot(view.curr.x - view.prev.x, view.curr.y - view.prev.y);
      const moving = tickDisp > 0.5;

      // Render-only presentation inference (no sim field — M9 task 4): an
      // air-medium species reads as "airborne" once its per-tick
      // displacement is a real fraction of its own top speed (filters out
      // idle sway); an amphibious species reads as "swimming" straight off
      // the interpolated position via the sim's own isWater geometry.
      const speciesParams = SPECIES[view.species];
      const airborneNow =
        speciesParams.medium === 'air' &&
        moving &&
        tickDisp >= AIRBORNE_SPEED_FRACTION * speedFor(view.species, view.stage);
      this.scratchPos.x = x;
      this.scratchPos.y = y;
      const swimming = speciesParams.medium === 'amphibious' && isWater(this.scratchPos);

      // Ease the flight lift toward its target over LIFT_EASE_MS, both ways,
      // so takeoff/landing never pop. Stays pinned at 0 for every species
      // that never goes airborne (liftTarget is always 0 for them).
      const liftTarget = airborneNow ? 1 : 0;
      if (view.liftT < liftTarget) view.liftT = Math.min(liftTarget, view.liftT + dtMs / LIFT_EASE_MS);
      else if (view.liftT > liftTarget) view.liftT = Math.max(liftTarget, view.liftT - dtMs / LIFT_EASE_MS);
      const liftEase = view.liftT * view.liftT * (3 - 2 * view.liftT); // smoothstep, matches Animator's sample()
      const liftPx = tier === 2 ? -LIFT_MAX_PX * liftEase : 0; // only the live T2 rig actually lifts

      // A brooding sitter at a treeNest home nudges into the drawn bowl
      // (broodOffsetX/Y, set in sync() — zero for every other case).
      view.node.position.set(x + view.broodOffsetX, y + view.broodOffsetY + liftPx);
      const facingLeft = Math.cos(view.heading) < 0;
      view.node.scale.x = facingLeft ? -1 : 1;
      // A passing elder softens — the gentlest farewell.
      view.node.alpha = view.activityId === 'pass' ? 0.75 : 1;

      // Ground-truth stride: accumulate actual rendered displacement (not
      // wall-clock) and wrap at the rig's stride length, so gait cadence
      // tracks speed exactly at any sim rate (1x, 8x, 64x) with free
      // per-creature desync (no shared clock). One float add + one mod per
      // view — no allocations.
      const speciesRig = rigFor(view.species);
      const stride = speciesRig.strideLength ?? DEFAULT_STRIDE_LENGTH;
      const dispPx = Math.hypot(x - view.lastX, y - view.lastY);
      view.lastX = x;
      view.lastY = y;
      view.odometer = (view.odometer + dispPx) % stride;

      // Single source of truth for which pose to show, shared by T2's live
      // rig and T1's baked-frame cascade below (M9 task 5's clipFor fix —
      // moving now outranks brood/nap, so a sitter still walking to the
      // nest reads as walking, not asleep mid-stride).
      const clip = clipFor(view.activityId, moving, airborneNow, swimming, view.step);

      if (tier === 2) {
        view.rig.root.visible = true;
        view.spriteWrap.visible = false;
        view.rig.animator.play(clip);
        // A flying carrier ferries food home too, but clipFor deliberately
        // keeps 'flap' as the airborne pose (a ground carry pose mid-air
        // would look broken) — so hideInClips alone would hide the food the
        // whole flight. Override it explicitly here, every frame, since
        // `step` can flip 0→1 mid-flap without a clip switch (play()'s
        // early-return skips applyClipVisibility when the clip name is
        // unchanged) (final-review fix wave, fix 2).
        if (view.rig.food && clip === 'flap') view.rig.food.visible = view.step === 1;
        let rate = 1;
        if (clip === 'walk' && dtMs > 0) {
          const walkDurMs = speciesRig.clips.walk.durationMs;
          rate = clamp(((dispPx / dtMs) * walkDurMs) / stride, 0, 2.5);
        }
        view.rig.animator.update(dtMs * rate);
        const tint = multiplyTints(view.rig.stageTint, grade);
        for (const g of view.rig.tintables) g.tint = tint;

        // Flight-lift shadow illusion: the same eased progress that lifted
        // the body above scales/drops the shadow, so it visibly detaches
        // and reattaches with the body instead of snapping.
        if (view.rig.shadow) {
          view.rig.shadow.scale.set(1 - (1 - SHADOW_AIRBORNE_SCALE) * liftEase);
          view.rig.shadow.position.y = view.shadowBaseY + SHADOW_AIRBORNE_OFFSET_PX * liftEase;
        }

        // Duck swim: the shadow ellipse hands off to a baked ripple sprite
        // (already nested in the same container) with a gentle scale pulse.
        if (view.rippleSprite) {
          view.rippleSprite.visible = swimming;
          if (view.rig.shadowGraphic) view.rig.shadowGraphic.visible = !swimming;
          if (swimming) {
            const pulse = 1 + RIPPLE_PULSE_AMPLITUDE * Math.sin((now / RIPPLE_PULSE_MS) * Math.PI * 2);
            view.rippleSprite.scale.set(pulse);
          }
        }
      } else {
        view.rig.root.visible = false;
        view.spriteWrap.visible = true;
        // T1 flipbook: the same clip drives frame choice as T2 — flap/swim/
        // walk stay distance-driven (multi-frame), carry/sit/sleep/eat show
        // their single mid-pose bake (M9 task 5), and social/idle keep the
        // pre-existing idle fallback. T0 (tier 0) always stays on idle.
        let frame = view.frames.idle;
        if (tier === 1) {
          if (clip === 'flap' && view.frames.flap) {
            const flapIdx = Math.floor((view.odometer / stride) * N_FLAP_FRAMES) % N_FLAP_FRAMES;
            frame = view.frames.flap[flapIdx] ?? view.frames.idle;
          } else if (clip === 'swim' && view.frames.swim) {
            frame = view.frames.swim[0] ?? view.frames.idle;
          } else if (clip === 'walk') {
            const frameIndex = Math.floor((view.odometer / stride) * N_WALK_FRAMES) % N_WALK_FRAMES;
            frame = view.frames.walk[frameIndex] ?? view.frames.idle;
          } else if (clip === 'carry') {
            frame = view.frames.carry;
          } else if (clip === 'sit') {
            frame = view.frames.sit;
          } else if (clip === 'sleep') {
            frame = view.frames.sleep;
          } else if (clip === 'eat') {
            frame = view.frames.eat;
          }
        }
        view.sprite.texture = frame.texture;
        view.sprite.position.set(frame.bx, frame.by);
        view.sprite.tint = grade;
      }

      view.label.visible = this.debugLabels && tier === 2;
      if (view.label.visible && zoom < HOME_LABEL_HIDE_ZOOM) {
        // Family label wins: don't stack an activity label on top of it.
        for (const pos of this.homeLabelPos.values()) {
          if (Math.hypot(view.curr.x - pos.x, view.curr.y - pos.y) < HOME_LABEL_HIDE_RADIUS) {
            view.label.visible = false;
            break;
          }
        }
      }
      if (view.label.visible) {
        view.label.text = view.activityId === 'nap' ? 'nap 💤' : view.activityId;
        view.label.scale.x = facingLeft ? -1 : 1;
      }

      // Activity glyph: ease alpha toward the desired kind (0 if none), and
      // only ever swap kinds once fully faded out — see the field comment
      // on CreatureView.glyphKind. Drawn only when visible and on-screen.
      const desiredGlyph = glyphKindFor(view.activityId, view.step, view.minTicks);
      if (desiredGlyph !== view.glyphKind && view.glyphAlpha <= 0) view.glyphKind = desiredGlyph;
      const glyphTarget = desiredGlyph !== undefined && view.glyphKind === desiredGlyph ? 1 : 0;
      if (view.glyphAlpha < glyphTarget) {
        view.glyphAlpha = Math.min(glyphTarget, view.glyphAlpha + dtMs / GLYPH_FADE_MS);
      } else if (view.glyphAlpha > glyphTarget) {
        view.glyphAlpha = Math.max(glyphTarget, view.glyphAlpha - dtMs / GLYPH_FADE_MS);
      }
      if (view.glyphKind !== undefined && view.glyphAlpha > 0) {
        const onscreen =
          x > camCX - glyphHalfW && x < camCX + glyphHalfW && y > camCY - glyphHalfH && y < camCY + glyphHalfH;
        if (onscreen) {
          const stageScale = speciesRig.stages[view.stage].scale;
          const crownX = x + view.broodOffsetX;
          const crownY = y + view.broodOffsetY + LABEL_HEIGHT[view.species] * stageScale;
          this.drawGlyph(view.glyphKind, crownX, crownY, glyphRadius, view.glyphAlpha);
        }
      }
    }

    this.homeLabelLayer.visible = tier >= 1;

    const followed = this.followId === null ? undefined : this.views.get(this.followId);
    if (followed) this.camera.centerOn(followed.curr.x, followed.curr.y);

    this.applyOverlays();
    this.camera.update(dtMs);
    // Zoom is the only view value AmbientEffects consumes — pass it directly
    // (no-alloc) rather than round-tripping through viewInfo(), which builds
    // two object literals and calls getBoundingClientRect() per call and was
    // designed for the 10Hz audio mixer, not this 60Hz render loop.
    this.ambient.update(dtMs, this.clock, this.camera.getZoom());
  }

  /** Draw the current stage to the canvas. Call once per rendered frame,
   * after render(alpha) (and anything else that mutates Pixi objects this
   * frame) — see GameLoop's render callback in main.ts. */
  renderFrame(): void {
    this.app.render();
  }

  /**
   * Eases each passed creature's view out over PASSING_FADE_MS and destroys
   * it once fully faded, instead of the same-frame destroy sync() used to
   * do — the gentlest farewell (M9 task 5). Iterates backward so mid-loop
   * splices never skip an entry.
   */
  private updateFading(dtMs: number): void {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      if (!f) continue;
      f.remainingMs -= dtMs;
      if (f.remainingMs <= 0) {
        f.view.node.destroy({ children: true });
        this.fading.splice(i, 1);
        continue;
      }
      // Fades from the settled 'pass' alpha (0.75, see render()'s per-view
      // alpha line) down to fully transparent.
      f.view.node.alpha = 0.75 * (f.remainingMs / PASSING_FADE_MS);
    }
  }

  /**
   * Draws one small, gentle activity glyph into glyphLayer — the valley's
   * readable vocabulary for forage/nap/court/carry/brood/mourning (M9 task
   * 5). Called only for on-screen, alpha>0 views; glyphLayer.clear() runs
   * once per frame in render(), so every call here is additive within the
   * frame. Shapes are deliberately simple (circle/ellipse/arc-stroke) —
   * small and desaturated, never saturated or fussy.
   */
  private drawGlyph(kind: GlyphKind, cx: number, cy: number, r: number, alpha: number): void {
    const g = this.glyphLayer;
    switch (kind) {
      case 'forage':
        g.circle(cx, cy, r * 0.55).fill({ color: 0x8fae5c, alpha: 0.85 * alpha });
        break;
      case 'nap':
        // A crescent moon, approximated as a short curved stroke.
        strokeArc(g, cx, cy, r * 0.62, -Math.PI * 0.55, Math.PI * 0.55, 0xbcd6e8, r * 0.5, 0.8 * alpha);
        break;
      case 'court':
        strokeArc(g, cx - r * 0.32, cy, r * 0.4, Math.PI * 0.15, Math.PI * 1.35, 0xdf9fb0, r * 0.28, 0.85 * alpha);
        strokeArc(g, cx + r * 0.32, cy, r * 0.4, Math.PI * 1.65, Math.PI * 2.85, 0xdf9fb0, r * 0.28, 0.85 * alpha);
        break;
      case 'carry':
        g.circle(cx, cy, r * 0.5).fill({ color: 0xe8a53c, alpha: 0.85 * alpha });
        break;
      case 'brood':
        g.ellipse(cx, cy, r * 0.62, r * 0.44).fill({ color: 0xf3e9d2, alpha: 0.85 * alpha });
        break;
      case 'mourning':
        g.ellipse(cx, cy, r * 0.4, r * 0.64).fill({ color: 0xb3aebd, alpha: 0.75 * alpha });
        break;
    }
  }

  private createView(c: Creature): CreatureView {
    const node = new Container();
    const rig = buildRig(rigFor(c.species), c.stage);
    const spriteWrap = new Container();
    const sprite = new Sprite();
    spriteWrap.addChild(sprite);
    node.addChild(rig.root, spriteWrap);

    // Duck-only: a ripple sprite nested in the shadow container, hidden
    // until this duck is swimming (M9 task 4).
    let rippleSprite: Sprite | undefined;
    if (c.species === 'duck') {
      rippleSprite = new Sprite(this.rippleTexture);
      rippleSprite.anchor.set(0.5);
      rippleSprite.visible = false;
      rig.shadow?.addChild(rippleSprite);
    }

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0xffffff,
        stroke: { color: 0x2c3a26, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    node.addChild(label);

    const view: CreatureView = {
      id: c.id,
      node,
      rig,
      spriteWrap,
      sprite,
      frames: this.bakeFrames(c.species, c.stage),
      label,
      species: c.species,
      stage: c.stage,
      prev: { x: c.pos.x, y: c.pos.y },
      curr: { x: c.pos.x, y: c.pos.y },
      heading: c.heading,
      activityId: c.activity.id,
      step: c.activity.step,
      minTicks: c.activity.minTicks,
      broodOffsetX: 0,
      broodOffsetY: 0,
      glyphKind: undefined,
      glyphAlpha: 0,
      odometer: 0,
      lastX: c.pos.x,
      lastY: c.pos.y,
      liftT: 0,
      shadowBaseY: rigFor(c.species).parts.find((p) => p.id === 'shadow')?.y ?? 0,
      rippleSprite,
    };
    this.positionLabel(view);
    return view;
  }

  /** Swap rig + baked frames when a creature grows into its next stage. */
  private applyStage(view: CreatureView, stage: LifeStage): void {
    view.stage = stage;
    // Detach the persistent ripple sprite before the old rig tree is
    // destroyed (destroy({children:true}) would take it down too), then
    // reattach to the freshly built shadow container.
    if (view.rippleSprite) view.rig.shadow?.removeChild(view.rippleSprite);
    view.rig.root.destroy({ children: true });
    view.rig = buildRig(rigFor(view.species), stage);
    view.node.addChildAt(view.rig.root, 0);
    if (view.rippleSprite) view.rig.shadow?.addChild(view.rippleSprite);
    view.frames = this.bakeFrames(view.species, stage);
    this.positionLabel(view);
  }

  private bakeFrames(species: SpeciesId, stage: LifeStage): CreatureView['frames'] {
    const rig = rigFor(species);
    // Bake off the symmetry points (k/6), not the old 0.25/0.75 pair: every
    // walk clip here is a symmetric 3-key track (t=0, 0.5, 1 mirrored), so
    // sampling at its own midpoints (0.25/0.75) always lands on identical
    // interpolated values — walkA and walkB were pixel-twins for 7 of 8
    // species. k/6 never lands on that symmetry, so all 6 frames differ.
    const walk: BakedFrame[] = [];
    for (let k = 0; k < N_WALK_FRAMES; k++) {
      walk.push(bakedFrame(this.app.renderer, rig, stage, 'walk', k / N_WALK_FRAMES));
    }
    const frames: CreatureView['frames'] = {
      idle: bakedFrame(this.app.renderer, rig, stage, 'idle', 0),
      walk,
      // Single mid-pose frames so mid-zoom (T1) reads eating, sleeping,
      // carrying and sitting too, not just idle/walk (M9 task 5). Core
      // clips, so every rig defines them — no existence guard needed.
      eat: bakedFrame(this.app.renderer, rig, stage, 'eat', 0.5),
      sleep: bakedFrame(this.app.renderer, rig, stage, 'sleep', 0.5),
      carry: bakedFrame(this.app.renderer, rig, stage, 'carry', 0.5),
      sit: bakedFrame(this.app.renderer, rig, stage, 'sit', 0.5),
    };
    // Only rigs that define 'flap'/'swim' get the extra bakes (M9 task 4) —
    // rig.clips.flap/.swim is undefined for every other species/clip pair.
    if (rig.clips.flap) {
      frames.flap = [0, 0.5].map((t) => bakedFrame(this.app.renderer, rig, stage, 'flap', t));
    }
    if (rig.clips.swim) {
      frames.swim = [bakedFrame(this.app.renderer, rig, stage, 'swim', 0)];
    }
    return frames;
  }

  /** One 24×10 ripple ellipse, baked once and reused by every swimming duck
   * (Ambient's bake-once pattern) — replaces the shadow while afloat. */
  private bakeRippleTexture(): Texture {
    const g = new Graphics().ellipse(12, 5, 12, 5).fill({ color: 0xdff3f5, alpha: 0.25 });
    const texture = this.app.renderer.generateTexture({
      target: g,
      frame: new Rectangle(0, 0, 24, 10),
      resolution: 1,
    });
    g.destroy(true);
    return texture;
  }

  private positionLabel(view: CreatureView): void {
    const scale = rigFor(view.species).stages[view.stage].scale;
    // Stagger by id so clustered creatures' activity labels (T2 only —
    // label.visible gates on tier === 2) don't stack on the same line.
    const stagger = ((view.id % 3) - 1) * 13;
    view.label.position.set(0, LABEL_HEIGHT[view.species] * scale + stagger);
  }

  /** Golden-hour glow + deep-night wash (screen space). */
  private applyOverlays(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    // Grade the static world layers.
    const grade = rampColor(TINT_RAMP, this.clock.dayT);
    this.groundSprite.tint = grade;
    for (const child of this.detailLayer.children) {
      if (child instanceof Graphics) child.tint = grade;
    }

    const phase = this.clock.phase;
    const glow =
      phase === 'dawn' || phase === 'dusk' ? Math.sin(Math.PI * this.clock.phaseT) * 0.14 : 0;
    this.glowOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: phase === 'dawn' ? 0xffb36b : 0xff8f5e, alpha: glow });

    this.nightOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: 0x16203e, alpha: (1 - this.clock.light) * 0.3 });
  }
}

/**
 * Choose an animation clip from sim activity + motion + the render-only
 * airborne/swimming presentation inference (M9 task 4/5). `pass` wins over
 * everything else — a passing elder is always at rest, per Task 3's
 * nearestRestable() landing guarantee — airborne/swimming come next.
 *
 * M9 task 5 fixes an ordering bug: `moving` now outranks brood/nap. Both
 * 'brood' and 'gather' walk to a target before settling (behaviors.ts:
 * "Walk to the clutch, then sit"), so a sitter or napper still covering
 * ground must read as walking, not as asleep mid-stride — only once they
 * stop moving does the brood/nap pose take over. `feedYoung` splits on its
 * `step` field while moving: step 1 (carrying food home) shows 'carry'
 * instead of a plain 'walk'.
 */
function clipFor(
  activityId: string,
  moving: boolean,
  airborne: boolean,
  swimming: boolean,
  feedYoungStep: number | undefined,
): ClipName {
  if (activityId === 'pass') return 'sleep';
  if (airborne) return 'flap';
  if (swimming) return 'swim';
  if (moving) return activityId === 'feedYoung' && feedYoungStep === 1 ? 'carry' : 'walk';
  if (activityId === 'brood') return 'sit';
  if (activityId === 'nap') return 'sleep';
  if (activityId === 'forage' || activityId === 'feedYoung') return 'eat';
  if (activityId === 'socialize' || activityId === 'court') return 'social';
  return 'idle';
}

/**
 * Which small activity glyph (if any) a creature's current activity earns
 * (M9 task 5). `feedYoung` only glyphs on its carry-home leg (step 1) —
 * fetching (step 0) reads as plain foraging/walking, no glyph. `gather` is
 * reused for three different family moments the sim doesn't otherwise
 * distinguish; only the long-minTicks mourning one glyphs (see
 * MOURNING_GATHER_MIN_TICKS).
 */
function glyphKindFor(activityId: string, step: number | undefined, minTicks: number): GlyphKind | undefined {
  switch (activityId) {
    case 'forage':
      return 'forage';
    case 'nap':
      return 'nap';
    case 'court':
      return 'court';
    case 'brood':
      return 'brood';
    case 'feedYoung':
      return step === 1 ? 'carry' : undefined;
    case 'gather':
      return minTicks >= MOURNING_GATHER_MIN_TICKS ? 'mourning' : undefined;
    default:
      return undefined;
  }
}

const FAMILY_NAMES = [
  'Bramble',
  'Clover',
  'Willow',
  'Fern',
  'Maple',
  'Hazel',
  'Rowan',
  'Aspen',
  'Poppy',
  'Birch',
  'Tansy',
  'Sorrel',
];

function familyName(id: number): string {
  return FAMILY_NAMES[id % FAMILY_NAMES.length] ?? 'Meadow';
}

/**
 * Strokes a short curved segment as an explicit moveTo/lineTo polyline —
 * deliberately NOT Graphics.arc(), which (like canvas's arc()) implicitly
 * draws a straight connecting line from wherever the shared Graphics
 * object's path last left off to the arc's own start point. glyphLayer is
 * one Graphics redrawn for every on-screen creature each frame, so an arc()
 * chained after another creature's glyph would stitch a stray line clear
 * across the world — this segmented approach always starts its own moveTo,
 * matching how every other multi-shape drawing in this codebase (see
 * ValleyPainter's drawReeds/drawTree) stays artifact-free.
 */
function strokeArc(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: number,
  width: number,
  alpha: number,
): void {
  const segments = 6;
  g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= segments; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / segments;
    g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  g.stroke({ color, width, alpha, cap: 'round' });
}

/** Piecewise-linear color ramp lookup. */
function rampColor(ramp: [number, number][], t: number): number {
  for (let i = 0; i < ramp.length - 1; i++) {
    const a = ramp[i];
    const b = ramp[i + 1];
    if (!a || !b) break;
    if (t >= a[0] && t <= b[0]) {
      const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      return lerpColor(a[1], b[1], f);
    }
  }
  return ramp[ramp.length - 1]?.[1] ?? 0xffffff;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
