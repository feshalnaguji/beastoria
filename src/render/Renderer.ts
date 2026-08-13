/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M1 scope: meadow plane, vector rabbits, night-tint overlay, debug activity
 * labels. Painterly valley arrives in M2; the rig pipeline in M3.
 */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { getClock } from '../sim/clock';
import { seedRng, nextRange } from '../sim/rng';
import { WORLD_HEIGHT, WORLD_WIDTH, type Creature, type Vec2, type WorldState } from '../sim/state';
import { Camera } from './Camera';

interface CreatureView {
  node: Container;
  label: Text;
  prev: Vec2;
  curr: Vec2;
  heading: number;
  activityId: string;
  napping: boolean;
}

export class Renderer {
  private app!: Application;
  private world!: Container;
  private camera!: Camera;
  private nightOverlay!: Graphics;
  private views = new Map<number, CreatureView>();
  private elapsedFrames = 0;
  private light = 1;

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
    this.world.addChild(this.buildGround());

    // Screen-space night tint above the world.
    this.nightOverlay = new Graphics();
    this.app.stage.addChild(this.nightOverlay);

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
    this.light = getClock(state.tick).light;
    for (const c of state.creatures) {
      let view = this.views.get(c.id);
      if (!view) {
        view = this.createView(c);
        this.views.set(c.id, view);
        this.world.addChild(view.node);
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
    for (const view of this.views.values()) {
      const x = view.prev.x + (view.curr.x - view.prev.x) * alpha;
      const y = view.prev.y + (view.curr.y - view.prev.y) * alpha;
      const moving = Math.hypot(view.curr.x - view.prev.x, view.curr.y - view.prev.y) > 0.5;
      // Gentle hop-bob while moving; slow breathing at rest; deep breathing asleep.
      const bob = moving
        ? Math.abs(Math.sin(this.elapsedFrames * 0.25)) * -6
        : Math.sin(this.elapsedFrames * (view.napping ? 0.03 : 0.05)) * -1.5;
      view.node.position.set(x, y + bob);
      const facingLeft = Math.cos(view.heading) < 0;
      view.node.scale.x = facingLeft ? -1 : 1;

      view.label.visible = this.debugLabels;
      if (this.debugLabels) {
        view.label.text = view.napping ? 'nap 💤' : view.activityId;
        // Labels stay upright and unmirrored regardless of body flip.
        view.label.scale.x = facingLeft ? -1 : 1;
      }
    }

    // Night falls: dark blue wash whose strength follows the sim's light level.
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    this.nightOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: 0x16203e, alpha: (1 - this.light) * 0.45 });

    this.camera.update();
  }

  private createView(c: Creature): CreatureView {
    const node = buildRabbit();
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
      label,
      prev: { x: c.pos.x, y: c.pos.y },
      curr: { x: c.pos.x, y: c.pos.y },
      heading: c.heading,
      activityId: c.activity.id,
      napping: false,
    };
  }

  /** M1 ground: soft green plane with darker grass patches and tiny flowers. */
  private buildGround(): Container {
    const ground = new Container();
    const rng = seedRng(20260813); // cosmetic RNG — separate from the sim stream

    const base = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x8fb573);
    ground.addChild(base);

    const patches = new Graphics();
    for (let i = 0; i < 60; i++) {
      const x = nextRange(rng, 0, WORLD_WIDTH);
      const y = nextRange(rng, 0, WORLD_HEIGHT);
      const r = nextRange(rng, 80, 320);
      patches.ellipse(x, y, r, r * nextRange(rng, 0.5, 0.8)).fill({
        color: 0x7da861,
        alpha: nextRange(rng, 0.2, 0.45),
      });
    }
    ground.addChild(patches);

    const flowers = new Graphics();
    const flowerColors = [0xf7f3d7, 0xf2d8e4, 0xfdf6b8];
    for (let i = 0; i < 240; i++) {
      const x = nextRange(rng, 0, WORLD_WIDTH);
      const y = nextRange(rng, 0, WORLD_HEIGHT);
      const color = flowerColors[Math.floor(nextRange(rng, 0, flowerColors.length))] ?? 0xf7f3d7;
      flowers.circle(x, y, nextRange(rng, 3, 6)).fill({ color, alpha: 0.9 });
    }
    ground.addChild(flowers);

    return ground;
  }
}

/** M1 rabbit: layered soft shapes. Replaced by the real rig pipeline in M3. */
function buildRabbit(): Container {
  const rabbit = new Container();
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

  rabbit.addChild(g);
  return rabbit;
}
