/**
 * LOD scaffolding: map camera zoom to a detail tier per the spec.
 * T0 world view · T1 mid · T2 close. Real per-tier creature rendering
 * arrives with the rig pipeline in M3; M1 uses tiers for labels/motion only.
 */
export type LodTier = 0 | 1 | 2;

export function lodTier(zoom: number): LodTier {
  if (zoom < 0.35) return 0;
  if (zoom < 1.0) return 1;
  return 2;
}
