/**
 * The koi rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14). A side-view
 * fish seen from the bank, facing +x. The `body` origin is the middle of the
 * torso; koi float in the pond, so the shadow is a soft deep-water blur.
 *
 * PRIMARY MARKING: the kohaku pattern — irregular crimson patches on a white
 * body (a big saddle over the shoulders, a smaller one behind it, and a cap on
 * the head). It is the largest, highest-contrast value jump on the fish and
 * is what separates a koi from every other creature (and from a duck on the
 * water) at a baked ~30 px T1 sprite.
 * Secondaries (T2 only): the paired barbels at the mouth, the faint scale-row
 * shimmer along the flank, translucent fin edges with fin rays, and the
 * dorsal fin.
 *
 * Silhouette: a torpedo body deepest just behind the head, tapering to a
 * caudal peduncle, a deep forked tail, a high dorsal, pectoral/pelvic fins.
 * Shading: BODY/SHADE/LIGHT/DEEP in the recipe's paint order (base, mantle,
 * belly light, contact band, rim sliver); the far-side pectoral and pelvic
 * fins are separate parts behind the body in the shade tone.
 *
 * Motion: the body is a chain — `body` (sway), `head` (leads the wave),
 * `rear` (caudal peduncle) and `tailFin` (parented to `rear`) — each driven
 * by the same sine at a later phase, so the S-curve travels head to tail and
 * the tail sweeps with lag. Every joint overlaps its neighbour so nothing
 * parts while it bends. Pixi +rotation is clockwise; the masses here lie
 * along the body axis, so the sign only chooses which side the wave starts.
 * Fish do not step: `strideLength` is the water covered per tail-beat.
 */
import type { CreatureRig, Keyframe, Track } from './format';

// --- the tone system (recipe rule 3) --------------------------------------
const BODY = 0xf2ede2; // base coat: white
const SHADE = 0xc8cdcc; // shade: cool grey on the back and underside
const DEEP = 0x7f8d93; // deep: creases, low alpha only
const LIGHT = 0xfffdf6; // light: belly and the sunlit top sliver
// --- kohaku crimson (primary marking) -------------------------------------
const ORANGE = 0xe07a3f;
const ORANGE_SHADE = 0xb55a2c;
const ORANGE_LIGHT = 0xf3a066;
// --- fins, face, props ----------------------------------------------------
const FIN = 0xf5c9a5;
const FIN_SHADE = 0xd9a07a;
const FIN_LIGHT = 0xfde6d2;
const BARBEL = 0xe9dcc2;
const EYE = 0x262626;
const BERRY = 0xcf5f52;

/** A looping sine track: 8 segments, value at t=1 equals t=0. `phase` lags it. */
function wave(partId: string, amp: number, phase: number, bias = 0): Track {
  const rot: Keyframe[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const v = bias + amp * Math.sin(2 * Math.PI * (t - phase));
    rot.push({ t, v: Math.round(v * 1000) / 1000 });
  }
  return { partId, rot };
}

export const koiRig: CreatureRig = {
  species: 'koi',
  strideLength: 40,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 7, z: -10,
      shapes: [
        { kind: 'ellipse', x: -2, y: 0, rx: 24, ry: 6.5, fill: { color: 0x2f6a78, alpha: 0.15 } },
        { kind: 'ellipse', x: 0, y: 0, rx: 15, ry: 4.5, fill: { color: 0x2f6a78, alpha: 0.22 } },
      ] },

    // --- the torso ---------------------------------------------------------
    { id: 'body', parent: null, x: 0, y: 0, z: 0,
      shapes: [
        { kind: 'path', d: 'M 17 -1.5 C 15 -7 8 -10 1 -9.6 C -5 -9.2 -10 -7 -12 -4.5 L -12 4.5 C -10 7 -5 8.6 1 9 C 8 9.4 15 6.5 17 2.5 Z', fill: { color: BODY } },
        { kind: 'path', d: 'M 16 -2 C 14 -6.5 8 -9.2 1 -8.9 C -5 -8.6 -9.5 -6.6 -11.5 -4.3 C -8 -6 -4 -6.6 1 -6.8 C 7 -7 12 -5.2 16 -2 Z', fill: { color: SHADE, alpha: 0.6 } },
        { kind: 'path', d: 'M 16 3 C 12 6.5 6 8 0 8 C -6 8 -10 6 -11.5 4 C -8 5 -4 5 0 4.8 C 6 4.6 12 3.5 16 0.5 Z', fill: { color: LIGHT, alpha: 0.7 } },
        { kind: 'path', d: 'M 15 4.2 C 13 6.5 8 8.6 1 8.7 C -5 8.5 -9 7 -11 5 C -8 6.8 -4 7.4 1 7.5 C 8 7.5 13 6 15 4.2 Z', fill: { color: DEEP, alpha: 0.3 } },
        { kind: 'path', d: 'M 15.5 -3 C 13 -7.5 8 -9.7 1 -9.4 C -5 -9.1 -9 -7.2 -11 -5 C -7 -7.4 -3 -8.3 1 -8.2 C 7 -8.2 12 -6.5 15.5 -3 Z', fill: { color: LIGHT, alpha: 0.6 } },
        // scale-row shimmer: faint crescents along the flank
        { kind: 'path', d: 'M -7 1.5 C -4.5 2.5 -4.5 5.5 -7 6.5 C -5.8 4.8 -5.8 3.2 -7 1.5 Z', fill: { color: DEEP, alpha: 0.22 } },
        { kind: 'path', d: 'M -1 2 C 1.5 3 1.5 6 -1 7 C 0.2 5.3 0.2 3.7 -1 2 Z', fill: { color: DEEP, alpha: 0.22 } },
        { kind: 'path', d: 'M 6 1.8 C 8.5 2.8 8.5 5.6 6 6.6 C 7.2 5 7.2 3.4 6 1.8 Z', fill: { color: DEEP, alpha: 0.22 } },
      ] },
    // kohaku patches: organic paths hugging the back curve
    { id: 'patch', parent: 'body', x: 0, y: 0, z: 1,
      shapes: [
        { kind: 'path', d: 'M 11 -4.5 C 9.5 -7.4 6 -9 0.5 -8.8 C -3.5 -8.5 -6 -7 -7.5 -4.8 C -5 -5.3 -3 -3.2 0 -3.6 C 3 -2.2 5 -4.6 7.5 -3.4 C 9 -3.2 10 -3.6 11 -4.5 Z', fill: { color: ORANGE, alpha: 0.96 } },
        { kind: 'path', d: 'M 7.5 -3.4 C 5 -4.6 3 -2.2 0 -3.6 C -3 -3.2 -5 -5.3 -7.5 -4.8 C -6 -3.4 -3 -1.6 0.5 -1.9 C 4 -1.4 6.5 -2.2 7.5 -3.4 Z', fill: { color: ORANGE_SHADE, alpha: 0.4 } },
        { kind: 'path', d: 'M 9.5 -6.6 C 8 -8.2 5.5 -8.7 0.5 -8.5 C -3 -8.3 -5 -7.2 -6.2 -5.8 C -3 -7.2 3 -7.4 9.5 -6.6 Z', fill: { color: ORANGE_LIGHT, alpha: 0.7 } },
        { kind: 'path', d: 'M -9.5 -5.6 C -8 -6.8 -6.2 -6.9 -5.2 -5.8 C -4.6 -3.8 -6 -1.6 -8.2 -1.2 C -9.4 -1.6 -10.6 -3.8 -9.5 -5.6 Z', fill: { color: ORANGE, alpha: 0.94 } },
        { kind: 'path', d: 'M -9.4 -2.4 C -7.8 -1.2 -6 -1.4 -5.4 -3 C -5.8 -1.4 -7 -0.4 -8.4 -0.8 Z', fill: { color: ORANGE_SHADE, alpha: 0.4 } },
      ] },

    // --- far-side fins, flat shade masses behind the body -----------------
    { id: 'farPectoral', parent: 'body', x: 6, y: 5, z: -1,
      shapes: [{ kind: 'path', d: 'M 1.5 -2.2 C 4.5 0.5 3 6 -6 9 C -4.6 5 -4.2 1 -2.5 -2.2 Z', fill: { color: FIN_SHADE, alpha: 0.7 } }] },
    { id: 'farPelvic', parent: 'body', x: -4, y: 8, z: -1,
      shapes: [{ kind: 'path', d: 'M 1.5 -1.5 C 3 2 1 5 -4 6 C -3 3 -2.5 0.5 -1.5 -1.5 Z', fill: { color: FIN_SHADE, alpha: 0.65 } }] },

    // --- caudal peduncle and tail, behind the body so the joint is seamless
    { id: 'rear', parent: 'body', x: -10, y: 0, z: -1,
      shapes: [
        { kind: 'path', d: 'M 2 -7 C -3 -6.8 -8 -4.4 -13 -2 L -13 2 C -8 4.4 -3 6.8 2 7 Z', fill: { color: BODY } },
        { kind: 'path', d: 'M 2 -6.6 C -3 -6.4 -8 -4.2 -12.6 -1.9 C -8 -3.6 -3 -4.6 2 -4.6 Z', fill: { color: SHADE, alpha: 0.55 } },
        { kind: 'path', d: 'M 2 7 C -3 6.8 -8 4.4 -13 2 L -13 1 C -8 2.8 -3 5 2 5.4 Z', fill: { color: DEEP, alpha: 0.3 } },
        { kind: 'path', d: 'M 2 -7 C -3 -6.8 -8 -4.4 -13 -2 C -8 -5.3 -3 -6 2 -5.8 Z', fill: { color: LIGHT, alpha: 0.6 } },
      ] },
    { id: 'tailFin', parent: 'rear', x: -12, y: 0, z: -1,
      shapes: [
        { kind: 'path', d: 'M 2 -2 C -3 -6 -7 -9.5 -11 -11 C -8.5 -5.5 -7.5 -2 -8 0 C -7.5 2 -8.5 5.5 -11 11 C -7 9.5 -3 6 2 2 Z', fill: { color: FIN, alpha: 0.9 } },
        { kind: 'path', d: 'M 2 2 C -3 6 -7 9.5 -11 11 C -8.5 5.5 -7.5 2 -8 0 C -5 1.5 -1 2.2 2 0.6 Z', fill: { color: FIN_SHADE, alpha: 0.5 } },
        { kind: 'path', d: 'M 2 -2 C -3 -6 -7 -9.5 -11 -11 C -7 -9.4 -3 -5.6 1.6 -1.2 Z', fill: { color: FIN_LIGHT, alpha: 0.7 } },
        { kind: 'line', x1: 1, y1: -0.6, x2: -9, y2: -8, width: 0.7, fill: { color: FIN_SHADE, alpha: 0.5 } },
        { kind: 'line', x1: 1, y1: 0.6, x2: -9, y2: 8, width: 0.7, fill: { color: FIN_SHADE, alpha: 0.5 } },
      ] },

    // --- dorsal fin --------------------------------------------------------
    { id: 'dorsal', parent: 'body', x: -1, y: -8, z: -1,
      shapes: [
        { kind: 'path', d: 'M -9 3 C -7 -3 -3 -7 2 -7 C 6 -6.5 9 -3 11 3 Z', fill: { color: FIN, alpha: 0.85 } },
        { kind: 'path', d: 'M -9 3 C -7 -3 -3 -7 2 -7 C -2.5 -5.5 -6 -2 -7 3 Z', fill: { color: FIN_LIGHT, alpha: 0.65 } },
        { kind: 'line', x1: -3, y1: 2, x2: -2, y2: -4.8, width: 0.7, fill: { color: FIN_SHADE, alpha: 0.5 } },
        { kind: 'line', x1: 2, y1: 2, x2: 3, y2: -5.6, width: 0.7, fill: { color: FIN_SHADE, alpha: 0.5 } },
        { kind: 'line', x1: 6, y1: 2, x2: 8, y2: -2.6, width: 0.7, fill: { color: FIN_SHADE, alpha: 0.5 } },
      ] },

    // --- near-side paired fins ---------------------------------------------
    { id: 'pectoral', parent: 'body', x: 7, y: 5, z: 2,
      shapes: [
        { kind: 'path', d: 'M 1.5 -2.2 C 4.5 0.5 3 6 -6 9 C -4.6 5 -4.2 1 -2.5 -2.2 Z', fill: { color: FIN, alpha: 0.8 } },
        { kind: 'path', d: 'M 3 3 C 2.4 5.6 -1 7.8 -6 9 C -3 6.6 -0.6 4.2 0.4 1.6 Z', fill: { color: FIN_SHADE, alpha: 0.5 } },
        { kind: 'path', d: 'M 1.5 -2.2 C 3.4 -0.4 3.4 1.6 3 3 C 2.4 1 0.4 -0.8 -0.6 -1.6 Z', fill: { color: FIN_LIGHT, alpha: 0.7 } },
      ] },
    { id: 'pelvic', parent: 'body', x: -3, y: 8, z: 2,
      shapes: [
        { kind: 'path', d: 'M 1.5 -1.5 C 3 2 1 5 -4 6 C -3 3 -2.5 0.5 -1.5 -1.5 Z', fill: { color: FIN, alpha: 0.8 } },
        { kind: 'path', d: 'M 2.2 0.8 C 2.2 3 0.2 5 -4 6 C -1.6 4.2 0 2.4 0.4 0.2 Z', fill: { color: FIN_SHADE, alpha: 0.45 } },
      ] },

    // --- the head: base, jaw shade, cap patch, gill, eye, mouth, barbels ----
    { id: 'head', parent: 'body', x: 11, y: 0, z: 3,
      shapes: [
        { kind: 'path', d: 'M -4 -8 C 2 -8.4 7 -6 10 -2 C 11 -0.5 10.8 1.3 9 2.6 C 6.5 5.5 1 8 -4 8 Z', fill: { color: BODY } },
        { kind: 'path', d: 'M 9 2.6 C 6.5 5.5 1 8 -4 8 L -4 5.8 C 1 6.2 5.5 4.8 8.2 2.8 Z', fill: { color: DEEP, alpha: 0.3 } },
        { kind: 'path', d: 'M 10 -2 C 11 -0.5 10.8 1.3 9 2.6 C 9.5 1 9.6 -0.5 8.4 -2.2 Z', fill: { color: LIGHT, alpha: 0.7 } },
        // head cap of crimson
        { kind: 'path', d: 'M -3.5 -7.6 C 2 -8 7 -5.8 9.5 -2.4 C 6 -3.4 3 -3.2 0 -2.4 C -2 -2.8 -3.2 -4 -3.5 -7.6 Z', fill: { color: ORANGE, alpha: 0.96 } },
        { kind: 'path', d: 'M -3.4 -7.4 C 1.5 -7.8 6 -6.2 8 -3.6 C 4 -6.4 0 -6.4 -3.4 -6.2 Z', fill: { color: ORANGE_LIGHT, alpha: 0.65 } },
        // gill cover crescent
        { kind: 'path', d: 'M -1.5 -6.5 C 0.5 -3 0.5 3 -1.5 6.5 C 1.5 3 1.5 -3 -1.5 -6.5 Z', fill: { color: DEEP, alpha: 0.4 } },
        { kind: 'line', x1: 8.4, y1: 1.4, x2: 10.6, y2: 0.8, width: 0.8, fill: { color: DEEP, alpha: 0.6 } },
        { kind: 'circle', x: 4, y: -1.5, r: 2.6, fill: { color: DEEP, alpha: 0.3 } },
        { kind: 'circle', x: 4, y: -1.5, r: 1.8, fill: { color: EYE } },
        { kind: 'circle', x: 4.5, y: -2.1, r: 0.6, fill: { color: LIGHT } },
        // barbels: short tapered wedges, far one in shade
        { kind: 'path', d: 'M 8.8 0.4 C 11 0.4 13 1.6 13.6 3.6 C 12 3.2 10.4 2.8 9 2.2 Z', fill: { color: SHADE } },
        { kind: 'path', d: 'M 8.6 0.8 C 11.2 1.2 13 3 13.6 6 C 11.6 5 9.8 4.2 8.4 3 Z', fill: { color: BARBEL } },
      ] },
    // A morsel carried home to the fry (M9 task 5) — only ever visible
    // during the 'carry' clip; every other clip hides it via hideInClips.
    { id: 'food', parent: 'head', x: 10, y: 2.5, z: 3,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.2, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.5, y: -0.8, rx: 1.2, ry: 0.7, fill: { color: ORANGE_LIGHT, alpha: 0.6 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit'] },
  ],
  stages: {
    baby: { scale: 0.45, partScale: { tailFin: { x: 1.2, y: 1.2 }, head: { x: 1.15, y: 1.15 } } }, // fry: mostly tail and eye
    juvenile: { scale: 0.7 },
    adult: { scale: 1 },
    elder: { scale: 0.97, tint: 0xdcdce2 },
  },
  clips: {
    idle: {
      durationMs: 2600, // lazy fanning: a slow, shallow S
      tracks: [
        wave('head', 0.03, 0.05),
        wave('rear', 0.07, 0.2),
        wave('tailFin', 0.16, 0.35),
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'pelvic', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.15 }, { t: 1, v: 0 }] },
        { partId: 'farPectoral', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: 0.35 }, { t: 1, v: 0.1 }] },
      ],
    },
    walk: {
      durationMs: 700, // swimming: the wave runs head to tail
      tracks: [
        wave('body', 0.035, 0),
        wave('head', 0.09, -0.08),
        wave('rear', 0.2, 0.18),
        wave('tailFin', 0.42, 0.34),
        { partId: 'dorsal', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: 0.35 }, { t: 1, v: 0.1 }] },
        { partId: 'farPectoral', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: 0.05 }, { t: 1, v: 0.3 }] },
      ],
    },
    sleep: {
      durationMs: 4200, // resting in the shallows, barely a ripple
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: 1.5 }, { t: 1, v: 0 }] },
        wave('rear', 0.03, 0.1),
        wave('tailFin', 0.08, 0.3),
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0 }] },
      ],
    },
    eat: {
      durationMs: 800, // surface gulps: nose tips up, head swells as it takes
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.18 }, { t: 0.6, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', sx: [{ t: 0, v: 1 }, { t: 0.35, v: 1.08 }, { t: 0.5, v: 1 }, { t: 1, v: 1 }],
          sy: [{ t: 0, v: 1 }, { t: 0.35, v: 1.1 }, { t: 0.5, v: 1 }, { t: 1, v: 1 }] },
        wave('rear', 0.14, 0.15),
        wave('tailFin', 0.4, 0.3),
      ],
    },
    social: {
      durationMs: 600, // excited circling flicks
      tracks: [
        wave('body', 0.05, 0),
        wave('head', 0.1, -0.1),
        wave('rear', 0.25, 0.2),
        wave('tailFin', 0.55, 0.38),
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.5 }, { t: 1, v: 0 }] },
      ],
    },
    carry: {
      // Ferrying a morsel home: the same swim, mouth held closed and full (M9 task 5).
      durationMs: 700,
      tracks: [
        wave('body', 0.035, 0, 0.06),
        wave('head', 0.07, -0.08),
        wave('rear', 0.2, 0.18),
        wave('tailFin', 0.42, 0.34),
        { partId: 'dorsal', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: 0.35 }, { t: 1, v: 0.1 }] },
      ],
    },
    sit: {
      // Settled to brood: a gentle squash (M9 task 5).
      durationMs: 1000,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
        wave('tailFin', 0.05, 0.2),
      ],
    },
  },
};
