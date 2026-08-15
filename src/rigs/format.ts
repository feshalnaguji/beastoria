/**
 * ART AS DATA (spec §4.4): every creature is a parented part tree of painterly
 * vector shapes, animated by keyframe clips, with life stages expressed as
 * parametric proportion/tint overrides — never new art.
 */
import type { LifeStage, SpeciesId } from '../sim/state';

/** Clips every rig must define. `carry` (fetching food home for young — a
 * species-flavored head/beak dip, with a food part that only shows in this
 * clip) and `sit` (brooding — a gentle body squash) join the M5 five as of
 * M9 task 5, so TypeScript enforces every rig authors them. */
export type CoreClipName = 'idle' | 'walk' | 'sleep' | 'eat' | 'social' | 'carry' | 'sit';
/**
 * Presentation-only locomotion clips a few species add on top (M9 task 4):
 * 'flap' for the three air-medium fliers (robin/owl/phoenix), 'swim' for the
 * amphibious duck. Optional per rig — most species never define these.
 */
export type ExtraClipName = 'flap' | 'swim';
export type ClipName = CoreClipName | ExtraClipName;

/** t is 0..1 across the clip; values interpolate smoothly and loop. */
export interface Keyframe {
  t: number;
  v: number;
}

export interface Track {
  partId: string;
  rot?: Keyframe[];
  px?: Keyframe[];
  py?: Keyframe[];
  sx?: Keyframe[];
  sy?: Keyframe[];
}

export interface AnimClip {
  durationMs: number;
  tracks: Track[];
}

export interface ShapeFill {
  color: number;
  alpha?: number;
}

export type VectorShape =
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: ShapeFill }
  | { kind: 'circle'; x: number; y: number; r: number; fill: ShapeFill }
  | { kind: 'roundRect'; x: number; y: number; w: number; h: number; r: number; fill: ShapeFill }
  | { kind: 'path'; d: string; fill: ShapeFill }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; fill: ShapeFill };

export interface RigPart {
  id: string;
  /** Parent part id, or null for root-level parts. */
  parent: string | null;
  /** Attach point (pivot) in parent space — rotation happens around this. */
  x: number;
  y: number;
  /** Draw order among siblings (zIndex). */
  z: number;
  shapes: VectorShape[];
  /**
   * Clip names during which this part is hidden entirely (e.g. a duck's
   * legs while it swims) — honored by RigRenderer/Animator: the part's
   * container is invisible whenever the currently playing clip is listed
   * here, both for the live T2 rig and when T1 frames are baked off it.
   */
  hideInClips?: string[];
}

export interface StageStyle {
  /** Whole-creature scale (baby ≈ 0.5). */
  scale: number;
  /** Per-part proportion overrides (baby: big head, stubby legs). */
  partScale?: Record<string, { x: number; y: number }>;
  /** Multiply tint (elder: gentle silvering). */
  tint?: number;
}

export interface CreatureRig {
  species: SpeciesId;
  parts: RigPart[];
  stages: Record<LifeStage, StageStyle>;
  /** Core clips are required; flap/swim are opt-in per species (see ExtraClipName). */
  clips: Record<CoreClipName, AnimClip> & Partial<Record<ExtraClipName, AnimClip>>;
  /** World px traveled per full walk-cycle (ground truth for gait cadence).
   * Defaults to 30 when omitted. */
  strideLength?: number;
}
