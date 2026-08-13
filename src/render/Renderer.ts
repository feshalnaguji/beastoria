/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M3: the rig pipeline — live skeletal rigs at close zoom (T2), baked sprite
 * frames at mid/world zoom (T1/T0), life-stage proportions, day/night grading.
 */
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { getClock, type Clock } from '../sim/clock';
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
import { rabbitRig } from '../rigs/rabbitRig';
import { robinRig } from '../rigs/robinRig';
import { Camera } from './Camera';
import { lodTier } from './Lod';
import { bakedFrame, type BakedFrame } from './creatures/RigBaker';
import { buildRig, multiplyTints, type RigInstance } from './creatures/RigRenderer';
import { buildValley } from './terrain/ValleyPainter';
import { Rectangle } from 'pixi.js';

const RIGS: Record<SpeciesId, CreatureRig> = {
  rabbit: rabbitRig,
  robin: robinRig,
};

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
  private nightOverlay!: Graphics;
  private glowOverlay!: Graphics;
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
    this.creatureLayer = new Container();
    this.world.addChild(this.groundSprite, this.detailLayer, this.creatureLayer);

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
    for (const c of state.creatures) {
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

    const followed = this.followId === null ? undefined : this.views.get(this.followId);
    if (followed) this.camera.centerOn(followed.curr.x, followed.curr.y);

    this.applyOverlays();
    this.camera.update();
  }

  private createView(c: Creature): CreatureView {
    const node = new Container();
    const rig = buildRig(RIGS[c.species], c.stage);
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
    view.rig = buildRig(RIGS[view.species], stage);
    view.node.addChildAt(view.rig.root, 0);
    view.frames = this.bakeFrames(view.species, stage);
    this.positionLabel(view);
  }

  private bakeFrames(species: SpeciesId, stage: LifeStage): CreatureView['frames'] {
    const rig = RIGS[species];
    return {
      idle: bakedFrame(this.app.renderer, rig, stage, 'idle', 0),
      walkA: bakedFrame(this.app.renderer, rig, stage, 'walk', 0.25),
      walkB: bakedFrame(this.app.renderer, rig, stage, 'walk', 0.75),
    };
  }

  private positionLabel(view: CreatureView): void {
    const scale = RIGS[view.species].stages[view.stage].scale;
    const height = view.species === 'robin' ? -46 : -70; // roughly the rig's crown
    view.label.position.set(0, height * scale);
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
  if (activityId === 'nap') return 'sleep';
  if (moving) return 'walk';
  if (activityId === 'forage') return 'eat';
  if (activityId === 'socialize') return 'social';
  return 'idle';
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
