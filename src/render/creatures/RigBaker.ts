/**
 * Bakes rig × stage × pose into cached textures for the cheap LOD tiers:
 * T0 uses the idle frame; T1 flips between two walk frames. One-time cost
 * per combination, then everything is plain sprites (spec §4.4).
 */
import { Rectangle, type Renderer as PixiRenderer, type Texture } from 'pixi.js';
import type { ClipName, CreatureRig } from '../../rigs/format';
import type { LifeStage } from '../../sim/state';
import { buildRig } from './RigRenderer';

export interface BakedFrame {
  texture: Texture;
  /** Local bounds offset: place the sprite at (x + bx, y + by). */
  bx: number;
  by: number;
}

const cache = new Map<string, BakedFrame>();

export function bakedFrame(
  renderer: PixiRenderer,
  rig: CreatureRig,
  stage: LifeStage,
  pose: ClipName,
  poseT: number,
): BakedFrame {
  const key = `${rig.species}|${stage}|${pose}|${poseT}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const inst = buildRig(rig, stage);
  inst.animator.play(pose);
  // Advance to the requested normalized time (breathing uses wall-clock, but
  // a single bake frame doesn't care).
  inst.animator.update(rig.clips[pose].durationMs * poseT);
  // Bake the stage's own tint (chick fluff, elder silvering) into the texture;
  // day/night grading is applied live on the sprite instead.
  for (const g of inst.tintables) g.tint = inst.stageTint;

  const b = inst.root.getLocalBounds();
  const pad = 4;
  const frame = new Rectangle(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  const texture = renderer.generateTexture({
    target: inst.root,
    frame,
    resolution: 1,
  });
  inst.root.destroy(true);

  const baked: BakedFrame = { texture, bx: frame.x, by: frame.y };
  cache.set(key, baked);
  return baked;
}
