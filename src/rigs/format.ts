/**
 * ART AS DATA (spec §4.4): every creature is a parented part tree of painterly
 * vector shapes, animated by keyframe clips, with life stages expressed as
 * parametric proportion/tint overrides — never new art.
 */
import type { LifeStage, SpeciesId } from '../sim/state';

export type ClipName = 'idle' | 'walk' | 'sleep' | 'eat' | 'social';

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
  clips: Record<ClipName, AnimClip>;
  /** World px traveled per full walk-cycle (ground truth for gait cadence).
   * Defaults to 30 when omitted. */
  strideLength?: number;
}
