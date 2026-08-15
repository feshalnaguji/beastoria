/**
 * LOD scaffolding: map camera zoom to a detail tier per the spec.
 * T0 world view · T1 mid · T2 close. Real per-tier creature rendering
 * arrives with the rig pipeline in M3; M1 uses tiers for labels/motion only.
 */
export type LodTier = 0 | 1 | 2;

export function lodTier(zoom: number): LodTier {
  if (zoom < 0.35) return 0;
  // Live rigs (T2) wake at 0.55, not 1.0 — typical desktop min-zoom (~0.47)
  // sits just below this, so panning in slightly reveals moving legs instead
  // of requiring a hard zoom-to-1.0 (M9 task 2: most players never saw T2).
  if (zoom < 0.55) return 1;
  return 2;
}
