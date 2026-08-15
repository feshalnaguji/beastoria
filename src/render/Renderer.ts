/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M3: the rig pipeline — live skeletal rigs at close zoom (T2), baked sprite
 * frames at mid/world zoom (T1/T0), life-stage proportions, day/night grading.
 */
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { getClock, TICKS_PER_DAY, type Clock } from '../sim/clock';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Creature,
  type LifeStage,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../sim/state';
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
  node: Container; // world-positioned, flip container
  rig: RigInstance;
  spriteWrap: Container;
  sprite: Sprite;
  frames: { idle: BakedFrame; walkA: BakedFrame; walkB: BakedFrame };
  label: Text;
  species: SpeciesId;
  stage: LifeStage;
  prev: Vec2;
  curr: Vec2;
  heading: number;
  activityId: string;
}

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
  private homeLayer!: Graphics;
  private memorialLayer!: Graphics;
  private homeLabelLayer!: Container;
  private homeLabels = new Map<number, Text>();
  private nightOverlay!: Graphics;
  private glowOverlay!: Graphics;
  private ambient!: AmbientEffects;
  private views = new Map<number, CreatureView>();
  private clock: Clock = getClock(0);
  private lastFrameTime = 0;

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
      this.ambient.fireflyLayer, // above creatures
      this.homeLabelLayer,
    );
    this.ambient.build(this.app.renderer);

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
    }
    // Creatures who have passed fade from the world.
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        view.node.destroy({ children: true });
        this.views.delete(id);
        if (this.followId === id) this.followId = null;
      }
    }
    this.syncHomes(state);
    this.syncMemorials(state);
    this.ambient.setMemorialAnchors(state.memorials.map((m) => m.pos));
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
    }
    for (const [homeId, label] of this.homeLabels) {
      if (!claimed.has(homeId)) {
        label.destroy();
        this.homeLabels.delete(homeId);
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

    const tier = lodTier(this.camera.getZoom());
    const grade = rampColor(TINT_RAMP, this.clock.dayT);

    for (const view of this.views.values()) {
      const x = view.prev.x + (view.curr.x - view.prev.x) * alpha;
      const y = view.prev.y + (view.curr.y - view.prev.y) * alpha;
      const moving = Math.hypot(view.curr.x - view.prev.x, view.curr.y - view.prev.y) > 0.5;
      view.node.position.set(x, y);
      const facingLeft = Math.cos(view.heading) < 0;
      view.node.scale.x = facingLeft ? -1 : 1;
      // A passing elder softens — the gentlest farewell.
      view.node.alpha = view.activityId === 'pass' ? 0.75 : 1;

      if (tier === 2) {
        view.rig.root.visible = true;
        view.spriteWrap.visible = false;
        view.rig.animator.play(clipFor(view.activityId, moving));
        view.rig.animator.update(dtMs);
        const tint = multiplyTints(view.rig.stageTint, grade);
        for (const g of view.rig.tintables) g.tint = tint;
      } else {
        view.rig.root.visible = false;
        view.spriteWrap.visible = true;
        // T1 flipbook: alternate walk frames while moving; T0 stays static.
        const frame =
          moving && tier === 1
            ? Math.floor(now / 140) % 2 === 0
              ? view.frames.walkA
              : view.frames.walkB
            : view.frames.idle;
        view.sprite.texture = frame.texture;
        view.sprite.position.set(frame.bx, frame.by);
        view.sprite.tint = grade;
      }

      view.label.visible = this.debugLabels && tier === 2;
      if (view.label.visible) {
        view.label.text = view.activityId === 'nap' ? 'nap 💤' : view.activityId;
        view.label.scale.x = facingLeft ? -1 : 1;
      }
    }

    this.homeLabelLayer.visible = tier >= 1;

    const followed = this.followId === null ? undefined : this.views.get(this.followId);
    if (followed) this.camera.centerOn(followed.curr.x, followed.curr.y);

    this.applyOverlays();
    this.camera.update();
    this.ambient.update(dtMs, this.clock, this.viewInfo());
  }

  private createView(c: Creature): CreatureView {
    const node = new Container();
    const rig = buildRig(rigFor(c.species), c.stage);
    const spriteWrap = new Container();
    const sprite = new Sprite();
    spriteWrap.addChild(sprite);
    node.addChild(rig.root, spriteWrap);

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
    };
    this.positionLabel(view);
    return view;
  }

  /** Swap rig + baked frames when a creature grows into its next stage. */
  private applyStage(view: CreatureView, stage: LifeStage): void {
    view.stage = stage;
    view.rig.root.destroy({ children: true });
    view.rig = buildRig(rigFor(view.species), stage);
    view.node.addChildAt(view.rig.root, 0);
    view.frames = this.bakeFrames(view.species, stage);
    this.positionLabel(view);
  }

  private bakeFrames(species: SpeciesId, stage: LifeStage): CreatureView['frames'] {
    const rig = rigFor(species);
    return {
      idle: bakedFrame(this.app.renderer, rig, stage, 'idle', 0),
      walkA: bakedFrame(this.app.renderer, rig, stage, 'walk', 0.25),
      walkB: bakedFrame(this.app.renderer, rig, stage, 'walk', 0.75),
    };
  }

  private positionLabel(view: CreatureView): void {
    const scale = rigFor(view.species).stages[view.stage].scale;
    view.label.position.set(0, LABEL_HEIGHT[view.species] * scale);
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

/** Choose an animation clip from sim activity + motion. */
function clipFor(activityId: string, moving: boolean): ClipName {
  if (activityId === 'nap' || activityId === 'brood' || activityId === 'pass') return 'sleep';
  if (moving) return 'walk';
  if (activityId === 'forage' || activityId === 'feedYoung') return 'eat';
  if (activityId === 'socialize' || activityId === 'court') return 'social';
  return 'idle';
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
