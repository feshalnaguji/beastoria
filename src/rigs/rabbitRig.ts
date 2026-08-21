/**
 * The rabbit rig — the first rig built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M12 task 6).
 *
 * Side view facing +x. Origin sits at the body's centre of mass; the ground
 * line is y = +26 (where the `shadow` part sits), and every foot lands on it.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: a `path` torso with the bulk at the rump and almost no
 *   belly-to-ground gap, ears longer than the skull is tall, and a long hind
 *   foot lying flat on the ground. Blacked out, that is a rabbit and not a
 *   squirrel.
 * - MARKINGS (the naming set): PRIMARY is the white cotton scut, the biggest
 *   value jump on the animal and the one mark that survives a T1 bake.
 *   Secondaries — pale eye ring, dark ear rims over blush lining, cream chin
 *   and countershaded belly — are true wild-rabbit field marks that reward
 *   T2. Deliberately NOT a nose blaze: that is a domestic-breed marking and
 *   would read as an escaped pet rather than a valley rabbit.
 * - SHADING: three tones (FUR / FUR_DARK+FUR_DEEP / CREAM+RIM) layered as
 *   flat-alpha shapes in the recipe's paint order — base, back mantle, belly
 *   countershading, contact band, rim sliver. No gradient fill kind exists;
 *   `format.ts` is untouched. The off-side legs are separate parts behind the
 *   body in the shade tone, which is where most of the depth comes from.
 * - MOTION: a real bound, not a trot. Both hind legs swing together and pass
 *   the forefeet, there is a flight phase, and the hind limb bends at knee
 *   and hock because it is three parts instead of one stub ellipse.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const FUR = 0xdecdad; // base coat: warm agouti sand
const FUR_DARK = 0xb69f7b; // shade: back mantle, off-side limbs
const FUR_DEEP = 0x8f7a5c; // shade: creases and ground contact, low alpha only
const CREAM = 0xf7f0e2; // light: belly, chin, eye ring
const RIM = 0xfffaf0; // light: the sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const SCUT = 0xfdf8ef; // the cotton tail — primary marking
const BLUSH = 0xe8b6bf; // inner ear lining
const EAR_RIM = 0x7a6650; // dark ear tip rim
const EYE = 0x3a2f28;
const NOSE = 0xc98a92;
const BERRY = 0xcf5f52; // the carried morsel, shared with every other rig
const GROUND_SHADE = 0x3d5a2e;

/**
 * The bound (recipe rule 4B). A rabbit does not trot: both hind legs swing
 * together, the hind feet pass outside the forefeet, and there is a real
 * flight phase. t = 0 is forefoot touchdown.
 *
 *   0.00  forefeet plant, body at its lowest, hind legs still trailing
 *   0.18  weight rolls forward; hind legs swing under the belly, folded tight
 *   0.35  hind feet plant ahead of the forefeet; forefeet lift
 *   0.50  hind drive: knee and hock extend, the body starts to rise
 *   0.68  apex — airborne, hinds stretched behind, forelegs reaching forward
 *   0.88  descent, forelegs stretched down to meet the ground
 *   1.00  back to touchdown
 *
 * Shared by `walk` and `carry` so the two can never drift apart; each clip
 * adds its own `head` track on top (carry tucks the head down over the
 * berry). Rotation sign: +rot swings a limb's far end rearward (-x), and
 * swings an ear's tip forward (+x), because ears point up and legs point down.
 */
const BOUND_TRACKS: Track[] = [
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.18, v: 1 },
      { t: 0.35, v: 0 },
      { t: 0.5, v: -4 },
      { t: 0.68, v: -11 },
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
    // Bends against the thigh rather than with it — the joint is real
    // (recipe rule 4A's articulation test).
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
    // The off-side hind leg moves WITH its partner (that is what makes this a
    // bound), just damped and a touch behind the beat.
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
    partId: 'earL',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.35, v: -0.16 },
      { t: 0.68, v: -0.02 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'earR',
    rot: [
      { t: 0, v: -0.13 },
      { t: 0.35, v: -0.2 },
      { t: 0.68, v: -0.05 },
      { t: 1, v: -0.13 },
    ],
  },
  {
    partId: 'tail',
    rot: [
      { t: 0, v: 0.05 },
      { t: 0.5, v: -0.08 },
      { t: 1, v: 0.05 },
    ],
  },
];

export const rabbitRig: CreatureRig = {
  species: 'rabbit',
  // Honest stride (recipe rule 4C): one bound covers 34 world px, a little
  // over half the 62 px torso — a calm lope, not a scurry. At the rabbit's
  // sim speed of 6/tick × 10 ticks/s = 60 px/s that is 60/34 = 1.76 bounds
  // per second, inside the 1.4–2.4 band for a bounding mammal. `walk`'s
  // 570 ms duration is 34 / 0.06 px-per-ms, so the renderer's playback-rate
  // multiplier sits at ≈ 1.0 while cruising (rule 4D).
  strideLength: 34,
  parts: [
    {
      // Two ellipses, not one: a wide soft pool plus a tighter darker core
      // under the haunches, where the weight actually is.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 26,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: -4, y: 0, rx: 32, ry: 8.5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -6, y: 0.5, rx: 20, ry: 5, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The torso: deepest and highest at the rump (x -18, top y -20),
      // tapering to a shallower chest (x 14, top y -10), belly at y 16 with
      // the ground at 26 — a rabbit's near-zero ground clearance.
      // Paint order per recipe rule 3: base, back mantle, belly
      // countershading, contact band, rim sliver.
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -38 -4 Q -34 -20 -18 -20 Q 2 -18 14 -10 Q 24 -6 24 2 Q 24 12 12 15 Q -6 19 -22 16 Q -34 12 -38 -4 Z',
          fill: { color: FUR },
        },
        {
          // Darker guard-hair mantle down the spine.
          kind: 'path',
          d: 'M -37 -7 Q -34 -20 -18 -20 Q 2 -18 14 -10 Q 20 -7 23 -1 Q 11 -7 3 -9 Q -7 -11 -14 -10 Q -30 -9 -37 -7 Z',
          fill: { color: FUR_DARK, alpha: 0.55 },
        },
        {
          // Countershaded belly — a marking as much as a tone.
          kind: 'path',
          d: 'M -28 8 Q -10 17 8 14 Q 18 11 22 4 Q 14 10 0 11 Q -14 12 -28 8 Z',
          fill: { color: CREAM, alpha: 0.75 },
        },
        {
          // Thin ground-contact band hugging the bottom silhouette edge.
          kind: 'path',
          d: 'M -34 10 Q -22 17 -4 18 Q 10 17 20 11 Q 23 9 24 5 Q 24 12 12 15 Q -6 19 -22 16 Q -32 13 -34 10 Z',
          fill: { color: FUR_DEEP, alpha: 0.2 },
        },
        {
          // Rim light: the outer 2–3 px of the back, sitting on the mantle.
          kind: 'path',
          d: 'M -37 -6 Q -34 -20 -18 -20 Q 2 -18 14 -10 Q 19 -7 22 -2 Q 17 -6 12 -8 Q 0 -15 -18 -17 Q -32 -17 -35 -5 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
      ],
    },
    {
      // Off-side hind leg: a flat shade mass behind the body. Most of the
      // rig's perceived depth comes from this part and `foreFar`.
      id: 'hindFar',
      parent: 'body',
      x: -13,
      y: -3,
      z: -4,
      shapes: [
        { kind: 'path', d: 'M -7 -3 Q -15 8 -11 19 Q -8 26 -1 28 Q 4 25 1 19 Q 4 9 5 -2 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -6 24 Q -8 28 -3 28.5 L 15 28.5 Q 19 27 16 24 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -7 0 Q -13 9 -10 18 Q -8 24 -4 26 Q -9 19 -9 11 Q -9 5 -5 0 Z', fill: { color: FUR_DEEP, alpha: 0.3 } },
      ],
    },
    {
      id: 'foreFar',
      parent: 'body',
      x: 13,
      y: 4,
      z: -3,
      shapes: [
        { kind: 'path', d: 'M -3.5 -4 Q -6.5 8 -4.5 15 Q -3.5 20 0 21 Q 3.5 20 3.5 14 Q 3.5 6 3 -4 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -4.5 18 Q -6 21 -1 21.5 Q 4 21.5 4 18.5 Q 3.5 16.5 0 16.5 Z', fill: { color: FUR_DARK } },
      ],
    },
    {
      // PRIMARY MARKING: the cotton scut. Placed so it breaks the rump's
      // silhouette rather than sitting inside it, and near-white so it
      // survives being baked down to a ~30 px T1 sprite.
      id: 'tail',
      parent: 'body',
      x: -34,
      y: 1,
      z: -2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 10.5, fill: { color: SCUT } },
        { kind: 'ellipse', x: 1.5, y: 4, rx: 8, ry: 5, fill: { color: FUR_DARK, alpha: 0.3 } },
        { kind: 'ellipse', x: -1.5, y: -3.5, rx: 6.5, ry: 4.5, fill: { color: RIM, alpha: 0.7 } },
      ],
    },
    {
      // The haunch — the powerhouse, and the reason a rabbit's mass reads as
      // rear-heavy. Sits proud of the flank rather than hidden behind it.
      id: 'hindThigh',
      parent: 'body',
      x: -13,
      y: -3,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -11 -6 Q -15 6 -10 15 Q -4 21 4 18 Q 9 13 8 3 Q 6 -7 -1 -9 Q -8 -10 -11 -6 Z',
          fill: { color: FUR },
        },
        { kind: 'path', d: 'M -13 0 Q -15 9 -9 16 Q -12 7 -10 -1 Z', fill: { color: FUR_DEEP, alpha: 0.25 } },
        { kind: 'ellipse', x: 0, y: -1, rx: 6.5, ry: 6, fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      // Knee to hock, angling down and BACK — the middle of the rabbit's
      // folded Z-shaped hind limb.
      id: 'hindShank',
      parent: 'hindThigh',
      x: 4,
      y: 16,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -4 Q -8 1 -9 6 Q -10 10 -6 11 Q -1 11 1 6 Q 3 1 4 -4 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -3 -2 Q -7 3 -8 8 Q -9 10.5 -6 11 Q -8 7 -6 3 Z', fill: { color: FUR_DEEP, alpha: 0.22 } },
      ],
    },
    {
      // The long hind foot, flat on the ground from x -22 to x 0 in body
      // space. This is the silhouette fact that separates a rabbit from
      // every other small mammal in the valley.
      id: 'hindFoot',
      parent: 'hindShank',
      x: -7,
      y: 8,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -3 -4 Q -6.5 -1.5 -6 2 Q -5 5 -1 5 L 12 4.5 Q 15.5 3.5 14.5 1 Q 13.5 -1 10 -1 L 2 -2 Q 0.5 -4 -3 -4 Z',
          fill: { color: FUR },
        },
        { kind: 'ellipse', x: 4, y: -1.5, rx: 8, ry: 1.8, fill: { color: RIM, alpha: 0.35 } },
        { kind: 'ellipse', x: 13, y: 2.5, rx: 2.2, ry: 2, fill: { color: FUR_DARK } },
      ],
    },
    {
      id: 'foreUpper',
      parent: 'body',
      x: 16,
      y: 3,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -4.5 -5 Q -7 2 -5 9 Q -3 12 0 12 Q 3 11 3.5 6 Q 4 0 3.5 -5 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -4.5 -4 Q -6.5 2 -5 8.5 Q -3.5 11 -1.5 11.5 Q -4 6 -3 -2 Z', fill: { color: FUR_DEEP, alpha: 0.2 } },
      ],
    },
    {
      id: 'foreLower',
      parent: 'foreUpper',
      x: 0,
      y: 10,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -3 Q -5 2 -4 8 Q -3.5 12 -0.5 12.5 Q 2.5 12 2.5 8 Q 3 2 2.5 -3 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -4.5 9 Q -6.5 12.5 -1.5 13 Q 3.5 13 3.5 9.5 Q 3 7.5 0 7.5 Z', fill: { color: FUR } },
      ],
    },
    {
      // Skull only — the muzzle is its own part below, so the face has a
      // real brow-to-nose break instead of being one circle. Kept as `head`
      // so M12 task 2's feedGive/feedTake tracks land on the same part
      // playing the same role.
      id: 'head',
      parent: 'body',
      x: 24,
      y: -14,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -13 4 Q -15 -8 -5 -13 Q 6 -17 13 -9 Q 18 -4 16 3 Q 12 11 2 12 Q -9 12 -13 4 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -14 0 Q -15 -9 -5 -13 Q 6 -17 13 -9 Q 15.5 -6.5 16.5 -3 Q 11 -7 3 -9 Q -7 -10 -14 1 Z',
          fill: { color: FUR_DARK, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M -10 5 Q -4 12 4 11 Q 12 9.5 15.5 3 Q 12 8 3 8.5 Q -5 9 -10 5 Z',
          fill: { color: CREAM, alpha: 0.55 },
        },
        {
          kind: 'path',
          d: 'M -14 -1 Q -15 -9 -5 -13 Q 6 -17 13 -9 Q 15 -7 16 -4.5 Q 10.5 -11 3 -13.5 Q -6 -14.5 -14 -1 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
        // SECONDARY MARKING: the pale eye ring — the single thing that makes
        // the eye read as an eye rather than a dot once you zoom to T2.
        { kind: 'ellipse', x: 6, y: -4, rx: 5, ry: 4.4, fill: { color: CREAM, alpha: 0.5 } },
        { kind: 'circle', x: 6, y: -4, r: 2.9, fill: { color: EYE } },
        { kind: 'circle', x: 7.2, y: -5.2, r: 1, fill: { color: 0xffffff, alpha: 0.8 } },
      ],
    },
    {
      // SECONDARY MARKING: cream chin, and a nose that twitches. The muzzle
      // carries its own `py` track in almost every clip — a rabbit's nose is
      // never still, and it costs one keyframe list.
      id: 'muzzle',
      parent: 'head',
      x: 12,
      y: 1,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -7 -6 Q 2 -7 7 -2 Q 10 1 8 4 Q 4 8 -3 7 Q -8 5 -7 -6 Z', fill: { color: FUR } },
        { kind: 'ellipse', x: 1, y: 4, rx: 6, ry: 3, fill: { color: CREAM, alpha: 0.6 } },
        { kind: 'ellipse', x: 7, y: -0.5, rx: 2.4, ry: 1.9, fill: { color: NOSE } },
        { kind: 'line', x1: 6, y1: 1.6, x2: 4.5, y2: 4.5, width: 0.9, fill: { color: FUR_DEEP, alpha: 0.5 } },
        { kind: 'line', x1: 8, y1: -1, x2: 16, y2: -6, width: 0.7, fill: { color: RIM, alpha: 0.35 } },
        { kind: 'line', x1: 8, y1: 0.4, x2: 17, y2: -0.5, width: 0.7, fill: { color: RIM, alpha: 0.35 } },
        { kind: 'line', x1: 8, y1: 1.8, x2: 16, y2: 4, width: 0.7, fill: { color: RIM, alpha: 0.35 } },
      ],
    },
    {
      // Near ear. 34 px long against a 28 px skull — the ratio IS the
      // silhouette cue, so it is stated here rather than eyeballed.
      // SECONDARY MARKING: dark tip rim over a blush lining.
      id: 'earL',
      parent: 'head',
      x: -4,
      y: -11,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M -4.5 3 Q -8.5 -11 -4.5 -25 Q -1 -32 3 -25 Q 7 -11 4 3 Q 0 6 -4.5 3 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -2 1 Q -5 -11 -2 -22 Q 0 -26 2 -22 Q 5 -11 2 1 Q 0 3 -2 1 Z', fill: { color: BLUSH, alpha: 0.8 } },
        {
          kind: 'path',
          d: 'M -3.6 -22 Q -2.5 -31 0 -31.8 Q 2.5 -31 3.6 -22 Q 1.5 -27 0 -27.5 Q -1.5 -27 -3.6 -22 Z',
          fill: { color: EAR_RIM, alpha: 0.75 },
        },
        { kind: 'path', d: 'M 3.2 -2 Q 6.2 -12 2.6 -24 Q 4.6 -12 1.8 -2 Z', fill: { color: RIM, alpha: 0.35 } },
      ],
    },
    {
      // Far ear: the same shape in the shade tone, set a touch taller and
      // further back so the pair reads as two ears in depth, not a mirror.
      id: 'earR',
      parent: 'head',
      x: 2,
      y: -12,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M -4.5 3 Q -9 -11 -5 -25 Q -1 -32.5 3.5 -25 Q 7.5 -11 4 3 Q 0 6 -4.5 3 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -2 1 Q -5.5 -11 -2.5 -22 Q 0 -26 2.5 -22 Q 5.5 -11 2 1 Q 0 3 -2 1 Z', fill: { color: BLUSH, alpha: 0.5 } },
        {
          kind: 'path',
          d: 'M -3.8 -22 Q -2.6 -31.5 0 -32.3 Q 2.6 -31.5 3.8 -22 Q 1.6 -27.5 0 -28 Q -1.6 -27.5 -3.8 -22 Z',
          fill: { color: EAR_RIM, alpha: 0.6 },
        },
        { kind: 'path', d: 'M -4.2 0 Q -7.5 -11 -4 -23 Q -6 -11 -2.8 0 Z', fill: { color: FUR_DEEP, alpha: 0.2 } },
      ],
    },
    {
      // A morsel carried home to the young (M9 task 5) — only ever visible
      // during the 'carry' clip. `feedGive`/`feedTake` are listed here too
      // (M12 task 6): the rabbit's feedMode is 'nurse', so those clips play
      // during a nursing hold, and a nursing doe must not be drawn with a
      // berry in her mouth.
      id: 'food',
      parent: 'head',
      x: 17,
      y: 5,
      z: 4,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 3, ry: 2.6, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.8, y: -0.9, rx: 1.1, ry: 0.9, fill: { color: 0xffffff, alpha: 0.5 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedGive', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A kit is a big blunt head with stubby ears, not a rabbit with short
      // thighs — and per recipe rule 4F the load-bearing leg chain is left
      // alone so the feet stay on the shadow line. `head` scales its own
      // children, so the muzzle's net 0.78 × 1.34 ≈ 1.05 is deliberately
      // short RELATIVE to the enlarged skull; likewise the ears.
      scale: 0.5,
      partScale: {
        head: { x: 1.34, y: 1.34 },
        muzzle: { x: 0.78, y: 0.85 },
        earL: { x: 0.86, y: 0.34 },
        earR: { x: 0.86, y: 0.32 },
        hindFoot: { x: 0.7, y: 0.9 },
        tail: { x: 0.72, y: 0.72 },
      },
    },
    juvenile: {
      scale: 0.75,
      partScale: {
        head: { x: 1.12, y: 1.12 },
        muzzle: { x: 0.9, y: 0.95 },
        earL: { x: 0.95, y: 0.78 },
        earR: { x: 0.95, y: 0.76 },
      },
    },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xc9c9ce }, // gentle silvering
  },
  clips: {
    idle: {
      // Standing still, but never actually still: two bursts of nose twitch
      // with a pause between, one ear swivelling forward, a slow head lift.
      durationMs: 2400,
      tracks: [
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.06, v: -0.7 },
            { t: 0.12, v: 0 },
            { t: 0.18, v: -0.7 },
            { t: 0.24, v: 0 },
            { t: 0.62, v: 0 },
            { t: 0.68, v: -0.7 },
            { t: 0.74, v: 0 },
            { t: 0.8, v: -0.7 },
            { t: 0.86, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.46, v: 0.34 },
            { t: 0.52, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.66, v: 0 },
            { t: 0.71, v: 0.26 },
            { t: 0.77, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.6 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.55, v: 0.07 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // See BOUND_TRACKS above: a real bound, both hinds together, with a
      // flight phase. 570 ms is strideLength / speed, so the playback-rate
      // multiplier sits at ≈ 1.0 while cruising.
      durationMs: 570,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.06 },
            { t: 0.35, v: 0 },
            { t: 0.68, v: -0.08 },
            { t: 1, v: 0.06 },
          ],
        },
      ],
    },
    sleep: {
      // Curled into the grass: haunch tucked under, forelegs folded, ears
      // laid flat back along the spine. `sy` 0.9 with `py` +4 keeps the feet
      // on the shadow line (recipe rule 4E).
      durationMs: 3400,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.9 },
            { t: 0.5, v: 0.86 },
            { t: 1, v: 0.9 },
          ],
          py: [
            { t: 0, v: 4 },
            { t: 1, v: 4 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.42 },
            { t: 1, v: 0.42 },
          ],
          py: [
            { t: 0, v: 7 },
            { t: 1, v: 7 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.55 },
            { t: 1, v: -0.55 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.68 },
            { t: 1, v: -0.68 },
          ],
        },
        {
          partId: 'hindThigh',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: 0.35 },
            { t: 1, v: 0.35 },
          ],
        },
        {
          partId: 'hindFoot',
          rot: [
            { t: 0, v: 0.15 },
            { t: 1, v: 0.15 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: -0.3 },
            { t: 1, v: -0.3 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0.55 },
            { t: 1, v: 0.55 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: -0.28 },
            { t: 1, v: -0.28 },
          ],
        },
      ],
    },
    eat: {
      // Grazing: the head dips deeper than any other clip (0.75 rad — the
      // yardstick 'feedGive' is deliberately gentler than), ears sweep back,
      // and the nose nibbles at the bottom of the dip.
      durationMs: 1000,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.75 },
            { t: 0.62, v: 0.75 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 8 },
            { t: 0.62, v: 8 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.34, v: -0.6 },
            { t: 0.4, v: 0.2 },
            { t: 0.46, v: -0.6 },
            { t: 0.52, v: 0.2 },
            { t: 0.58, v: -0.6 },
            { t: 0.64, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.22 },
            { t: 0.65, v: -0.22 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.26 },
            { t: 0.65, v: -0.26 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 2 },
            { t: 0.62, v: 2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.12 },
            { t: 0.62, v: -0.12 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A greeting: head turns up and across, ears semaphore, nose reads the
      // other animal, and the whole body gives a small lift.
      durationMs: 1300,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.28, v: -0.2 },
            { t: 0.58, v: 0.12 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.22, v: 0.28 },
            { t: 0.45, v: 0 },
            { t: 0.68, v: 0.28 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.22 },
            { t: 0.55, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.15, v: -0.6 },
            { t: 0.22, v: 0 },
            { t: 0.3, v: -0.6 },
            { t: 0.37, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -1.5 },
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
      ],
    },
    carry: {
      // Fetching food home: the same bound as `walk`, shared verbatim, with
      // the head tucked down over the berry (M9 task 5).
      durationMs: 570,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.3 },
            { t: 0.5, v: 0.4 },
            { t: 1, v: 0.3 },
          ],
          py: [
            { t: 0, v: 2 },
            { t: 0.5, v: 3 },
            { t: 1, v: 2 },
          ],
        },
      ],
    },
    sit: {
      // The loaf: settled to brood or to nurse, forelegs folded under the
      // chest, haunch collapsed, ears at half mast. `sy` 0.86 with `py` +4
      // lands the paws back on the shadow line — 26 × 0.86 + 4 = 26.4
      // (recipe rule 4E; the old rig sank its feet 8 px through the ground
      // here).
      durationMs: 1100,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.86 },
            { t: 1, v: 0.86 },
          ],
          py: [
            { t: 0, v: 4 },
            { t: 1, v: 4 },
          ],
        },
        {
          partId: 'hindThigh',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: 0.25 },
            { t: 1, v: 0.25 },
          ],
        },
        {
          partId: 'hindFoot',
          rot: [
            { t: 0, v: -0.1 },
            { t: 1, v: -0.1 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0.4 },
            { t: 1, v: 0.4 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.18 },
            { t: 1, v: -0.18 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.22 },
            { t: 1, v: -0.22 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.06 },
            { t: 1, v: 0.06 },
          ],
          py: [
            { t: 0, v: 1 },
            { t: 1, v: 1 },
          ],
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
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: a gentle
      // downward lean of the head toward a ground-level meeting point —
      // less than a full 'eat' dip, held while the young one arrives
      // (M12 task 2). Loop-safe like every clip in this file.
      //
      // M12 task 6 kept the `head` track byte-for-byte: `head` still exists
      // and still plays the head's role, so the gesture is literally the one
      // task 2 authored. The ear and nose tracks below are additive — they
      // do not alter the lean, they just point the doe's attention at the
      // kit while she holds it.
      durationMs: 900,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.5 },
            { t: 0.65, v: 0.5 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 4 },
            { t: 0.65, v: 4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.18 },
            { t: 0.65, v: 0.18 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.14 },
            { t: 0.65, v: 0.14 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.4, v: -0.5 },
            { t: 0.5, v: 0 },
            { t: 0.6, v: -0.5 },
            { t: 0.72, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the baby during a feeding interaction: the head stretches
      // up and forward from its (smaller, stage-scaled) resting height to
      // meet the parent partway — the mirror image of 'feedGive' (M12
      // task 2). The `head` track is likewise unchanged by task 6; the ears
      // tip back and the nose works fast, which is what a hungry kit does.
      durationMs: 850,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.4 },
            { t: 0.65, v: -0.4 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -5 },
            { t: 0.65, v: -5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.2 },
            { t: 0.65, v: -0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.24 },
            { t: 0.65, v: -0.24 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.6 },
            { t: 0.38, v: 0 },
            { t: 0.46, v: -0.6 },
            { t: 0.54, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
