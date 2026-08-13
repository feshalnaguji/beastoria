/**
 * Seeded, serializable PRNG (sfc32). The sim's ONLY source of randomness.
 * State is four uint32s stored directly in WorldState so saves replay exactly.
 */
export type RngState = [number, number, number, number];

/** Derive a well-mixed sfc32 state from a single numeric seed (splitmix32). */
export function seedRng(seed: number): RngState {
  let h = seed >>> 0;
  const next = () => {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  const state: RngState = [next(), next(), next(), next()];
  // Warm up so poor seeds decorrelate.
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** Advance the state, returning a uint32. Mutates `s`. */
export function nextUint32(s: RngState): number {
  const a = s[0] | 0;
  const b = s[1] | 0;
  const c = s[2] | 0;
  let d = s[3] | 0;
  const t = (a + b) | 0;
  s[0] = b ^ (b >>> 9);
  s[1] = (c + (c << 3)) | 0;
  s[2] = ((c << 21) | (c >>> 11)) | 0;
  d = (d + 1) | 0;
  const out = (t + d) | 0;
  s[3] = d;
  s[2] = (s[2] + out) | 0;
  return out >>> 0;
}

/** Uniform float in [0, 1). Mutates `s`. */
export function nextFloat(s: RngState): number {
  return nextUint32(s) / 4294967296;
}

/** Uniform float in [min, max). Mutates `s`. */
export function nextRange(s: RngState, min: number, max: number): number {
  return min + nextFloat(s) * (max - min);
}
