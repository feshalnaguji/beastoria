/**
 * The duck rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14). A mallard HEN as
 * the rig has always shown her: warm mottled brown with a buff breast, never the
 * drake's green head. Side view facing +x. The `body` origin sits mid-torso; the
 * ground line is y = +2 in ROOT space (where `shadow` sits) = y +18 in BODY
 * space, and both webbed feet land on it.
 *
 * PRIMARY MARKING: the blue-teal wing speculum bordered in white, flashing on
 * the folded wing — the one cool, high-contrast patch on an otherwise warm
 * brown bird, and the thing that separates her from the (warm-grey, big-billed)
 * dodo at T1 together with her flat orange bill.
 * SECONDARY MARKINGS (T2 only): the dark eye-stripe through the eye, the
 * orange bill with a dark saddle, the pale buff cheek and throat, the
 * buff-white tail edge, and the orange webbed feet.
 *
 * SILHOUETTE: a boat-shaped `path` hull with a flat keel, rump tilted up into
 * a pointed tail, a swan-less short neck and a broad flat bill; the legs are
 * short and set far BACK (hips at x -3), which is what reads as "duck" blacked
 * out. SHADING: BROWN / BROWN_DARK+DEEP / CREAM+RIM in the recipe's paint order,
 * the off-side leg a separate shade-toned part behind the body.
 *
 * MOTION: a WADDLE — the hull rolls side to side (rot), dips twice per cycle,
 * the near/far legs alternate a slow rearward stance sweep and a quick forward
 * swing with the toes lifting, and the head counter-rolls. Swimming hides the
 * legs and glides the hull low with a gentle roll and head nod.
 *
 * Rotation sign (recipe rule 4A): Pixi +rotation is clockwise, so for parts
 * whose mass hangs DOWN from the pivot (legs) +rot swings the far end REARWARD
 * (-x); for the foot, which extends FORWARD from its pivot, +rot tips the toes
 * DOWN; for the bill, +rot tips the tip DOWN; for the head (mass up from the
 * neck) +rot nods it forward.
 *
 * strideLength 30: sim speed 6 × 10 / 30 = 2.0 waddles per second; walk's
 * 500 ms = 30 / (6 × 0.01), so the playback multiplier sits at ≈ 1.0.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const BROWN = 0x9b8262; // base coat
const BROWN_DARK = 0x735d42; // shade: mantle, folded wing
const BROWN_DEEP = 0x40321f; // creases and ground contact, low alpha only
const CREAM = 0xe9dcc0; // light: breast, belly
const RIM = 0xfff3d8; // light: sunlit top edge
// --- markings -------------------------------------------------------------
const HEAD = 0x8a7355;
const BUFF = 0xe3d3ae; // cheek and throat
const SPEC = 0x3e7d8a; // PRIMARY: the speculum
const SPEC_SHEEN = 0x6fb1be;
const SPEC_EDGE = 0xf6f2e6; // its white borders
const BILL = 0xe8a53c;
const BILL_SHADE = 0xc4821f;
const BILL_DARK = 0x3a2c1c;
const EYE = 0x201c1a;
const FOOT = 0xe58a2e;
const FOOT_DARK = 0x9a5a1c;
const WEED = 0x7da861; // the carried pondweed morsel
const GROUND_SHADE = 0x3d5a2e;

/**
 * The waddle (recipe rules 4A/4B). t = 0 is the near foot planted at the front
 * of its stance. Stance is the slow half (0..0.5, leg sweeping rearward); swing
 * is the quick half. Rolls and dips are asymmetric so t = 0.25 and t = 0.75
 * (two of the six baked T1 frames) are different poses. `head` is NOT here:
 * walk and carry author their own.
 */
const WADDLE_TRACKS: Track[] = [
  {
    partId: 'body',
    rot: [
      { t: 0, v: 0.11 },
      { t: 0.2, v: 0.03 },
      { t: 0.5, v: -0.12 },
      { t: 0.7, v: -0.02 },
      { t: 1, v: 0.11 },
    ],
    py: [
      { t: 0, v: 0 },
      { t: 0.22, v: -1.8 },
      { t: 0.5, v: 0 },
      { t: 0.74, v: -1.1 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'legF',
    rot: [
      { t: 0, v: -0.45 },
      { t: 0.5, v: 0.45 },
      { t: 0.64, v: 0.5 },
      { t: 0.82, v: -0.05 },
      { t: 1, v: -0.45 },
    ],
  },
  {
    // The web lifts toes-up through the swing and flattens in stance — a
    // different SHAPE from the leg's own curve (articulation test).
    partId: 'footF',
    rot: [
      { t: 0, v: 0.1 },
      { t: 0.45, v: 0.2 },
      { t: 0.6, v: -0.15 },
      { t: 0.8, v: -0.5 },
      { t: 1, v: 0.1 },
    ],
  },
  {
    partId: 'legB',
    rot: [
      { t: 0, v: 0.45 },
      { t: 0.14, v: 0.5 },
      { t: 0.32, v: -0.05 },
      { t: 0.5, v: -0.45 },
      { t: 1, v: 0.45 },
    ],
  },
  {
    partId: 'footB',
    rot: [
      { t: 0, v: 0.1 },
      { t: 0.1, v: -0.15 },
      { t: 0.3, v: -0.5 },
      { t: 0.5, v: 0.1 },
      { t: 0.95, v: 0.2 },
      { t: 1, v: 0.1 },
    ],
  },
  {
    partId: 'tail',
    rot: [
      { t: 0, v: -0.18 },
      { t: 0.3, v: 0.1 },
      { t: 0.5, v: 0.2 },
      { t: 0.8, v: -0.1 },
      { t: 1, v: -0.18 },
    ],
  },
];

export const duckRig: CreatureRig = {
  species: 'duck',
  strideLength: 30,
  parts: [
    {
      // Two ellipses: a wide soft pool and a tighter core under the hull.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 22, ry: 5.5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -1, y: 0.4, rx: 12, ry: 3.2, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The hull. Paint order: base, neck, throat, mantle, breast, mottles,
      // contact band, rim.
      id: 'body',
      parent: null,
      x: 0,
      y: -16,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -20 -7 Q -18 -12 -7 -12.5 Q 8 -13.5 15 -9 Q 20.5 -4 19 2 Q 17 9 9 11.5 Q -1 13.5 -10 11.5 Q -18 8 -20.5 -1 Z',
          fill: { color: BROWN },
        },
        { kind: 'path', d: 'M 6 -8 Q 10 -15 13 -17 L 20 -12 Q 20 -7 19 -2 Q 14 -6 6 -8 Z', fill: { color: BROWN } },
        { kind: 'path', d: 'M 16 -12 Q 20 -10 19.5 -4 L 17 -3 Q 17.5 -8 16 -12 Z', fill: { color: BUFF, alpha: 0.7 } },
        {
          kind: 'path',
          d: 'M -19 -6 Q -17 -12 -7 -12.5 Q 8 -13.5 15 -9 Q 17 -7.5 18 -5 Q 9 -9 -2 -8.5 Q -13 -8 -19 -2 Z',
          fill: { color: BROWN_DARK, alpha: 0.55 },
        },
        {
          kind: 'path',
          d: 'M 19 1.5 Q 17 9 9 11.5 Q -1 13.5 -8 11 Q -2 7 5 1 Q 12 -4 18.5 -3 Q 20 -1 19 1.5 Z',
          fill: { color: CREAM, alpha: 0.9 },
        },
        { kind: 'path', d: 'M 6 3 Q 8 0.5 10.5 3 Q 8.5 4 6 3 Z', fill: { color: BROWN_DARK, alpha: 0.35 } },
        { kind: 'path', d: 'M 11 6 Q 13 3.5 15.5 6 Q 13.5 7 11 6 Z', fill: { color: BROWN_DARK, alpha: 0.35 } },
        { kind: 'path', d: 'M 1 7 Q 3 4.5 5.5 7 Q 3.5 8 1 7 Z', fill: { color: BROWN_DARK, alpha: 0.3 } },
        {
          kind: 'path',
          d: 'M -14 9 Q -2 13.5 10 11.5 Q 16 9.5 18 5 Q 16 11 9 13 Q -2 15 -12 12 Z',
          fill: { color: BROWN_DEEP, alpha: 0.2 },
        },
        {
          kind: 'path',
          d: 'M -19 -6 Q -17 -12 -7 -12.5 Q 8 -13.5 15 -9 Q 17 -8 18 -6 Q 10 -11.5 -2 -11.5 Q -13 -11 -19 -4 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // Short pointed tail fan, low and roughly continuing the back line.
      id: 'tail',
      parent: 'body',
      x: -17,
      y: -5,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 2 -4 Q -6 -6 -13 -4 Q -11 -1 -12 1 Q -5 3 2 3 Z', fill: { color: BROWN } },
        { kind: 'path', d: 'M 2 3 Q -5 3 -12 1 Q -10.5 -0.5 -11 -1.5 Q -5 1 2 0 Z', fill: { color: BROWN_DARK, alpha: 0.6 } },
        { kind: 'path', d: 'M -13 -4 Q -11 -1 -12 1 L -10.5 0.5 Q -9.5 -2 -10.5 -3.8 Z', fill: { color: BUFF, alpha: 0.9 } },
      ],
    },
    {
      // Off-side leg: shade tone, behind the hull, set far back.
      id: 'legB',
      parent: 'body',
      x: -7,
      y: 8,
      z: -2,
      hideInClips: ['swim'],
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 0.4, y2: 8.4, width: 2.6, fill: { color: FOOT_DARK } },
        { kind: 'line', x1: 0.1, y1: 1.5, x2: 0.4, y2: 6.5, width: 1, fill: { color: FOOT, alpha: 0.4 } },
      ],
    },
    {
      id: 'footB',
      parent: 'legB',
      x: 0.4,
      y: 8.4,
      z: 0,
      hideInClips: ['swim'],
      shapes: [
        { kind: 'path', d: 'M 0 -1 L 7.5 0.4 Q 9 1 7.5 1.6 Q 3 2 0 1.4 Z', fill: { color: FOOT_DARK } },
        { kind: 'line', x1: 0.5, y1: 0.6, x2: 7.5, y2: 1, width: 0.7, fill: { color: BROWN_DEEP, alpha: 0.5 } },
      ],
    },
    {
      // Near leg: short, set well behind the middle of the hull.
      id: 'legF',
      parent: 'body',
      x: -3,
      y: 8,
      z: 2,
      hideInClips: ['swim'],
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 0.4, y2: 8.4, width: 2.8, fill: { color: FOOT } },
        { kind: 'line', x1: 0.1, y1: 1.5, x2: 0.4, y2: 6.5, width: 1.1, fill: { color: BILL, alpha: 0.6 } },
      ],
    },
    {
      // SECONDARY MARKING: orange webbed feet.
      id: 'footF',
      parent: 'legF',
      x: 0.4,
      y: 8.4,
      z: 0,
      hideInClips: ['swim'],
      shapes: [
        { kind: 'path', d: 'M 0 -1 L 7.5 0.4 Q 9 1 7.5 1.6 Q 3 2 0 1.4 Z', fill: { color: FOOT } },
        { kind: 'line', x1: 0.5, y1: 0.6, x2: 7.5, y2: 1, width: 0.7, fill: { color: FOOT_DARK, alpha: 0.6 } },
        { kind: 'line', x1: 0, y1: -0.6, x2: 6, y2: 0.2, width: 0.8, fill: { color: BILL, alpha: 0.5 } },
      ],
    },
    {
      // The folded wing. PRIMARY MARKING: the white-bordered blue-teal
      // speculum along its trailing edge.
      id: 'wing',
      parent: 'body',
      x: -4,
      y: -2,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 8 -5 Q 0 -8 -9 -5 Q -17 -1 -19 4 Q -10 8 0 6 Q 7 3 9 -1 Z', fill: { color: BROWN_DARK } },
        { kind: 'path', d: 'M -4 -4 Q 2 -5 7 -3 Q 5 -1 -2 -1 Q -8 -1 -4 -4 Z', fill: { color: BROWN, alpha: 0.5 } },
        { kind: 'path', d: 'M -15 2.8 Q -8 4.4 -1 1 L -1.3 4.8 Q -8 7 -15.3 6 Z', fill: { color: SPEC_EDGE, alpha: 0.92 } },
        { kind: 'path', d: 'M -14 3.8 Q -8 5.2 -2 2.4 L -2.2 3.9 Q -8 5.9 -14.2 5.2 Z', fill: { color: SPEC } },
        { kind: 'path', d: 'M -13 4.2 Q -8 5.4 -3 3 Q -8 4.6 -13 4.7 Z', fill: { color: SPEC_SHEEN, alpha: 0.7 } },
        { kind: 'line', x1: -4, y1: -1, x2: -15, y2: 2, width: 0.8, fill: { color: BROWN_DEEP, alpha: 0.45 } },
        {
          kind: 'path',
          d: 'M 8 -5 Q 0 -8 -9 -5 Q -13 -3 -15 0 Q -8 -5 0 -6.5 Q 5 -6.5 8 -5 Z',
          fill: { color: RIM, alpha: 0.25 },
        },
      ],
    },
    {
      id: 'head',
      parent: 'body',
      x: 14,
      y: -12,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -8 3 Q -10 -4 -4 -8 Q 3 -10 7 -5 Q 9 -1 8 3 Q 4 7.5 -2 7.5 Q -7 7.5 -8 3 Z',
          fill: { color: HEAD },
        },
        {
          kind: 'path',
          d: 'M -7 -1 Q -8.5 -4.5 -3.5 -7 Q 2.5 -8.5 5.5 -4.5 Q 3 -5.5 -1 -5.5 Q -5.5 -4.5 -7 -1 Z',
          fill: { color: BROWN_DARK, alpha: 0.6 },
        },
        // SECONDARY MARKING: pale buff cheek and throat.
        { kind: 'path', d: 'M -6 4 Q -2 1.5 5 2.5 Q 8 3 8 4 Q 4 8 -2 7.5 Q -6 7 -6 4 Z', fill: { color: BUFF, alpha: 0.85 } },
        // SECONDARY MARKING: the dark eye-stripe from bill through eye to nape.
        { kind: 'path', d: 'M 8 -0.6 Q 2 -2.4 -6 -1.5 Q 2 -0.6 8 0.6 Z', fill: { color: BROWN_DEEP, alpha: 0.6 } },
        { kind: 'circle', x: 3.3, y: -1.6, r: 1.8, fill: { color: EYE } },
        { kind: 'circle', x: 3.9, y: -2.2, r: 0.6, fill: { color: 0xffffff, alpha: 0.85 } },
        {
          kind: 'path',
          d: 'M -7 -2 Q -8.5 -5 -3.5 -7.3 Q 2.5 -8.8 5.5 -5 Q 1 -7.5 -3 -6.5 Q -6 -5 -7 -2 Z',
          fill: { color: RIM, alpha: 0.2 },
        },
      ],
    },
    {
      // SECONDARY MARKING: broad flat orange bill with a dark saddle. Two
      // mandibles so it can gape for feedTake.
      id: 'bill',
      parent: 'head',
      x: 7.5,
      y: 1,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 0 -2.6 L 9 -2 Q 13 -1.4 12.6 0.3 L 0 0.6 Z', fill: { color: BILL } },
        { kind: 'path', d: 'M 0 0.6 L 12.6 0.3 Q 12 2.6 9 2.8 L 0 3.6 Z', fill: { color: BILL_SHADE } },
        { kind: 'path', d: 'M 3.5 -2.4 L 8 -2.1 L 7.5 -0.4 L 3.5 -0.2 Z', fill: { color: BILL_DARK, alpha: 0.4 } },
        { kind: 'path', d: 'M 11 -1.4 Q 13 -1.2 12.6 0.3 L 11 0.4 Z', fill: { color: BILL_DARK, alpha: 0.6 } },
        { kind: 'circle', x: 8.5, y: -1.2, r: 0.45, fill: { color: BILL_DARK, alpha: 0.7 } },
      ],
    },
    {
      // A sprig of pondweed carried home to the ducklings. The duck is a
      // CARRY-mode species, so `feedGive` (the delivery hold) is deliberately
      // absent from hideInClips; `feedTake` is the duckling's, so it hides.
      id: 'food',
      parent: 'bill',
      x: 11,
      y: 0.4,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.2, fill: { color: WEED } },
        { kind: 'ellipse', x: -0.7, y: -0.7, rx: 1, ry: 0.8, fill: { color: 0xffffff, alpha: 0.4 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // Big head and bill, stub tail; the leg chain is left alone (rule 4F).
      scale: 0.5,
      partScale: {
        head: { x: 1.3, y: 1.3 },
        bill: { x: 0.9, y: 1.1 },
        tail: { x: 0.5, y: 0.7 },
        wing: { x: 0.7, y: 0.7 },
      },
      tint: 0xf0dc9a, // golden duckling fluff
    },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 }, tail: { x: 0.85, y: 0.9 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xd3cfc6 },
  },
  clips: {
    idle: {
      durationMs: 2100,
      tracks: [
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.42, v: 0 },
            { t: 0.5, v: 0.4 },
            { t: 0.6, v: -0.2 },
            { t: 0.68, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.1 },
            { t: 0.5, v: -0.08 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.7, v: -0.06 },
            { t: 0.82, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      durationMs: 500, // the waddle: 30 / (6 * 0.01)
      tracks: [
        ...WADDLE_TRACKS,
        {
          // The head counter-rolls against the hull and lags it.
          partId: 'head',
          rot: [
            { t: 0, v: -0.08 },
            { t: 0.3, v: 0.02 },
            { t: 0.55, v: 0.1 },
            { t: 0.8, v: 0 },
            { t: 1, v: -0.08 },
          ],
        },
      ],
    },
    sleep: {
      // Bill tucked into the back feathers. 18 * sy + py = 18 (rule 4E).
      durationMs: 3600,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.6 },
            { t: 1, v: -0.6 },
          ],
          px: [
            { t: 0, v: -6 },
            { t: 1, v: -6 },
          ],
          py: [
            { t: 0, v: 4 },
            { t: 1, v: 4 },
          ],
        },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.94 },
            { t: 0.5, v: 0.9 },
            { t: 1, v: 0.94 },
          ],
          py: [
            { t: 0, v: 1.1 },
            { t: 0.5, v: 1.8 },
            { t: 1, v: 1.1 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
      ],
    },
    eat: {
      // Dabbling: the head dips deep, the hull tips up behind it.
      durationMs: 900,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.9 },
            { t: 0.55, v: 0.9 },
            { t: 0.75, v: 0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.24 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'bill',
          sy: [
            { t: 0, v: 1 },
            { t: 0.4, v: 1.25 },
            { t: 0.5, v: 1 },
            { t: 0.65, v: 1.2 },
            { t: 0.75, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.35 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      durationMs: 850,
      tracks: [
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.2, v: -0.5 },
            { t: 0.4, v: 0 },
            { t: 0.6, v: -0.5 },
            { t: 0.8, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -2 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -2 },
            { t: 1, v: 0 },
          ],
        },
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
      ],
    },
    swim: {
      // Gliding low on the water: the legs are hidden (they paddle out of
      // sight), the hull rides a gentle swell with a slight roll, the head
      // nods with each stroke and the tail wags.
      durationMs: 900,
      tracks: [
        {
          partId: 'body',
          py: [
            { t: 0, v: 2.5 },
            { t: 0.5, v: 4 },
            { t: 1, v: 2.5 },
          ],
          rot: [
            { t: 0, v: -0.02 },
            { t: 0.35, v: 0.03 },
            { t: 1, v: -0.02 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.04 },
            { t: 0.3, v: -0.06 },
            { t: 0.7, v: 0.05 },
            { t: 1, v: 0.04 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.3 },
            { t: 0.5, v: 0.3 },
            { t: 1, v: -0.3 },
          ],
        },
      ],
    },
    carry: {
      // Fetching food home: the same waddle, bill held low and full.
      durationMs: 500,
      tracks: [
        ...WADDLE_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.2 },
            { t: 0.3, v: 0.26 },
            { t: 0.55, v: 0.32 },
            { t: 0.8, v: 0.24 },
            { t: 1, v: 0.2 },
          ],
        },
      ],
    },
    sit: {
      // Settled to brood: 18 * 0.85 + 2.7 = 18 keeps the hull on the ground.
      durationMs: 1000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 2.7 },
            { t: 1, v: 2.7 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.4 },
            { t: 1, v: 0.4 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.4 },
            { t: 1, v: 0.4 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
      ],
    },
    feedGive: {
      // The delivery hold: one gentle dip of the head, shallower than eat's
      // dabble, held while the duckling arrives. `food` stays visible.
      durationMs: 700,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.5 },
            { t: 0.65, v: 0.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'bill',
          sy: [
            { t: 0, v: 1 },
            { t: 0.35, v: 1.15 },
            { t: 0.65, v: 1.15 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.08 },
            { t: 0.65, v: 0.08 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // The duckling stretches up and forward and gapes.
      durationMs: 650,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.4 },
            { t: 0.65, v: -0.4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'bill',
          sy: [
            { t: 0, v: 1 },
            { t: 0.3, v: 1.7 },
            { t: 0.7, v: 1.7 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.18 },
            { t: 0.42, v: -0.04 },
            { t: 0.54, v: -0.18 },
            { t: 0.66, v: -0.04 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
