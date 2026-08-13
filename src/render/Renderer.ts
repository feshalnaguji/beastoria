/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M2: painterly valley (ground baked to a texture once), day/night color
 * grading with golden-hour glow, LOD tiers. Rig pipeline arrives in M3.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { getClock, type Clock } from '../sim/clock';
import { WORLD_HEIGHT, WORLD_WIDTH, type Creature, type Vec2, type WorldState } from '../sim/state';
import { Camera } from './Camera';
import { lodTier } from './Lod';
import { buildValley } from './terrain/ValleyPainter';

interface CreatureView {
  node: Container;
  body: Graphics;
  label: Text;
  prev: Vec2;
  curr: Vec2;
  heading: number;
  activityId: string;
  napping: boolean;
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
  private elapsedFrames = 0;
  private clock: Clock = getClock(0);

  /** Show per-creature activity labels (toggled from the DevPanel). */
  debugLabels = true;

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
      }
      view.prev.x = view.curr.x;
      view.prev.y = view.curr.y;
      view.curr.x = c.pos.x;
      view.curr.y = c.pos.y;
      view.heading = c.heading;
      view.activityId = c.activity.id;
      view.napping = c.activity.id === 'nap';
    }
  }

  /** Draw one frame, interpolating between the last two sim snapshots. */
  render(alpha: number): void {
    this.elapsedFrames++;
    const tier = lodTier(this.camera.getZoom());

    for (const view of this.views.values()) {
      const x = view.prev.x + (view.curr.x - view.prev.x) * alpha;
      const y = view.prev.y + (view.curr.y - view.prev.y) * alpha;
      const moving = Math.hypot(view.curr.x - view.prev.x, view.curr.y - view.prev.y) > 0.5;
      // Gentle hop-bob while moving; slow breathing at rest; skipped at world view.
      const bob =
        tier === 0
          ? 0
          : moving
            ? Math.abs(Math.sin(this.elapsedFrames * 0.25)) * -6
            : Math.sin(this.elapsedFrames * (view.napping ? 0.03 : 0.05)) * -1.5;
      view.node.position.set(x, y + bob);
      const facingLeft = Math.cos(view.heading) < 0;
      view.node.scale.x = facingLeft ? -1 : 1;

      view.label.visible = this.debugLabels && tier === 2;
      if (view.label.visible) {
        view.label.text = view.napping ? 'nap 💤' : view.activityId;
        view.label.scale.x = facingLeft ? -1 : 1;
      }
    }

    this.applyGrading();
    this.camera.update();
  }

  /** Day/night color grading: multiply tint + golden-hour glow + night wash. */
  private applyGrading(): void {
    const tint = rampColor(TINT_RAMP, this.clock.dayT);
    this.groundSprite.tint = tint;
    for (const child of this.detailLayer.children) {
      if (child instanceof Graphics) child.tint = tint;
    }
    for (const view of this.views.values()) {
      view.body.tint = tint;
    }

    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    // Warm additive glow, peaking mid-dawn and mid-dusk.
    const phase = this.clock.phase;
    const glow =
      phase === 'dawn' || phase === 'dusk' ? Math.sin(Math.PI * this.clock.phaseT) * 0.14 : 0;
    this.glowOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: phase === 'dawn' ? 0xffb36b : 0xff8f5e, alpha: glow });

    // Deep blue wash as true night settles.
    this.nightOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: 0x16203e, alpha: (1 - this.clock.light) * 0.3 });
  }

  private createView(c: Creature): CreatureView {
    const node = new Container();
    const body = buildRabbit();
    node.addChild(body);
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
    label.position.set(0, -52);
    node.addChild(label);
    return {
      node,
      body,
      label,
      prev: { x: c.pos.x, y: c.pos.y },
      curr: { x: c.pos.x, y: c.pos.y },
      heading: c.heading,
      activityId: c.activity.id,
      napping: false,
    };
  }
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

/** M2 rabbit: layered soft shapes. Replaced by the real rig pipeline in M3. */
function buildRabbit(): Graphics {
  const g = new Graphics();

  // Shadow.
  g.ellipse(0, 26, 30, 9).fill({ color: 0x3d5a2e, alpha: 0.25 });
  // Tail.
  g.circle(-30, 4, 11).fill(0xfaf6ee);
  // Body (soft capsule).
  g.roundRect(-32, -14, 62, 40, 20).fill(0xe8dcc8);
  // Belly wash.
  g.ellipse(2, 12, 22, 12).fill({ color: 0xfaf6ee, alpha: 0.8 });
  // Head.
  g.circle(26, -14, 17).fill(0xe8dcc8);
  // Ears (long, slightly splayed).
  g.ellipse(18, -38, 6, 17).fill(0xe8dcc8);
  g.ellipse(32, -39, 6, 18).fill(0xe8dcc8);
  g.ellipse(18, -37, 3, 11).fill({ color: 0xf2d8e4, alpha: 0.85 });
  g.ellipse(32, -38, 3, 12).fill({ color: 0xf2d8e4, alpha: 0.85 });
  // Eye + nose.
  g.circle(31, -16, 2.6).fill(0x3a3230);
  g.ellipse(42, -12, 3.5, 2.5).fill(0xd9a5b5);

  return g;
}
