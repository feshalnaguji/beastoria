/**
 * The frog rig, rebuilt to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14).
 *
 * PRIMARY MARKING: the dark brown temporal mask, a band from the snout
 * through the eye to the eardrum. It is the biggest value jump on the animal
 * and the one patch that separates a frog from the turtle at T1.
 * SECONDARY MARKINGS (T2 only): a golden iris with a horizontal pupil,
 * pale dorsolateral ridge lines, dark crossbars on the hind legs, and a pale
 * lemon throat that pulses.
 *
 * Side view facing +x. The ground line is y = +18 (where `shadow` sits) and
 * every foot lands on it. Silhouette facts: a wide flat head with bulging eyes
 * set on top and no neck, a back sloping down to the rump, and Z-folded hind
 * legs far larger than the forelegs (thigh forward along the flank, shank
 * back, long webbed foot flat on the ground).
 *
 * Shading: three tones (SKIN / SKIN_DARK+SKIN_DEEP / LIGHT+RIM) as flat-alpha
 * layers in the recipe's paint order; the off-side limbs are separate parts
 * behind the body in the shade tone.
 *
 * Rotation sign: +rot swings a hanging limb's far end rearward (-x). The hind
 * thigh and shank are drawn pointing forward / back-down from their pivots, so
 * +rot on the thigh swings the knee down and back; a negative shank rot
 * straightens the leg out behind.
 *
 * Frogs are feedMode 'self': they never play feedGive/feedTake, and the
 * `food` prop stays carry-only.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const SKIN = 0x7fa653; // base coat
const SKIN_DARK = 0x5f8442; // shade: back mantle, off-side limbs
const SKIN_DEEP = 0x3f5a2c; // shade: creases and ground contact, low alpha
const LIGHT = 0xa7c777; // light: lower jaw
const RIM = 0xd7e8a6; // light: sunlit sliver along top edges
// --- markings -------------------------------------------------------------
const MASK = 0x3a281c; // PRIMARY: the temporal mask
const DRUM = 0x5c4029; // eardrum inside the mask
const RIDGE = 0xc9cf8c; // dorsolateral ridges
const BELLY = 0xe8dfa8;
const THROAT = 0xf4e78e; // pale lemon throat
const EYE_GOLD = 0xe8b838;
const PUPIL = 0x1e1815;
const TONGUE = 0xd9707a;
const FLY = 0x4a4441;
const GROUND_SHADE = 0x3d5a2e;

/**
 * The hop (recipe rule 4B). Hind legs stay folded, coil, then extend
 * explosively behind the body, trail through the flight, and fold again as
 * the forelegs reach down to land. t = 0 is the settled crouch (all feet on
 * the ground); the leg chain is back at rest by t = 1.
 *
 *   0.00  crouch
 *   0.14  coil: body dips, nose down, hind legs fold tighter
 *   0.30  launch: thigh/shank unfold, body pitches nose-up, forelegs tuck
 *   0.50  apex: legs fully trailing, body highest
 *   0.72  descent: hind legs begin to fold, forelegs reach forward
 *   0.88  touchdown reach
 *   1.00  crouch
 *
 * Shared by `walk` and `carry` (the frog carries nothing visible but the fly).
 */
const HOP_TRACKS: Track[] = [
  { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.14, v: 1 },
      { t: 0.3, v: -2 },
      { t: 0.5, v: -11 },
      { t: 0.72, v: -6 },
      { t: 0.88, v: -1 },
      { t: 1, v: 0 },
    ],
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: 0.06 },
      { t: 0.3, v: -0.22 },
      { t: 0.5, v: -0.16 },
      { t: 0.72, v: 0.1 },
      { t: 0.88, v: 0.05 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'hindThigh',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.2 },
      { t: 0.3, v: 1.95 },
      { t: 0.5, v: 2.6 },
      { t: 0.72, v: 1.43 },
      { t: 0.88, v: 0.31 },
      { t: 1, v: 0 },
    ],
  },
  {
    // Bends against the thigh, not with it: the joint is real.
    partId: 'hindShank',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: 0.2 },
      { t: 0.3, v: -1.65 },
      { t: 0.5, v: -2.2 },
      { t: 0.72, v: -1.21 },
      { t: 0.88, v: -0.26 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'hindFoot',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.05 },
      { t: 0.3, v: -2.76 },
      { t: 0.5, v: -3.68 },
      { t: 0.72, v: -2.02 },
      { t: 0.88, v: -0.44 },
      { t: 1, v: 0 },
    ],
  },
  {
    // Off-side hind leg: moves with its partner, damped and a hair behind.
    partId: 'hindFar',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.18 },
      { t: 0.3, v: 1.8 },
      { t: 0.5, v: 2.5 },
      { t: 0.72, v: 1.3 },
      { t: 0.88, v: 0.28 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'hindFarShank',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: 0.18 },
      { t: 0.3, v: -1.5 },
      { t: 0.5, v: -2.1 },
      { t: 0.72, v: -1.1 },
      { t: 0.88, v: -0.23 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'hindFarFoot',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.05 },
      { t: 0.3, v: -2.6 },
      { t: 0.5, v: -3.6 },
      { t: 0.72, v: -1.9 },
      { t: 0.88, v: -0.4 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'foreUpper',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.2 },
      { t: 0.3, v: 0.5 },
      { t: 0.5, v: 0.8 },
      { t: 0.72, v: -0.45 },
      { t: 0.88, v: -0.3 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'foreLower',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: 0.2 },
      { t: 0.3, v: -0.3 },
      { t: 0.5, v: -0.6 },
      { t: 0.72, v: 0.3 },
      { t: 0.88, v: 0.15 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'foreFar',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: -0.2 },
      { t: 0.3, v: 0.45 },
      { t: 0.5, v: 0.75 },
      { t: 0.72, v: -0.4 },
      { t: 0.88, v: -0.28 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'head',
    rot: [
      { t: 0, v: 0 },
      { t: 0.14, v: 0.08 },
      { t: 0.3, v: -0.22 },
      { t: 0.5, v: -0.2 },
      { t: 0.72, v: 0.08 },
      { t: 0.88, v: 0.05 },
      { t: 1, v: 0 },
    ],
  },
];

/** One sampled leg-kick used by `swim`: fold, extend, glide, recover. */
const KICK = {
  thigh: [
    { t: 0, v: 0 },
    { t: 0.15, v: -0.2 },
    { t: 0.35, v: 2.6 },
    { t: 0.55, v: 2.6 },
    { t: 0.8, v: 0.78 },
    { t: 1, v: 0 },
  ],
  shank: [
    { t: 0, v: 0 },
    { t: 0.15, v: 0.2 },
    { t: 0.35, v: -2.2 },
    { t: 0.55, v: -2.2 },
    { t: 0.8, v: -0.66 },
    { t: 1, v: 0 },
  ],
  foot: [
    { t: 0, v: 0 },
    { t: 0.15, v: -0.05 },
    { t: 0.35, v: -3.68 },
    { t: 0.55, v: -3.68 },
    { t: 0.8, v: -1.1 },
    { t: 1, v: 0 },
  ],
};

export const frogRig: CreatureRig = {
  species: 'frog',
  // Honest stride (recipe 4C): one hop covers ~20 world px. At the frog's sim
  // speed of 4/tick x 10 ticks/s = 40 px/s that is 2.0 hops per second, inside
  // the 1.4-2.4 band. `walk`'s 500 ms is 20 / 0.04 px-per-ms (rule 4D).
  strideLength: 20,
  parts: [
    {
      // Wide soft pool plus a tighter core under the haunches.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 18,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: -1, y: 0, rx: 25, ry: 6.5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -8, y: 0.5, rx: 14, ry: 4, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // Torso: deepest at the shoulders (top y -13 at x 6), sloping down to
      // the rump (y -9 at x -14); belly at y 15 against ground 18.
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -22 6 Q -23 -4 -14 -9 Q -3 -13 6 -13 Q 16 -11 18 -2 Q 20 8 11 13 Q 0 16 -10 15 Q -21 13 -22 6 Z',
          fill: { color: SKIN },
        },
        {
          // Darker mantle down the back.
          kind: 'path',
          d: 'M -21.5 3 Q -23 -4 -14 -9 Q -3 -13 6 -13 Q 16 -11 18 -2 Q 11 -5.5 3 -5.5 Q -6 -5 -12 -3 Q -18 -1 -21.5 3 Z',
          fill: { color: SKIN_DARK, alpha: 0.5 },
        },
        {
          // Countershaded belly.
          kind: 'path',
          d: 'M -19 10.5 Q -5 13.5 8 11.5 Q 15 9 17.5 2 Q 20 8 11 13 Q 0 16 -10 15 Q -18 13.5 -19 10.5 Z',
          fill: { color: BELLY, alpha: 0.85 },
        },
        {
          // Thin ground-contact band hugging the bottom edge.
          kind: 'path',
          d: 'M 11 13 Q 0 16 -10 15 Q -19.5 13.5 -21.4 9 Q -16 12.2 -8 12.6 Q 2 12.8 8 11.4 Q 11 11 11 13 Z',
          fill: { color: SKIN_DEEP, alpha: 0.25 },
        },
        {
          // Rim light: the outer sliver of the back.
          kind: 'path',
          d: 'M -20.5 -2.75 Q -18.5 -6.5 -14 -9 Q -3 -13 6 -13 Q 11 -12 14 -9.25 Q 8 -9.8 2 -9.8 Q -7 -9.5 -13 -6.5 Q -18 -4.5 -20.5 -2.75 Z',
          fill: { color: RIM, alpha: 0.45 },
        },
        {
          // SECONDARY MARK: the pale dorsolateral ridge, behind the eye to the rump.
          kind: 'path',
          d: 'M 8 -10.5 Q -3 -10 -11 -7 Q -17 -4 -19.5 1 L -18.4 1.6 Q -16 -2.8 -10.6 -5.4 Q -2 -8.6 8 -8.8 Z',
          fill: { color: RIDGE, alpha: 0.6 },
        },
        { kind: 'ellipse', x: -5, y: -6.5, rx: 3.2, ry: 1.9, fill: { color: SKIN_DEEP, alpha: 0.4 } },
        { kind: 'ellipse', x: -12, y: -2.5, rx: 2.8, ry: 1.8, fill: { color: SKIN_DEEP, alpha: 0.4 } },
      ],
    },
    {
      // Off-side hind thigh/shank/foot: flat shade masses behind the body.
      id: 'hindFar',
      parent: 'body',
      x: -6,
      y: 0,
      z: -4,
      shapes: [
        {
          kind: 'path',
          d: 'M -9 -6 Q 0 -11 9 -6 Q 15 -1 13 4 Q 10 8 2 8 Q -8 8 -11 2 Q -12 -3 -9 -6 Z',
          fill: { color: SKIN_DARK },
        },
      ],
    },
    {
      id: 'hindFarShank',
      parent: 'hindFar',
      x: 11,
      y: 3,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -1.5 -3.3 Q -11 -0.5 -21.15 6.45 Q -22.6 9.5 -18.85 11.55 Q -8 5.8 1.5 3.3 Q 4 0.2 -1.5 -3.3 Z',
          fill: { color: SKIN_DARK },
        },
      ],
    },
    {
      id: 'hindFarFoot',
      parent: 'hindFarShank',
      x: -20,
      y: 9,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -3 -2 Q 2 -4 8 -2.5 Q 14 -1.5 19 0.5 Q 22 2.5 20 5 Q 17 6.2 13 6 Q 6 6.3 -1 5.5 Q -4.5 3 -3 -2 Z',
          fill: { color: SKIN_DARK },
        },
      ],
    },
    {
      id: 'foreFar',
      parent: 'body',
      x: 12,
      y: 2,
      z: -3,
      shapes: [
        {
          kind: 'path',
          d: 'M -2 -4 Q 5 -4.5 6 2 Q 6.5 8 4 12 Q 2.5 14.5 0 14.8 Q -3 14 -3 10 Q -4 3 -2 -4 Z',
          fill: { color: SKIN_DARK },
        },
        {
          kind: 'path',
          d: 'M -2 12.5 Q 6 12 13 14.2 Q 15.5 15 13.5 15.8 L 1 15.8 Q -3 15.2 -2 12.5 Z',
          fill: { color: SKIN_DARK },
        },
      ],
    },
    {
      // SECONDARY MARK: the pale lemon throat sac, hanging under the jaw. It
      // pivots at its top edge so `sy` grows it downward as it pulses.
      id: 'throat',
      parent: 'body',
      x: 15,
      y: 1,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -8 0 Q -9 7 -1 10 Q 8 10 9 2 Q 9 0 8 -1 Z',
          fill: { color: THROAT },
        },
        {
          kind: 'path',
          d: 'M -8 2 Q -8 7.5 -1 10 Q 8 10 9 2 Q 5 8 -1 8.2 Q -6 7.8 -8 2 Z',
          fill: { color: SKIN_DEEP, alpha: 0.15 },
        },
        { kind: 'line', x1: 6, y1: 1.5, x2: 7.5, y2: 4.5, width: 0.8, fill: { color: RIM, alpha: 0.5 } },
      ],
    },
    {
      // The big hind thigh, folded forward along the flank.
      id: 'hindThigh',
      parent: 'body',
      x: -10,
      y: 0,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -9 -6 Q 0 -11 9 -6 Q 15 -1 13 4 Q 10 8 2 8 Q -8 8 -11 2 Q -12 -3 -9 -6 Z',
          fill: { color: SKIN },
        },
        {
          kind: 'path',
          d: 'M -11 2 Q -8 8 2 8 Q 10 8 13 4 Q 9 6 2 6 Q -7 6 -11 2 Z',
          fill: { color: SKIN_DEEP, alpha: 0.3 },
        },
        {
          kind: 'path',
          d: 'M -9 -6 Q 0 -11 9 -6 Q 12 -4 13.5 0 Q 8 -7 0 -8 Q -6 -8 -10 -4.5 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
        // SECONDARY MARK: dark crossbars.
        { kind: 'line', x1: -3, y1: -5, x2: -4.5, y2: 4.5, width: 1.7, fill: { color: SKIN_DEEP, alpha: 0.55 } },
        { kind: 'line', x1: 3.5, y1: -5, x2: 2.5, y2: 5.5, width: 1.7, fill: { color: SKIN_DEEP, alpha: 0.55 } },
      ],
    },
    {
      // Knee to ankle, angling back and down: the middle of the Z.
      id: 'hindShank',
      parent: 'hindThigh',
      x: 11,
      y: 3,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -1.5 -3.3 Q -11 -0.5 -21.15 6.45 Q -22.6 9.5 -18.85 11.55 Q -8 5.8 1.5 3.3 Q 4 0.2 -1.5 -3.3 Z',
          fill: { color: SKIN },
        },
        {
          kind: 'path',
          d: 'M -18.85 11.55 Q -8 5.8 1.5 3.3 Q -7 3.6 -16.5 9.2 Q -19.2 10.4 -18.85 11.55 Z',
          fill: { color: SKIN_DEEP, alpha: 0.35 },
        },
        { kind: 'line', x1: -7.28, y1: 0.87, x2: -5.48, y2: 4.87, width: 1.6, fill: { color: SKIN_DEEP, alpha: 0.6 } },
        { kind: 'line', x1: -11.76, y1: 3.1, x2: -10.12, y2: 6.74, width: 1.6, fill: { color: SKIN_DEEP, alpha: 0.6 } },
        { kind: 'line', x1: -16.2, y1: 5.42, x2: -14.8, y2: 8.52, width: 1.5, fill: { color: SKIN_DEEP, alpha: 0.6 } },
      ],
    },
    {
      // The long webbed foot, flat on the ground from the ankle forward.
      id: 'hindFoot',
      parent: 'hindShank',
      x: -20,
      y: 9,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -3 -2 Q 2 -4 8 -2.5 Q 14 -1.5 19 0.5 Q 22 2.5 20 5 Q 17 6.2 13 6 Q 6 6.3 -1 5.5 Q -4.5 3 -3 -2 Z',
          fill: { color: SKIN },
        },
        { kind: 'line', x1: 9, y1: 3.8, x2: 19.5, y2: 4.2, width: 0.7, fill: { color: SKIN_DEEP, alpha: 0.5 } },
        { kind: 'line', x1: 9, y1: 2, x2: 20, y2: 2.3, width: 0.7, fill: { color: SKIN_DEEP, alpha: 0.5 } },
        {
          kind: 'path',
          d: 'M -3 -2 Q 2 -4 8 -2.5 Q 14 -1.5 19 0.5 Q 12 -0.8 7 -1.5 Q 2 -2.6 -2.5 -1 Z',
          fill: { color: RIM, alpha: 0.35 },
        },
      ],
    },
    {
      id: 'foreUpper',
      parent: 'body',
      x: 10,
      y: 3,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -3 -4 Q 4 -4.5 5.5 1.5 Q 4 6.5 -0.5 8.5 Q -5 8.5 -5.5 4.5 Q -5.5 -1 -3 -4 Z',
          fill: { color: SKIN },
        },
        {
          kind: 'path',
          d: 'M -5.5 4.5 Q -5 8.5 -0.5 8.5 Q 4 6.5 5.5 1.5 Q 3 5.5 -0.5 6.2 Q -4 6.5 -5.5 4.5 Z',
          fill: { color: SKIN_DEEP, alpha: 0.3 },
        },
      ],
    },
    {
      // Forearm and hand together; the elbow is the pivot.
      id: 'foreLower',
      parent: 'foreUpper',
      x: -3,
      y: 6,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -4 -3 Q 1.5 -3.5 5.5 2 Q 7 5 5.5 7.5 Q 1 8.5 -3 4.5 Q -5.5 0.5 -4 -3 Z',
          fill: { color: SKIN },
        },
        {
          kind: 'path',
          d: 'M 3 4 Q 9 3.2 15 6 Q 17.5 7.6 15.5 9 Q 11 9.5 7 9.2 Q 3 9 2.5 6 Z',
          fill: { color: SKIN },
        },
        { kind: 'line', x1: 9, y1: 7.2, x2: 15, y2: 8, width: 0.7, fill: { color: SKIN_DEEP, alpha: 0.5 } },
        {
          kind: 'path',
          d: 'M 3 4 Q 9 3.2 15 6 Q 10 4.8 6 5.2 Q 3.5 5.6 3 4 Z',
          fill: { color: RIM, alpha: 0.35 },
        },
      ],
    },
    {
      // Wide flat head, no neck. Eyes sit on top as their own parts.
      id: 'head',
      parent: 'body',
      x: 8,
      y: -4,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 -2 Q -11 -8 -3 -9 Q 6 -10 13 -6 Q 18 -3 17.5 1 Q 17 4.5 12 5.5 Q 2 7 -6 5.5 Q -10.5 4 -10 -2 Z',
          fill: { color: SKIN },
        },
        {
          kind: 'path',
          d: 'M -10.5 -3 Q -11 -8 -3 -9 Q 6 -10 13 -6 Q 18 -3 17.5 1 Q 11 -3 3 -3.5 Q -5 -3.5 -10.5 -3 Z',
          fill: { color: SKIN_DARK, alpha: 0.45 },
        },
        {
          kind: 'path',
          d: 'M -8 4.5 Q 2 7 12 5.5 Q 16 4.5 17.4 2 Q 14 3.3 10 3.6 Q 0 5 -8 3 Z',
          fill: { color: LIGHT, alpha: 0.6 },
        },
        {
          // PRIMARY MARKING: the dark temporal mask, snout through the eye to
          // the eardrum.
          kind: 'path',
          d: 'M 3 -5 Q -3 -6.5 -8 -4.5 Q -11 -2 -9.5 1.5 Q -7 4 -2 3 Q 2 2 3.5 -1 Q 4.5 -3.5 3 -5 Z',
          fill: { color: MASK },
        },
        // The thin canthal line from the nostril to the front of the eye.
        { kind: 'line', x1: 15.5, y1: -2.2, x2: 8, y2: -3.6, width: 1.3, fill: { color: MASK } },
        { kind: 'ellipse', x: -5, y: -0.5, rx: 3, ry: 3, fill: { color: DRUM } },
        // Thin dark mouth line with a pale cream lip line just below it.
        { kind: 'line', x1: 17, y1: 2.6, x2: -6, y2: 4, width: 0.7, fill: { color: MASK, alpha: 0.8 } },
        { kind: 'line', x1: 16.5, y1: 3.6, x2: -4, y2: 5, width: 1, fill: { color: BELLY, alpha: 0.85 } },
        {
          kind: 'path',
          d: 'M -10.5 -3 Q -11 -8 -3 -9 Q 6 -10 13 -6 Q 15.5 -4.5 16.5 -2.5 Q 10 -7.5 4 -8 Q -4 -8 -8 -6.2 Q -10 -5 -10.5 -3 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
      ],
    },
    {
      // Far eye: a shade-toned bulge peeking behind the near one.
      id: 'eyeR',
      parent: 'head',
      x: -4,
      y: -9.5,
      z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 5.6, fill: { color: SKIN_DARK } },
        { kind: 'circle', x: 0, y: 0, r: 4, fill: { color: EYE_GOLD, alpha: 0.85 } },
        { kind: 'ellipse', x: 0, y: 0, rx: 3, ry: 1.1, fill: { color: PUPIL } },
      ],
    },
    {
      // Near eye. SECONDARY MARK: golden iris, horizontal pupil.
      id: 'eyeL',
      parent: 'head',
      x: 3,
      y: -8.5,
      z: 4,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 6.2, fill: { color: SKIN } },
        {
          kind: 'path',
          d: 'M -5.8 1.5 Q -4 5.8 0 6.1 Q 4 5.8 5.8 1.5 Q 3 3.8 0 3.9 Q -3 3.8 -5.8 1.5 Z',
          fill: { color: SKIN_DEEP, alpha: 0.3 },
        },
        { kind: 'circle', x: 0, y: 0, r: 4.6, fill: { color: EYE_GOLD } },
        { kind: 'ellipse', x: 0, y: 0, rx: 3.4, ry: 1.2, fill: { color: PUPIL } },
        {
          kind: 'path',
          d: 'M -5.5 -2.5 Q -3 -6 0 -6.2 Q 3 -6 5.5 -2.5 Q 3 -4.7 0 -4.9 Q -3 -4.7 -5.5 -2.5 Z',
          fill: { color: RIM, alpha: 0.5 },
        },
      ],
    },
    {
      // The snap: hidden in every clip but `eat`, where it shoots out of the
      // mouth (sx 0.02 -> 1).
      id: 'tongue',
      parent: 'head',
      x: 16,
      y: 3,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 -1.2 L 15 -1.5 Q 19 0 15 1.5 L 0 1.2 Z', fill: { color: TONGUE } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'social', 'swim', 'carry', 'sit', 'feedGive', 'feedTake'],
    },
    {
      // A fly carried home (M10 task 3) — only ever visible during 'carry'.
      // Frogs are feedMode 'self', so this is never triggered in play; the
      // prop stays carry-only per the recipe.
      id: 'food',
      parent: 'head',
      x: 17,
      y: 2,
      z: 5,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2, ry: 1.6, fill: { color: FLY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit', 'feedGive', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A froglet is a big head and big eyes on a small body; the leg chain is
      // left alone (recipe 4F).
      scale: 0.45,
      partScale: {
        head: { x: 1.2, y: 1.2 },
        eyeL: { x: 1.15, y: 1.15 },
        eyeR: { x: 1.15, y: 1.15 },
        hindFoot: { x: 0.8, y: 0.9 },
      },
      tint: 0x9fc47a, // paler froglet green
    },
    juvenile: {
      scale: 0.7,
      partScale: { head: { x: 1.08, y: 1.08 }, eyeL: { x: 1.05, y: 1.05 }, eyeR: { x: 1.05, y: 1.05 } },
    },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xb8c2a8 },
  },
  clips: {
    idle: {
      // A still, throat-pulsing wait with a slow blink.
      durationMs: 1600,
      tracks: [
        { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'throat',
          sy: [
            { t: 0, v: 1 },
            { t: 0.2, v: 1.3 },
            { t: 0.4, v: 1 },
            { t: 0.6, v: 1.3 },
            { t: 0.8, v: 1 },
            { t: 1, v: 1 },
          ],
          sx: [
            { t: 0, v: 1 },
            { t: 0.2, v: 1.1 },
            { t: 0.4, v: 1 },
            { t: 0.6, v: 1.1 },
            { t: 0.8, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1.02 },
            { t: 1, v: 1 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.36 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.04 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'eyeL',
          sy: [
            { t: 0, v: 1 },
            { t: 0.9, v: 1 },
            { t: 0.94, v: 0.12 },
            { t: 0.98, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'eyeR',
          sy: [
            { t: 0, v: 1 },
            { t: 0.9, v: 1 },
            { t: 0.94, v: 0.12 },
            { t: 0.98, v: 1 },
            { t: 1, v: 1 },
          ],
        },
      ],
    },
    walk: {
      // The hop. 500 ms is strideLength / speed so playback sits at ~1.0.
      durationMs: 500,
      tracks: HOP_TRACKS,
    },
    sleep: {
      // Squashed into the grass, eyes shut. sy 0.88 with py +2.2 keeps the
      // feet on the shadow line (18 * 0.88 + 2.2 ~ 18).
      durationMs: 3400,
      tracks: [
        { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.88 },
            { t: 0.5, v: 0.86 },
            { t: 1, v: 0.88 },
          ],
          py: [
            { t: 0, v: 2.3 },
            { t: 1, v: 2.3 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.08 },
            { t: 1, v: 0.08 },
          ],
        },
        {
          partId: 'throat',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1.25 },
            { t: 1, v: 1 },
          ],
        },
        { partId: 'eyeL', sy: [{ t: 0, v: 0.12 }, { t: 1, v: 0.12 }] },
        { partId: 'eyeR', sy: [{ t: 0, v: 0.12 }, { t: 1, v: 0.12 }] },
      ],
    },
    eat: {
      // A snap at a passing insect: wind-up, lunge with the tongue, swallow.
      durationMs: 700,
      tracks: [
        {
          partId: 'tongue',
          sx: [
            { t: 0, v: 0.02 },
            { t: 0.25, v: 0.02 },
            { t: 0.34, v: 1 },
            { t: 0.46, v: 0.02 },
            { t: 1, v: 0.02 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.22, v: 0.1 },
            { t: 0.34, v: -0.2 },
            { t: 0.5, v: -0.05 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          px: [
            { t: 0, v: 0 },
            { t: 0.22, v: -1 },
            { t: 0.34, v: 2.5 },
            { t: 0.5, v: 0 },
            { t: 1, v: 0 },
          ],
          rot: [
            { t: 0, v: 0 },
            { t: 0.22, v: 0.04 },
            { t: 0.34, v: -0.08 },
            { t: 0.5, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'eyeL',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1 },
            { t: 0.58, v: 0.3 },
            { t: 0.68, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'eyeR',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1 },
            { t: 0.58, v: 0.3 },
            { t: 0.68, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'throat',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1 },
            { t: 0.58, v: 1.35 },
            { t: 0.68, v: 1 },
            { t: 0.78, v: 1.3 },
            { t: 0.9, v: 1 },
            { t: 1, v: 1 },
          ],
        },
      ],
    },
    social: {
      // A throat-pouch chorus: two big inflations, head lifted to call.
      durationMs: 1000,
      tracks: [
        { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'throat',
          sy: [
            { t: 0, v: 1 },
            { t: 0.12, v: 1.7 },
            { t: 0.3, v: 1.75 },
            { t: 0.42, v: 1 },
            { t: 0.58, v: 1.7 },
            { t: 0.76, v: 1.75 },
            { t: 0.9, v: 1 },
            { t: 1, v: 1 },
          ],
          sx: [
            { t: 0, v: 1 },
            { t: 0.12, v: 1.5 },
            { t: 0.3, v: 1.55 },
            { t: 0.42, v: 1 },
            { t: 0.58, v: 1.5 },
            { t: 0.76, v: 1.55 },
            { t: 0.9, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.12, v: -0.14 },
            { t: 0.3, v: -0.14 },
            { t: 0.42, v: 0 },
            { t: 0.58, v: -0.14 },
            { t: 0.76, v: -0.14 },
            { t: 0.9, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    swim: {
      // Floating on the surface, the hind legs kicking; legs stay visible
      // because the kick is the top-level read of the character.
      durationMs: 700,
      tracks: [
        { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 1.5 },
            { t: 0.7, v: 1 },
            { t: 1, v: 0 },
          ],
        },
        { partId: 'hindThigh', rot: KICK.thigh },
        { partId: 'hindShank', rot: KICK.shank },
        { partId: 'hindFoot', rot: KICK.foot },
        { partId: 'hindFar', rot: KICK.thigh },
        { partId: 'hindFarShank', rot: KICK.shank },
        { partId: 'hindFarFoot', rot: KICK.foot },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.6 },
            { t: 0.6, v: 0.8 },
            { t: 0.9, v: 0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.3 },
            { t: 0.6, v: -0.5 },
            { t: 0.9, v: -0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.55 },
            { t: 0.6, v: 0.75 },
            { t: 0.9, v: 0.25 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.38, v: -0.1 },
            { t: 0.7, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a morsel home: the same hop, shared verbatim with `walk`.
      durationMs: 500,
      tracks: HOP_TRACKS,
    },
    sit: {
      // Settled at the spawn clump: sy 0.9 with py +1.8 keeps the feet on the
      // shadow line (18 * 0.9 + 1.8 ~ 18), throat pulsing slowly.
      durationMs: 1400,
      tracks: [
        { partId: 'tongue', sx: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.9 },
            { t: 1, v: 0.9 },
          ],
          py: [
            { t: 0, v: 1.8 },
            { t: 1, v: 1.8 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.04 },
            { t: 1, v: -0.04 },
          ],
        },
        {
          partId: 'throat',
          sy: [
            { t: 0, v: 1 },
            { t: 0.25, v: 1.25 },
            { t: 0.5, v: 1 },
            { t: 0.75, v: 1.25 },
            { t: 1, v: 1 },
          ],
        },
      ],
    },
  },
};
