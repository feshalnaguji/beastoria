/**
 * The squirrel rig, rebuilt to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14).
 *
 * Side view facing +x. Origin at the body's centre; the ground line is
 * y = +20 (where `shadow` sits), and every foot lands on it.
 *
 * PRIMARY MARKING: the huge bushy tail with a frosted pale fringe, held in an
 * S over the back (the lower sweep bulges back, the upper curl leans forward).
 * It is the largest mass on the animal, and the thing that separates a squirrel
 * from a rabbit at T1.
 * SECONDARY MARKINGS (T2 field marks): dark ear tufts over a blush lining, a
 * pale eye ring, a crisp cream belly bib, dark hands and claws.
 *
 * - SILHOUETTE: compact path torso, bulk at the haunch and the tail; small
 *   rounded ears; short blunt muzzle; big folded hind limb with a long flat
 *   hind foot; short forelimbs that end in little hands.
 * - SHADING: three tones (FUR / FUR_DARK+FUR_DEEP / CREAM+RIM), painted in the
 *   recipe order; the off-side limbs are flat shade masses behind the body.
 * - MOTION: a bounding gallop (both hind legs together, a flight phase, tail
 *   rippling in two segments); and an upright sit on the haunches with the
 *   forepaws raised to the mouth, used by `sit` and `eat`.
 *
 * Rotation sign: +rot is clockwise on screen. A part hanging DOWN from its
 * pivot (every leg) swings its far end REARWARD (-x) with +rot; a part rising
 * UP from its pivot (ears, tail) swings its tip FORWARD (+x). A body rotated
 * negative rears its front end UP.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const FUR = 0xb87a4a; // base coat: russet
const FUR_DARK = 0x9a6038; // shade: mantle, off-side limbs
const FUR_DEEP = 0x6e4226; // deep: creases and ground contact, low alpha only
const CREAM = 0xf2e6d0; // light: bib, chin, eye ring
const RIM = 0xffeed2; // light: sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const TAIL = 0xa8683a; // the big tail, a shade redder than the body
const FRINGE = 0xf3e4c6; // pale frosted tail fringe — primary marking
const BLUSH = 0xe2a8a0; // inner ear
const HANDS = 0x4a3326; // dark hands and claws
const EYE = 0x2a2018;
const NOSE = 0x4e3626;
const NUT = 0x8a6f4d;
const NUT_CAP = 0x5e4630;
const GROUND_SHADE = 0x3d5a2e;

const hold = (partId: string, v: number, channel: 'rot' | 'py' = 'rot'): Track =>
  ({ partId, [channel]: [{ t: 0, v }, { t: 1, v }] }) as Track;

/**
 * The bound (recipe rule 4B). Both hind legs swing together and pass the
 * forefeet, with a flight phase; the tail ripples in two segments, the tip
 * lagging the base. t = 0 is forefoot touchdown.
 *
 *   0.00  forefeet plant, body low, hind legs trailing
 *   0.18  hind legs swing under the belly, folded tight
 *   0.35  hind feet plant ahead of the forefeet
 *   0.50  hind drive, body begins to rise
 *   0.68  apex — airborne, hinds stretched behind, forelegs reaching
 *   0.88  descent
 */
const BOUND_TRACKS: Track[] = [
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.18, v: 1 },
      { t: 0.35, v: 0 },
      { t: 0.5, v: -3 },
      { t: 0.68, v: -9 },
      { t: 0.88, v: -3 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'hindThigh',
    rot: [
      { t: 0, v: 0.45 },
      { t: 0.18, v: -0.05 },
      { t: 0.35, v: -0.38 },
      { t: 0.5, v: -0.1 },
      { t: 0.68, v: 0.55 },
      { t: 0.88, v: 0.55 },
      { t: 1, v: 0.45 },
    ],
  },
  {
    // Bends against the thigh rather than with it — a real joint.
    partId: 'hindShank',
    rot: [
      { t: 0, v: -0.25 },
      { t: 0.18, v: 0.6 },
      { t: 0.35, v: 0.55 },
      { t: 0.5, v: 0.1 },
      { t: 0.68, v: -0.4 },
      { t: 0.88, v: -0.32 },
      { t: 1, v: -0.25 },
    ],
  },
  {
    partId: 'hindFoot',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.18, v: 0.4 },
      { t: 0.35, v: 0.05 },
      { t: 0.5, v: -0.1 },
      { t: 0.68, v: -0.35 },
      { t: 0.88, v: -0.25 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    // The off-side hind leg moves WITH its partner (that is what makes it a
    // bound), damped and a touch behind the beat.
    partId: 'hindFar',
    rot: [
      { t: 0, v: 0.42 },
      { t: 0.18, v: 0 },
      { t: 0.35, v: -0.32 },
      { t: 0.5, v: -0.06 },
      { t: 0.68, v: 0.5 },
      { t: 0.88, v: 0.52 },
      { t: 1, v: 0.42 },
    ],
  },
  {
    partId: 'foreUpper',
    rot: [
      { t: 0, v: -0.42 },
      { t: 0.18, v: -0.12 },
      { t: 0.35, v: 0.3 },
      { t: 0.5, v: 0.4 },
      { t: 0.68, v: 0.1 },
      { t: 0.88, v: -0.32 },
      { t: 1, v: -0.42 },
    ],
  },
  {
    partId: 'foreLower',
    rot: [
      { t: 0, v: 0.3 },
      { t: 0.18, v: 0.1 },
      { t: 0.35, v: 0.5 },
      { t: 0.5, v: 0.55 },
      { t: 0.68, v: 0.25 },
      { t: 0.88, v: 0.05 },
      { t: 1, v: 0.3 },
    ],
  },
  {
    partId: 'foreFar',
    rot: [
      { t: 0, v: -0.36 },
      { t: 0.18, v: -0.08 },
      { t: 0.35, v: 0.26 },
      { t: 0.5, v: 0.36 },
      { t: 0.68, v: 0.08 },
      { t: 0.88, v: -0.28 },
      { t: 1, v: -0.36 },
    ],
  },
  {
    partId: 'foreFarLower',
    rot: [
      { t: 0, v: 0.26 },
      { t: 0.18, v: 0.08 },
      { t: 0.35, v: 0.44 },
      { t: 0.5, v: 0.5 },
      { t: 0.68, v: 0.2 },
      { t: 0.88, v: 0.04 },
      { t: 1, v: 0.26 },
    ],
  },
  {
    partId: 'earL',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.35, v: -0.2 },
      { t: 0.68, v: -0.04 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'earR',
    rot: [
      { t: 0, v: -0.14 },
      { t: 0.35, v: -0.24 },
      { t: 0.68, v: -0.08 },
      { t: 1, v: -0.14 },
    ],
  },
  {
    // The plume streams back in the flight phase and snaps up on landing...
    partId: 'tail',
    rot: [
      { t: 0, v: 0.1 },
      { t: 0.25, v: -0.12 },
      { t: 0.5, v: -0.2 },
      { t: 0.75, v: 0.06 },
      { t: 1, v: 0.1 },
    ],
  },
  {
    // ...and its tip lags the base by about a quarter-beat: the ripple.
    partId: 'tailTip',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.25, v: 0.25 },
      { t: 0.5, v: 0.1 },
      { t: 0.75, v: -0.3 },
      { t: 1, v: -0.1 },
    ],
  },
];

/**
 * The upright sit (squirrel posture): the whole body pitches up onto its
 * haunches, the hind legs fold flat under it, the tail rises behind, and the
 * forepaws are lifted to the mouth. Shared by `sit` and `eat`. The body is
 * rotated about its centre, so every other angle here is chosen to cancel or
 * redirect that pitch: thigh+shank+foot sum to ~1.0 to lay the hind foot flat;
 * the tail's +0.85 brings its S back upright; the head's +0.75 brings the face
 * level; and both arms swing forward and fold (upper about -0.86, lower about -2.2)
 * so the paws meet just under the chin; the tail leans along the spine.
 */
const SIT_POSE: Track[] = [
  // py lifts the pitched body so the haunch and hind feet stay on the shadow line (review: -1 sank them ~12 px).
  { partId: 'body', rot: [{ t: 0, v: -0.95 }, { t: 1, v: -0.95 }], py: [{ t: 0, v: -11 }, { t: 1, v: -11 }] },
  hold('hindThigh', 0.35),
  hold('hindShank', 0.25),
  hold('hindFoot', 0.4),
  hold('hindFar', 0.8),
  hold('foreUpper', -0.86),
  hold('foreLower', -2.17),
  hold('foreFar', -1.02),
  hold('foreFarLower', -2.13),
  // The tail rides the back: pivot nudged up the spine, leaning along it.
  { partId: 'tail', rot: [{ t: 0, v: 1.1 }, { t: 1, v: 1.1 }], px: [{ t: 0, v: 6 }, { t: 1, v: 6 }] },
  hold('tailTip', 0.2),
  hold('earL', -0.1),
  hold('earR', -0.14),
];

export const squirrelRig: CreatureRig = {
  species: 'squirrel',
  // Honest stride (recipe rule 4C): one bound covers 34 world px. At the
  // squirrel's sim speed of 7/tick x 10 ticks/s = 70 px/s that is 70/34 =
  // 2.06 bounds per second, inside the 1.4-2.4 band. `walk`'s 486 ms is
  // 34 / 0.07 px-per-ms, so the playback multiplier sits at ~1.0 (rule 4D).
  strideLength: 34,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 20,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: -2, y: 0, rx: 25, ry: 7.5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -6, y: 0.5, rx: 15, ry: 4.5, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // Compact torso: deepest at the haunch (x -12, top y -15), a shallower
      // shoulder (x 14, top y -10). Paint order per rule 3.
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -26 0 Q -26 -14 -12 -15 Q 4 -14 14 -10 Q 23 -6 22 2 Q 21 10 10 11 Q -6 13 -18 10 Q -26 8 -26 0 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -25 -4 Q -26 -14 -12 -15 Q 4 -14 14 -10 Q 20 -8 22 -2 Q 12 -8 2 -9 Q -10 -10 -18 -9 Q -23 -8 -25 -4 Z',
          fill: { color: FUR_DARK, alpha: 0.55 },
        },
        {
          // SECONDARY: the crisp cream bib on the chest and belly.
          kind: 'path',
          d: 'M 2 9 Q 14 11 20 4 Q 22 -2 19 -5 Q 16 2 10 5 Q 5 7 2 9 Z',
          fill: { color: CREAM, alpha: 0.95 },
        },
        {
          kind: 'path',
          d: 'M -22 7 Q -8 14 10 12 Q 19 10 21 5 Q 21 10 10 11 Q -6 13 -18 10 Q -22 9 -22 7 Z',
          fill: { color: FUR_DEEP, alpha: 0.22 },
        },
        {
          kind: 'path',
          d: 'M -25 -5 Q -26 -14 -12 -15 Q 4 -14 14 -10 Q 18 -8 20 -5 Q 14 -9 4 -12 Q -10 -13 -18 -12 Q -24 -11 -25 -5 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
      ],
    },
    {
      id: 'hindFar',
      parent: 'body',
      x: -14,
      y: -2,
      z: -4,
      shapes: [
        {
          kind: 'path',
          d: 'M -9 -6 Q -13 4 -10 11 Q -10 16 -9 19 Q -9 22 -5 22 L 8 22 Q 11 21 9 19 L -1 18.5 Q 0 14 4 11 Q 7 6 5 0 Q 3 -8 -2 -9 Z',
          fill: { color: FUR_DARK },
        },
        { kind: 'path', d: 'M -9 -2 Q -12 6 -9 12 Q -10 6 -7 -1 Z', fill: { color: FUR_DEEP, alpha: 0.3 } },
        { kind: 'ellipse', x: 9, y: 21, rx: 2.4, ry: 1.2, fill: { color: HANDS, alpha: 0.7 } },
      ],
    },
    {
      id: 'foreFar',
      parent: 'body',
      x: 14,
      y: 4,
      z: -3,
      shapes: [
        { kind: 'path', d: 'M -3.5 -4 Q -5.5 2 -4 7 Q -2 9 0.5 8.5 Q 3 7 3 3 Q 3 -2 3 -4 Z', fill: { color: FUR_DARK } },
      ],
    },
    {
      id: 'foreFarLower',
      parent: 'foreFar',
      x: 0,
      y: 7,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -2.5 -2 Q -4 2 -3 5.5 Q -2 6.5 0.5 6.5 Q 3 6 2.5 4 Q 2.5 0 2.5 -2 Z', fill: { color: FUR_DARK } },
        { kind: 'ellipse', x: 0.5, y: 6.5, rx: 3.2, ry: 1.8, fill: { color: HANDS, alpha: 0.85 } },
      ],
    },
    {
      // PRIMARY MARKING: the bushy tail in an S over the back. The lower sweep
      // bulges back, the upper curl leans forward over the spine. Base coat,
      // shade core, frosted fringe on the outer edge, then a rim highlight.
      id: 'tail',
      parent: 'body',
      x: -22,
      y: -4,
      z: -2,
      shapes: [
        {
          kind: 'path',
          d: 'M 2 4 Q -10 2 -18 -10 Q -24 -26 -14 -38 Q -6 -46 6 -40 Q 0 -38 -2 -30 Q -4 -20 4 -12 Q 10 -6 8 2 Q 6 6 2 4 Z',
          fill: { color: TAIL },
        },
        {
          kind: 'path',
          d: 'M 0 0 Q -12 -8 -12 -22 Q -10 -34 2 -39 Q -4 -30 -6 -22 Q -6 -10 4 -2 Z',
          fill: { color: FUR_DEEP, alpha: 0.3 },
        },
        {
          // The frosted fringe: a pale sliver hugging the outer edge.
          kind: 'path',
          d: 'M 2 4 Q -10 2 -18 -10 Q -24 -26 -14 -38 Q -6 -46 6 -40 Q -2 -42 -10 -36 Q -20 -26 -15 -12 Q -10 -3 2 0 Z',
          fill: { color: FRINGE, alpha: 0.8 },
        },
        {
          kind: 'path',
          d: 'M 8 2 Q 10 -6 4 -12 Q -4 -20 -2 -30 Q 0 -38 6 -40 Q 4 -32 6 -24 Q 8 -14 10 -6 Z',
          fill: { color: FRINGE, alpha: 0.35 },
        },
      ],
    },
    {
      // The tail's upper curl and frosted tip — a separate segment so the
      // plume ripples rather than swinging stiffly.
      id: 'tailTip',
      parent: 'tail',
      x: -2,
      y: -34,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -8 4 Q -10 -6 0 -9 Q 10 -9 11 -2 Q 6 -4 2 -2 Q -2 3 -8 4 Z',
          fill: { color: TAIL },
        },
        {
          kind: 'path',
          d: 'M -2 -6 Q 4 -10 10 -5 Q 12 -2 11 -2 Q 6 -4 2 -2 Q 0 -3 -2 -6 Z',
          fill: { color: FRINGE, alpha: 0.85 },
        },
      ],
    },
    {
      // The haunch — big, proud of the flank.
      id: 'hindThigh',
      parent: 'body',
      x: -14,
      y: -2,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 -6 Q -14 4 -9 11 Q -4 15 3 12 Q 8 8 6 0 Q 4 -8 -2 -9 Q -7 -10 -10 -6 Z',
          fill: { color: FUR },
        },
        { kind: 'path', d: 'M -11 -1 Q -14 6 -8 12 Q -11 5 -9 -2 Z', fill: { color: FUR_DEEP, alpha: 0.25 } },
        { kind: 'path', d: 'M -10 -6 Q -7 -10 -2 -9 Q 4 -8 6 0 Q 3 -5.5 -2 -6 Q -6 -6.5 -10 -6 Z', fill: { color: RIM, alpha: 0.4 } },
      ],
    },
    {
      id: 'hindShank',
      parent: 'hindThigh',
      x: 3,
      y: 10,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -3 Q -7 0 -8 4 Q -8 7 -5 7 Q -1 7 1 3 Q 2 0 3 -3 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -3 -2 Q -6 1 -7 5 Q -7 6.5 -5 7 Q -6 3 -3 -1 Z', fill: { color: FUR_DEEP, alpha: 0.22 } },
      ],
    },
    {
      // The long flat hind foot, lying along the ground under the rump.
      id: 'hindFoot',
      parent: 'hindShank',
      x: -5,
      y: 6,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -3 -3 Q -6 -1 -5 2 Q -4 5 0 5.5 L 10 5.5 Q 14 5 13 2.5 Q 12 0.5 9 0.5 L 3 -0.5 Q 1 -3 -3 -3 Z',
          fill: { color: FUR },
        },
        { kind: 'ellipse', x: 4, y: -0.5, rx: 6, ry: 1.4, fill: { color: RIM, alpha: 0.3 } },
        { kind: 'ellipse', x: 12, y: 3.2, rx: 2.4, ry: 1.8, fill: { color: HANDS } },
      ],
    },
    {
      id: 'foreUpper',
      parent: 'body',
      x: 15,
      y: 4,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -3.5 -4 Q -5.5 2 -4 7 Q -2 9 0.5 8.5 Q 3 7 3 3 Q 3 -2 3 -4 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -3.5 -3 Q -5.5 2 -4 6.5 Q -2.5 8 -1 8 Q -3 4 -2 -2 Z', fill: { color: FUR_DEEP, alpha: 0.2 } },
      ],
    },
    {
      id: 'foreLower',
      parent: 'foreUpper',
      x: 0,
      y: 7,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -2.5 -2 Q -4 2 -3 5.5 Q -2 6.5 0.5 6.5 Q 3 6 2.5 4 Q 2.5 0 2.5 -2 Z', fill: { color: FUR } },
        // SECONDARY: dark hands and claws.
        { kind: 'ellipse', x: 0.5, y: 6.5, rx: 3.4, ry: 1.8, fill: { color: HANDS } },
        { kind: 'line', x1: 2.4, y1: 7.6, x2: 4.4, y2: 8.4, width: 0.8, fill: { color: HANDS } },
      ],
    },
    {
      // Skull only; the muzzle is its own part. Carries the pale eye ring.
      id: 'head',
      parent: 'body',
      x: 20,
      y: -11,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 3 Q -12 -7 -3 -11 Q 6 -13 11 -6 Q 14 -1 12 4 Q 8 10 0 10 Q -8 10 -10 3 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -11 0 Q -12 -7 -3 -11 Q 6 -13 11 -6 Q 12.5 -4 13 -1 Q 8 -6 2 -7 Q -6 -8 -11 0 Z',
          fill: { color: FUR_DARK, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M -7 5 Q -2 10 4 9.5 Q 10 8 12 4 Q 8 7.5 2 7.5 Q -4 7.5 -7 5 Z',
          fill: { color: CREAM, alpha: 0.6 },
        },
        {
          kind: 'path',
          d: 'M -11 -1 Q -12 -7 -3 -11 Q 6 -13 11 -6 Q 12.5 -5 13 -3 Q 8 -9 2 -10.5 Q -6 -11 -11 -1 Z',
          fill: { color: RIM, alpha: 0.38 },
        },
        { kind: 'ellipse', x: 4, y: -2.5, rx: 4.8, ry: 4.3, fill: { color: CREAM, alpha: 0.8 } },
        { kind: 'circle', x: 4.2, y: -2.5, r: 2.7, fill: { color: EYE } },
        { kind: 'circle', x: 5.2, y: -3.5, r: 0.9, fill: { color: 0xffffff, alpha: 0.85 } },
      ],
    },
    {
      // Short blunt muzzle; the nose works constantly (py tracks).
      id: 'muzzle',
      parent: 'head',
      x: 8,
      y: 2,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -5 -5 Q 2 -6 5 -2 Q 7 1 5 3 Q 2 6 -3 5 Q -6 3 -5 -5 Z', fill: { color: FUR } },
        { kind: 'ellipse', x: 0, y: 3, rx: 4.5, ry: 2.4, fill: { color: CREAM, alpha: 0.65 } },
        { kind: 'ellipse', x: 5.2, y: -1.2, rx: 1.9, ry: 1.5, fill: { color: NOSE } },
        { kind: 'line', x1: 4.5, y1: 1, x2: 2.5, y2: 3.2, width: 0.8, fill: { color: FUR_DEEP, alpha: 0.5 } },
        { kind: 'line', x1: 5, y1: -0.5, x2: 12, y2: -4.5, width: 0.6, fill: { color: RIM, alpha: 0.35 } },
        { kind: 'line', x1: 5.5, y1: 0.6, x2: 12.5, y2: 0.6, width: 0.6, fill: { color: RIM, alpha: 0.35 } },
      ],
    },
    {
      // Small rounded ear with a dark tuft.
      id: 'earL',
      parent: 'head',
      x: -3,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M -4 2 Q -6 -6 -2 -9 Q 2 -10 4 -6 Q 5 -1 4 2 Q 0 4 -4 2 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -2.4 1 Q -4 -5 -1.5 -7 Q 1 -7.5 2.4 -5 Q 3 -1 2.2 1 Q 0 2 -2.4 1 Z', fill: { color: BLUSH, alpha: 0.7 } },
        // SECONDARY: the ear tuft.
        { kind: 'path', d: 'M -2.4 -8 Q -3.6 -14 -1.4 -19 Q 0.2 -14 1.8 -8.5 Z', fill: { color: FUR_DEEP, alpha: 0.9 } },
        { kind: 'path', d: 'M 3.4 -1 Q 6 -6 2.6 -9 Q 4.8 -5 3 1 Z', fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      id: 'earR',
      parent: 'head',
      x: 3,
      y: -9,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M -4 2 Q -6.5 -6 -2 -9.5 Q 2 -10.5 4 -6 Q 5 -1 4 2 Q 0 4 -4 2 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -2 1 Q -3.5 -5 -1 -7 Q 1 -7.5 2 -5 Q 2.6 -1 2 1 Z', fill: { color: BLUSH, alpha: 0.4 } },
        { kind: 'path', d: 'M -2.4 -8.5 Q -3.8 -14.5 -1.6 -19.5 Q 0 -14.5 1.8 -9 Z', fill: { color: FUR_DEEP, alpha: 0.8 } },
      ],
    },
    {
      // An acorn carried home to the kits — visible only during 'carry'. The
      // squirrel's feedMode is 'nurse', so feedGive/feedTake hide it too.
      id: 'food',
      parent: 'head',
      x: 14,
      y: 5,
      z: 4,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 3, fill: { color: NUT } },
        { kind: 'path', d: 'M -2.8 -1 Q -2.6 -3.6 0 -3.8 Q 2.6 -3.6 2.8 -1 Q 0 -2 -2.8 -1 Z', fill: { color: NUT_CAP } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedGive', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A kit: big blunt head, tiny ears, a not-yet-full plume. Leg chain is
      // untouched (rule 4F) so the feet stay on the shadow line.
      scale: 0.5,
      partScale: {
        head: { x: 1.3, y: 1.3 },
        muzzle: { x: 0.8, y: 0.88 },
        earL: { x: 0.8, y: 0.7 },
        earR: { x: 0.8, y: 0.7 },
        tail: { x: 0.6, y: 0.6 },
        hindFoot: { x: 0.75, y: 0.9 },
      },
    },
    juvenile: {
      scale: 0.72,
      partScale: {
        head: { x: 1.1, y: 1.1 },
        earL: { x: 0.95, y: 0.85 },
        earR: { x: 0.95, y: 0.85 },
        tail: { x: 0.85, y: 0.85 },
      },
    },
    adult: { scale: 1 },
    elder: { scale: 0.94, tint: 0xc9bdae },
  },
  clips: {
    idle: {
      // Quick, alert pauses: a look-around, ear flicks, a twitching nose, a
      // tail that never quite settles.
      durationMs: 1100,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.2 },
            { t: 0.55, v: 0.15 },
            { t: 0.8, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.1, v: -0.6 },
            { t: 0.2, v: 0 },
            { t: 0.3, v: -0.6 },
            { t: 0.4, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.45, v: 0 },
            { t: 0.52, v: 0.3 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.12 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tailTip',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.18 },
            { t: 0.7, v: 0.2 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // The bound — see BOUND_TRACKS. 486 ms = strideLength / speed.
      durationMs: 486,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.06 },
            { t: 0.35, v: 0 },
            { t: 0.68, v: -0.1 },
            { t: 1, v: 0.06 },
          ],
        },
      ],
    },
    sleep: {
      // Curled up with the plume pulled forward over the back. `sy` 0.9 with
      // `py` +2 keeps the feet on the shadow line (20 * 0.9 + 2 = 20).
      durationMs: 3000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.9 },
            { t: 0.5, v: 0.86 },
            { t: 1, v: 0.9 },
          ],
          py: [
            { t: 0, v: 2 },
            { t: 1, v: 2 },
          ],
        },
        hold('tail', 1.25),
        hold('tailTip', 0.35),
        {
          partId: 'head',
          rot: [{ t: 0, v: 0.3 }, { t: 1, v: 0.3 }],
          py: [{ t: 0, v: 5 }, { t: 1, v: 5 }],
        },
        hold('earL', -0.5),
        hold('earR', -0.6),
        hold('hindThigh', -0.15),
        hold('hindShank', 0.35),
        hold('hindFoot', 0.15),
        hold('hindFar', -0.15),
        hold('foreUpper', -0.3),
        hold('foreLower', 0.55),
        hold('foreFar', -0.28),
        hold('foreFarLower', 0.55),
      ],
    },
    eat: {
      // Sat up on the haunches, nibbling an acorn held in both hands: the
      // upright pose (SIT_POSE) with the head bobbing and the nose working.
      durationMs: 700,
      tracks: [
        ...SIT_POSE.filter((t) => t.partId !== 'foreLower' && t.partId !== 'foreUpper'),
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: -0.86 },
            { t: 0.25, v: -0.8 },
            { t: 0.5, v: -0.86 },
            { t: 0.75, v: -0.8 },
            { t: 1, v: -0.86 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: -2.17 },
            { t: 0.25, v: -2.07 },
            { t: 0.5, v: -2.17 },
            { t: 0.75, v: -2.07 },
            { t: 1, v: -2.17 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.75 },
            { t: 0.25, v: 0.9 },
            { t: 0.5, v: 0.75 },
            { t: 0.75, v: 0.9 },
            { t: 1, v: 0.75 },
          ],
          py: [
            { t: 0, v: 3 },
            { t: 0.25, v: 4 },
            { t: 0.5, v: 3 },
            { t: 0.75, v: 4 },
            { t: 1, v: 3 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.12, v: -0.7 },
            { t: 0.25, v: 0.2 },
            { t: 0.37, v: -0.7 },
            { t: 0.5, v: 0.2 },
            { t: 0.62, v: -0.7 },
            { t: 0.75, v: 0.2 },
            { t: 0.87, v: -0.7 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      durationMs: 800,
      tracks: [
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.3 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tailTip',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: -0.3 },
            { t: 0.5, v: 0.2 },
            { t: 0.75, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.15 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.25 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching an acorn home: the same bound, head tucked low.
      durationMs: 486,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.35 },
            { t: 0.5, v: 0.45 },
            { t: 1, v: 0.35 },
          ],
        },
      ],
    },
    sit: {
      // Upright on the haunches, forepaws at the mouth, the plume rising
      // behind. The muzzle keeps working so the pose is never frozen.
      durationMs: 1000,
      tracks: [
        ...SIT_POSE.filter((t) => t.partId !== 'tailTip'),
        {
          partId: 'head',
          rot: [{ t: 0, v: 0.75 }, { t: 1, v: 0.75 }],
          py: [{ t: 0, v: 3 }, { t: 1, v: 3 }],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.5 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -0.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tailTip',
          rot: [
            { t: 0, v: 0.2 },
            { t: 0.5, v: 0.3 },
            { t: 1, v: 0.2 },
          ],
        },
      ],
    },
    feedGive: {
      // Played by the mother during a feeding interaction: a gentle downward
      // lean of the head toward the kits — shallower than 'eat's graze dip
      // and held, since this is nursing rather than nibbling (M13 task 12).
      // The head tracks are the ones authored in M13, unchanged; the plume
      // settles into a raised, held curl while she nurses.
      durationMs: 900,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.3 },
            { t: 0.65, v: 0.3 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 2 },
            { t: 0.65, v: 2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.3 },
            { t: 0.35, v: 0.55 },
            { t: 0.65, v: 0.55 },
            { t: 1, v: 0.3 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the kit: the head stretches up from its resting height to
      // meet the mother partway — the mirror of 'feedGive' (M13 task 12). The
      // tail carries the kit's eagerness: a quick, low double-flick.
      durationMs: 850,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.3 },
            { t: 0.65, v: -0.3 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -3 },
            { t: 0.65, v: -3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.3 },
            { t: 0.38, v: 0 },
            { t: 0.46, v: -0.3 },
            { t: 0.54, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
