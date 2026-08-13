/**
 * Clip playback over a rig's part containers, with procedural sweetening
 * (breathing) layered on top. Purely cosmetic — never touches the sim.
 */
import type { Container } from 'pixi.js';
import type { AnimClip, ClipName, CreatureRig, Keyframe } from '../../rigs/format';

interface PartBase {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export class Animator {
  private clip: AnimClip;
  private clipName: ClipName;
  private timeMs = 0;
  private bases = new Map<string, PartBase>();

  constructor(
    private readonly rig: CreatureRig,
    private readonly parts: Map<string, Container>,
  ) {
    this.clipName = 'idle';
    this.clip = rig.clips.idle;
    for (const [id, node] of parts) {
      this.bases.set(id, { x: node.position.x, y: node.position.y, sx: node.scale.x, sy: node.scale.y });
    }
  }

  play(name: ClipName): void {
    if (name === this.clipName) return;
    this.clipName = name;
    this.clip = this.rig.clips[name];
    this.timeMs = 0;
    this.resetPose();
  }

  update(dtMs: number): void {
    this.timeMs = (this.timeMs + dtMs) % this.clip.durationMs;
    const t = this.timeMs / this.clip.durationMs;

    for (const track of this.clip.tracks) {
      const node = this.parts.get(track.partId);
      const base = this.bases.get(track.partId);
      if (!node || !base) continue;
      if (track.rot) node.rotation = sample(track.rot, t);
      node.position.set(
        base.x + (track.px ? sample(track.px, t) : 0),
        base.y + (track.py ? sample(track.py, t) : 0),
      );
      node.scale.set(
        base.sx * (track.sx ? sample(track.sx, t) : 1),
        base.sy * (track.sy ? sample(track.sy, t) : 1),
      );
    }

    // Breathing on the body, unless the clip animates body scale itself.
    const body = this.parts.get('body');
    const bodyBase = this.bases.get('body');
    const clipOwnsBodyScale = this.clip.tracks.some((tr) => tr.partId === 'body' && (tr.sy || tr.sx));
    if (body && bodyBase && !clipOwnsBodyScale) {
      const rate = this.clipName === 'sleep' ? 0.0012 : 0.0028;
      body.scale.y = bodyBase.sy * (1 + Math.sin(performance.now() * rate) * 0.02);
    }
  }

  /** Snap all animated parts back to their base pose. */
  private resetPose(): void {
    for (const [id, node] of this.parts) {
      const base = this.bases.get(id);
      if (!base) continue;
      node.rotation = 0;
      node.position.set(base.x, base.y);
      node.scale.set(base.sx, base.sy);
    }
  }
}

/** Sample a looping keyframe list with smoothstep easing between keys. */
function sample(keys: Keyframe[], t: number): number {
  if (keys.length === 0) return 0;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b) break;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const f = span === 0 ? 0 : (t - a.t) / span;
      const eased = f * f * (3 - 2 * f);
      return a.v + (b.v - a.v) * eased;
    }
  }
  return last.v;
}
