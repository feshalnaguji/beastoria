/**
 * Builds a live Pixi display tree from rig data (the T2 close-up view).
 * Parts become nested containers pivoting at their attach points; stages
 * apply parametric proportions and tint.
 */
import { Container, Graphics, GraphicsPath } from 'pixi.js';
import type { CreatureRig, StageStyle, VectorShape } from '../../rigs/format';
import type { LifeStage } from '../../sim/state';
import { Animator } from './Animator';

export interface RigInstance {
  root: Container;
  animator: Animator;
  /** All part Graphics, for day/night tinting. */
  tintables: Graphics[];
  /** The stage's own tint, multiplied with grading each frame. */
  stageTint: number;
  /**
   * The rig's 'shadow' part — container and its drawn ellipse, looked up by
   * id once at build time (M9 task 4: the flight-lift illusion scales/shifts
   * this container, and a swimming duck hides the ellipse for a ripple
   * sprite instead). Undefined only if a rig omits a 'shadow' part (none do
   * today).
   */
  shadow?: Container | undefined;
  shadowGraphic?: Graphics | undefined;
  /** The rig's 'food' part, looked up by id once at build time same as
   * `shadow` above — lets the renderer force it visible for a flying
   * creature's carry-home leg without touching clip priority (final-review
   * fix wave, fix 2). Undefined for rigs that omit a 'food' part (none do
   * today). */
  food?: Container | undefined;
  /** The rig's 'pouch' part, looked up by id once at build time same as
   * `shadow`/`food` above — the anchor container a real carried joey's
   * whole view is reparented into (M12 task 5), so it z-sorts against the
   * pouch's own `pouchBack`/`pouchFront` children (sortableChildren, same
   * as every other part container). Undefined for every rig but the
   * kangaroo's — the only species with a `pouch` part today. */
  pouch?: Container | undefined;
}

export function buildRig(rig: CreatureRig, stage: LifeStage): RigInstance {
  const style: StageStyle = rig.stages[stage];
  const root = new Container();
  root.sortableChildren = true;
  root.scale.set(style.scale);

  const containers = new Map<string, Container>();
  const tintables: Graphics[] = [];
  let shadow: Container | undefined;
  let shadowGraphic: Graphics | undefined;
  let food: Container | undefined;
  let pouch: Container | undefined;

  for (const part of rig.parts) {
    const node = new Container();
    node.sortableChildren = true;
    node.position.set(part.x, part.y);
    node.zIndex = part.z;

    const override = style.partScale?.[part.id];
    if (override) node.scale.set(override.x, override.y);

    const g = new Graphics();
    g.zIndex = 0;
    drawShapes(g, part.shapes);
    node.addChild(g);
    tintables.push(g);
    if (part.id === 'shadow') {
      shadow = node;
      shadowGraphic = g;
    }
    if (part.id === 'food') food = node;
    if (part.id === 'pouch') pouch = node;

    containers.set(part.id, node);
    const parent = part.parent ? containers.get(part.parent) : undefined;
    (parent ?? root).addChild(node);
  }

  return {
    root,
    animator: new Animator(rig, containers),
    tintables,
    stageTint: style.tint ?? 0xffffff,
    shadow,
    shadowGraphic,
    food,
    pouch,
  };
}

export function drawShapes(g: Graphics, shapes: VectorShape[]): void {
  for (const s of shapes) {
    const alpha = s.fill.alpha ?? 1;
    switch (s.kind) {
      case 'ellipse':
        g.ellipse(s.x, s.y, s.rx, s.ry).fill({ color: s.fill.color, alpha });
        break;
      case 'circle':
        g.circle(s.x, s.y, s.r).fill({ color: s.fill.color, alpha });
        break;
      case 'roundRect':
        g.roundRect(s.x, s.y, s.w, s.h, s.r).fill({ color: s.fill.color, alpha });
        break;
      case 'path':
        g.path(new GraphicsPath(s.d)).fill({ color: s.fill.color, alpha });
        break;
      case 'line':
        g.moveTo(s.x1, s.y1)
          .lineTo(s.x2, s.y2)
          .stroke({ color: s.fill.color, alpha, width: s.width, cap: 'round' });
        break;
    }
  }
}

/** Multiply two 0xRRGGBB tints (stage silvering × day/night grade). */
export function multiplyTints(a: number, b: number): number {
  const r = Math.round((((a >> 16) & 0xff) * ((b >> 16) & 0xff)) / 255);
  const g = Math.round((((a >> 8) & 0xff) * ((b >> 8) & 0xff)) / 255);
  const bl = Math.round(((a & 0xff) * (b & 0xff)) / 255);
  return (r << 16) | (g << 8) | bl;
}
