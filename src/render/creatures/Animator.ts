/**
 * Clip playback over a rig's part containers, with procedural sweetening
 * (breathing) layered on top. Purely cosmetic — never touches the sim.
 */
import type { Container } from 'pixi.js';
import type { AnimClip, ClipName, CreatureRig, Keyframe, Track } from '../../rigs/format';

interface PartBase {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

/** A per-part snapshot of the live, currently-rendered transform — the
 * crossfade's outgoing values (M10 task 6). Reused in place across clip
 * switches so re-triggering a fade mid-fade never allocates. */
interface PartPose {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
}

/** Whole-fade duration for a clip switch (M10 task 6 brief). Eased with the
 * same smoothstep as per-keyframe sampling below, so nothing pops or snaps. */
const CROSSFADE_MS = 220;
/** Arrival settle: one gentle scale-y dip on the body when a view's clip
 * changes walk -> idle/eat — the "settle" the M8 investigation suggested. */
const SETTLE_MS = 300;
const SETTLE_DIP = 0.03; // 1 -> 0.97 at the dip's midpoint, back to 1 by SETTLE_MS

export class Animator {
  private clip: AnimClip;
  private clipName: ClipName;
  private timeMs = 0;
  private readonly bases = new Map<string, PartBase>();
  /** partId -> this clip's track, rebuilt once per clip switch (not per
   * frame) so update() doesn't rescan clip.tracks per part. */
  private readonly trackByPart = new Map<string, Track>();

  /** Crossfade state (M10 task 6). All per-view floats/maps, reused across
   * switches — no allocation once the Animator is constructed. */
  private readonly fadeFrom = new Map<string, PartPose>();
  private fading = false;
  private fadeMs = 0;
  private visibilityApplied = true;
  /** True once update() has run at least once. play()'s very first call on a
   * freshly built Animator (a bake's throwaway instance, or a live rig that
   * has never rendered a frame) has no rendered outgoing pose to blend from,
   * so that switch is instant — this also guarantees bakedFrame() samples
   * its target clip exactly rather than mid-fade. */
  private everUpdated = false;

  /** Arrival settle state (M10 task 6): walk -> idle/eat only. */
  private settling = false;
  private settleMs = 0;

  constructor(
    private readonly rig: CreatureRig,
    private readonly parts: Map<string, Container>,
  ) {
    this.clipName = 'idle';
    this.clip = rig.clips.idle;
    for (const [id, node] of parts) {
      this.bases.set(id, { x: node.position.x, y: node.position.y, sx: node.scale.x, sy: node.scale.y });
      this.fadeFrom.set(id, { x: 0, y: 0, rot: 0, sx: 1, sy: 1 });
    }
    this.rebuildTrackIndex();
    // play('idle') never runs from a freshly constructed Animator (clipName
    // already reads 'idle', so play()'s early-return would no-op) — apply
    // part visibility here too, or hideInClips parts (e.g. the carried-food
    // part) default to visible in every idle bake and freshly built T2 rig
    // (final-review fix wave, fix 1).
    this.applyClipVisibility('idle');
  }

  play(name: ClipName): void {
    if (name === this.clipName) return;
    const prevClipName = this.clipName;
    // Fresh instances (never rendered a frame) have no outgoing pose worth
    // blending from — switch instantly instead of fading from an unrendered
    // pose. This is also what makes bakedFrame()'s single-shot instances
    // sample their target clip exactly (Step 1 of the brief).
    const instant = !this.everUpdated;

    if (!instant) {
      // Snapshot the live, currently-rendered pose per part as the fade's
      // outgoing values — play() no longer snaps parts back to base.
      for (const [id, node] of this.parts) {
        const snap = this.fadeFrom.get(id);
        if (!snap) continue;
        snap.x = node.position.x;
        snap.y = node.position.y;
        snap.rot = node.rotation;
        snap.sx = node.scale.x;
        snap.sy = node.scale.y;
      }
    }

    this.clipName = name;
    // Non-null: callers only ever request 'flap'/'swim' for rigs that define
    // them (Renderer's airborne/swimming inference is species-gated), so the
    // optional extra-clip slots are always populated when actually reached.
    this.clip = this.rig.clips[name]!;
    this.timeMs = 0;
    this.rebuildTrackIndex();

    if (instant) {
      this.fading = false;
      this.applyClipVisibility(name);
      this.visibilityApplied = true;
    } else {
      this.fading = true;
      this.fadeMs = 0;
      // hideInClips parts switch at the fade's 50% point (below, in
      // update()) so props don't pop the instant the clip changes.
      this.visibilityApplied = false;
    }

    // Arrival settle (M10 task 6): only walk -> idle/eat gets the dip — a
    // creature coming to rest, not every clip change.
    if (prevClipName === 'walk' && (name === 'idle' || name === 'eat')) {
      this.settling = true;
      this.settleMs = 0;
    }
  }

  /** Rebuild the partId -> track lookup for the current clip. Runs once per
   * clip switch (constructor + play()), never per frame. */
  private rebuildTrackIndex(): void {
    this.trackByPart.clear();
    for (const track of this.clip.tracks) {
      this.trackByPart.set(track.partId, track);
    }
  }

  /** Parts with `hideInClips` (e.g. a duck's legs while it swims) vanish for
   * exactly the clips that list them — set once per clip switch, not per
   * frame, and honored equally by the live T2 rig and T1's baked frames
   * (bakedFrame() calls play() before sampling a pose). */
  private applyClipVisibility(name: ClipName): void {
    for (const part of this.rig.parts) {
      if (!part.hideInClips) continue;
      const node = this.parts.get(part.id);
      if (node) node.visible = !part.hideInClips.includes(name);
    }
  }

  update(dtMs: number): void {
    this.everUpdated = true;
    this.timeMs = (this.timeMs + dtMs) % this.clip.durationMs;
    const t = this.timeMs / this.clip.durationMs;

    // Advance the crossfade and ease its progress the same way per-keyframe
    // sampling does (smoothstep) — nothing pops or snaps.
    let fadeEase = 1;
    if (this.fading) {
      this.fadeMs += dtMs;
      const fadeP = this.fadeMs >= CROSSFADE_MS ? 1 : this.fadeMs / CROSSFADE_MS;
      if (fadeP >= 0.5 && !this.visibilityApplied) {
        this.applyClipVisibility(this.clipName);
        this.visibilityApplied = true;
      }
      if (fadeP >= 1) {
        this.fading = false;
        fadeEase = 1;
      } else {
        fadeEase = fadeP * fadeP * (3 - 2 * fadeP);
      }
    }

    for (const [id, node] of this.parts) {
      const base = this.bases.get(id);
      if (!base) continue;
      const track = this.trackByPart.get(id);
      const targetRot = track?.rot ? sample(track.rot, t) : 0;
      const targetX = base.x + (track?.px ? sample(track.px, t) : 0);
      const targetY = base.y + (track?.py ? sample(track.py, t) : 0);
      const targetSx = base.sx * (track?.sx ? sample(track.sx, t) : 1);
      const targetSy = base.sy * (track?.sy ? sample(track.sy, t) : 1);

      const from = this.fading ? this.fadeFrom.get(id) : undefined;
      if (from) {
        node.rotation = from.rot + (targetRot - from.rot) * fadeEase;
        node.position.set(from.x + (targetX - from.x) * fadeEase, from.y + (targetY - from.y) * fadeEase);
        node.scale.set(from.sx + (targetSx - from.sx) * fadeEase, from.sy + (targetSy - from.sy) * fadeEase);
      } else {
        node.rotation = targetRot;
        node.position.set(targetX, targetY);
        node.scale.set(targetSx, targetSy);
      }
    }

    // Breathing on the body, unless the clip animates body scale itself.
    // Multiplies onto whatever the loop above just set (base pose in the
    // steady state, a crossfade blend mid-fade) instead of overwriting it —
    // so a fade out of a body-scale-owning clip never pops straight to base.
    const body = this.parts.get('body');
    const bodyBase = this.bases.get('body');
    const clipOwnsBodyScale = this.clip.tracks.some((tr) => tr.partId === 'body' && (tr.sy || tr.sx));
    if (body && bodyBase && !clipOwnsBodyScale) {
      const rate = this.clipName === 'sleep' ? 0.0012 : 0.0028;
      body.scale.y *= 1 + Math.sin(performance.now() * rate) * 0.02;
    }

    // Arrival settle (M10 task 6): a single gentle scale-y dip to 0.97 and
    // back, composed multiplicatively on top of crossfade + breathing.
    if (this.settling) {
      this.settleMs += dtMs;
      const p = this.settleMs >= SETTLE_MS ? 1 : this.settleMs / SETTLE_MS;
      if (body) body.scale.y *= 1 - SETTLE_DIP * Math.sin(Math.PI * p);
      if (p >= 1) this.settling = false;
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
