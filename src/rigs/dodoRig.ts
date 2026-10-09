/**
 * The dodo rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14). A plump blue-grey
 * wanderer with a grand hooked beak. Side view facing +x. The `body` origin sits
 * mid-torso; the ground line is y = +2 in ROOT space (where `shadow` sits) =
 * y +26 in BODY space, and both feet land on it (hip 10 + thigh 8 + tarsus 7.6).
 *
 * PRIMARY MARKING: the huge pale hooked bill — yellow-green with a dark hooked
 * tip, longer than the head is deep. It is the largest, highest-contrast patch
 * on an otherwise grey bird and the thing that separates the dodo from the duck
 * (warm brown, flat orange bill) at T1.
 * SECONDARY MARKINGS (T2 only): bare pale-grey face skin round a dark eye, the
 * soft curl of four white tail feathers, the tiny yellowish winglet, and the
 * scaly yellow legs with clawed toes.
 *
 * SILHOUETTE: a pear-shaped `path` body — mass at the rump, a thick short neck
 * rising to a heavy head — standing on stout, feather-trousered legs with a
 * generous belly-to-ground gap. Blacked out: pear + hooked bill + tail curl.
 * SHADING: GREY / GREY_DARK+DEEP / GREY_LIGHT+RIM in the recipe's paint order,
 * the off-side leg a separate shade-toned chain behind the body.
 *
 * MOTION: the heavy waddle — slow (one full two-step cycle per second), the whole
 * body leaning forward and rolling over each planted leg with only a small
 * sagging bob, the head lagging the roll, the knee folding briefly in each quick
 * swing. Nothing bounces; the weight is the point.
 *
 * Rotation sign (recipe rule 4A): Pixi +rotation is clockwise, so for parts
 * whose mass hangs DOWN from the pivot (legs) +rot swings the far end REARWARD
 * (-x); for the foot, which extends FORWARD from its pivot, +rot tips the toes
 * DOWN; for the head (mass up from the neck) +rot nods it forward; for the
 * winglet and tail plume (mass trailing -x) +rot lifts the trailing tip.
 *
 * strideLength 40: sim speed 4 × 10 / 40 = 1.0 full waddles per second; walk's
 * 1000 ms = 40 / (4 × 0.01), so the playback multiplier sits at ≈ 1.0.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const GREY = 0x9aa0a8; // base coat
const GREY_DARK = 0x848b94; // shade: mantle, winglet, far-side limbs
const GREY_DEEP = 0x4a4f58; // creases and ground contact, low alpha only
const GREY_LIGHT = 0xbcc2c8; // light: belly, breast
const RIM = 0xe8ecef; // light: sunlit top edge
// --- markings -------------------------------------------------------------
const HEAD = 0x8d939c;
const FACE = 0xd3cbb2; // bare face skin
const FACE_SHADE = 0xa59b82;
const BEAK = 0xc6b766; // PRIMARY: yellow-green bill
const BEAK_SHADE = 0xa59443;
const BEAK_BASE = 0x8fa070;
const BEAK_TIP = 0x4d3f22; // the dark hooked tip
const EYE = 0x2a2622;
const WING = 0xb3ac8a; // tiny yellowish winglet
const WING_SHADE = 0x8d8765;
const PLUME = 0xe6e1d2;
const PLUME_SHADE = 0xbfb9a6;
const LEG = 0xd9b13f; // scaly yellow
const LEG_DARK = 0x9c7c24;
const LEG_LIGHT = 0xf0d36e;
const BERRY = 0xcf5f52;
const GROUND_SHADE = 0x3d5a2e;

/**
 * The heavy waddle (recipe rules 4A/4B). t = 0 is the near foot just planted at
 * the front of its stance. Stance is the long half (0..0.55, leg sweeping
 * rearward under the load); swing is the shorter half, and the shank folds in it.
 * The far leg is the near leg shifted by half a cycle. Roll and dip are
 * asymmetric so t = 0.25 and t = 0.75 (two baked T1 frames) differ. The body
 * keeps a forward lean (positive rot bias). `head`, `tailPlume` are authored per
 * clip.
 */
const WADDLE_TRACKS: Track[] = [
  {
    partId: 'body',
    rot: [
      { t: 0, v: 0.07 },
      { t: 0.25, v: 0.15 },
      { t: 0.5, v: 0.07 },
      { t: 0.75, v: -0.01 },
      { t: 1, v: 0.07 },
    ],
    py: [
      { t: 0, v: 0 },
      { t: 0.25, v: -1.4 },
      { t: 0.5, v: 0 },
      { t: 0.75, v: -0.9 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'legF',
    rot: [
      { t: 0, v: -0.32 },
      { t: 0.55, v: 0.32 },
      { t: 0.8, v: -0.05 },
      { t: 1, v: -0.32 },
    ],
  },
  {
    // The knee folds through the swing — a different SHAPE from the thigh's
    // own sweep (articulation test).
    partId: 'shankF',
    rot: [
      { t: 0, v: 0.05 },
      { t: 0.5, v: 0.1 },
      { t: 0.6, v: 0.75 },
      { t: 0.8, v: 0.55 },
      { t: 0.92, v: -0.1 },
      { t: 1, v: 0.05 },
    ],
  },
  {
    partId: 'footF',
    rot: [
      { t: 0, v: 0.05 },
      { t: 0.5, v: 0.35 },
      { t: 0.65, v: -0.4 },
      { t: 0.85, v: -0.2 },
      { t: 1, v: 0.05 },
    ],
  },
  {
    partId: 'legB',
    rot: [
      { t: 0, v: 0.27 },
      { t: 0.05, v: 0.32 },
      { t: 0.3, v: -0.05 },
      { t: 0.5, v: -0.32 },
      { t: 1, v: 0.27 },
    ],
  },
  {
    partId: 'shankB',
    rot: [
      { t: 0, v: 0.1 },
      { t: 0.1, v: 0.75 },
      { t: 0.3, v: 0.55 },
      { t: 0.42, v: -0.1 },
      { t: 0.5, v: 0.05 },
      { t: 1, v: 0.1 },
    ],
  },
  {
    partId: 'footB',
    rot: [
      { t: 0, v: 0.35 },
      { t: 0.15, v: -0.4 },
      { t: 0.35, v: -0.2 },
      { t: 0.5, v: 0.05 },
      { t: 1, v: 0.35 },
    ],
  },
  {
    // The plume trails the roll and lags it.
    partId: 'tailPlume',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.35, v: 0.12 },
      { t: 0.6, v: 0.1 },
      { t: 0.85, v: -0.12 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'winglet',
    rot: [
      { t: 0, v: 0 },
      { t: 0.3, v: 0.1 },
      { t: 0.6, v: -0.05 },
      { t: 1, v: 0 },
    ],
  },
];

export const dodoRig: CreatureRig = {
  species: 'dodo',
  strideLength: 40,
  parts: [
    {
      // Two ellipses: a wide soft pool and a tighter core under the weight.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 24, ry: 6.5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -1, y: 0.5, rx: 14, ry: 3.8, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The pear. Paint order: base, neck, neck shade, mantle, belly, feather
      // scallop, contact band, rim.
      id: 'body',
      parent: null,
      x: 0,
      y: -24,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -22 -3 Q -23 -13 -11 -15.5 Q 1 -17 9 -13 Q 17 -9 17.5 -2 Q 17 8 9 13.5 Q -1 17 -12 14.5 Q -22 11 -22 -3 Z',
          fill: { color: GREY },
        },
        {
          kind: 'path',
          d: 'M 2 -13 Q 5 -21 12 -24 Q 20 -22 22 -14 Q 21 -7 17.5 -2 Q 11 -6 3 -8 Z',
          fill: { color: GREY },
        },
        {
          kind: 'path',
          d: 'M 2 -13 Q 5 -21 12 -24 Q 15 -22.5 15 -21 Q 8 -19 5.5 -11 Z',
          fill: { color: GREY_DARK, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M -22 -3 Q -23 -13 -11 -15.5 Q 1 -17 9 -13 Q 13 -10.5 15 -7 Q 6 -10.5 -4 -10 Q -16 -9.5 -22 -3 Z',
          fill: { color: GREY_DARK, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M 17.5 -1 Q 17 8 9 13.5 Q -1 17 -10 15 Q -2 9 5 3 Q 12 -2 17.5 -1 Z',
          fill: { color: GREY_LIGHT, alpha: 0.9 },
        },
        { kind: 'path', d: 'M 0 6 Q 3 9.5 8 8 Q 4 11 0 6 Z', fill: { color: GREY_DEEP, alpha: 0.22 } },
        {
          kind: 'path',
          d: 'M 9 13.5 Q -1 17 -12 14.5 Q -18 12.5 -20 9 Q -12 12.5 -2 13 Q 5 12.5 9 13.5 Z',
          fill: { color: GREY_DEEP, alpha: 0.22 },
        },
        {
          kind: 'path',
          d: 'M -22 -3 Q -23 -13 -11 -15.5 Q 1 -17 9 -13 Q 12 -11 13.5 -9 Q 5 -14 -3 -13.8 Q -14 -13 -20.5 -6 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // SECONDARY MARKING: the soft curl of four white tail feathers, tapered
      // leaves fanning up and back, the top one curling forward over the rump.
      id: 'tailPlume',
      parent: 'body',
      x: -19,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 1 2 Q -5 3 -11 1 Q -13 -0.5 -11.5 -2 Q -6 -1 1 -2.5 Z', fill: { color: PLUME } },
        { kind: 'path', d: 'M 1.5 1 Q -3 0 -9.5 -4.5 Q -11 -6 -9.5 -6.5 Q -3 -4.5 3 -2 Z', fill: { color: PLUME } },
        { kind: 'path', d: 'M 1 0 Q -4 -2 -8 -7 Q -9 -10 -7 -11 Q -4 -9 2 -4 Z', fill: { color: PLUME } },
        {
          kind: 'path',
          d: 'M 2 -2 Q 0 -8 -1 -12 Q 0 -15.5 3 -14 Q 5 -12 3.5 -8 Q 3.5 -4 4 -1 Z',
          fill: { color: PLUME },
        },
        { kind: 'path', d: 'M 1 2 Q -5 3 -11 1 Q -6 0.8 1 0 Z', fill: { color: PLUME_SHADE, alpha: 0.8 } },
        { kind: 'path', d: 'M 1 0 Q -3 -1 -7 -5 Q -8 -8 -7.5 -10 Q -5 -6 1.5 -2.5 Z', fill: { color: PLUME_SHADE, alpha: 0.6 } },
      ],
    },
    {
      // Off-side leg chain: shade tone, behind the body.
      id: 'legB',
      parent: 'body',
      x: -5,
      y: 10,
      z: -2,
      shapes: [
        { kind: 'line', x1: 0, y1: 3, x2: 0.2, y2: 8.6, width: 3.2, fill: { color: LEG_DARK } },
        { kind: 'path', d: 'M -5.5 -3 Q -7 4 -2.5 7.5 Q 3.5 8 5.8 2 Q 6.2 -3.5 0 -4.5 Z', fill: { color: GREY_DARK } },
      ],
    },
    {
      id: 'shankB',
      parent: 'legB',
      x: 0.2,
      y: 8,
      z: 0,
      hideInClips: ['sleep'], // folded away under the settled body
      shapes: [
        { kind: 'path', d: 'M -1.8 0 L 1.8 0 Q 1.5 4 1.2 7.6 L -1.1 7.6 Q -1.6 4 -1.8 0 Z', fill: { color: LEG_DARK } },
      ],
    },
    {
      id: 'footB',
      parent: 'shankB',
      x: 0,
      y: 7.6,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -2 -1.5 L 3 -1.5 Q 8.5 -1.2 10 -0.2 Q 8 0.3 5.5 0 Q 7.5 0.5 6 0.5 Q 2 0.4 -2 0.3 Z',
          fill: { color: LEG_DARK },
        },
      ],
    },
    {
      // Near leg: stout, feather-trousered thigh over a scaly yellow tarsus.
      id: 'legF',
      parent: 'body',
      x: 3,
      y: 10,
      z: 2,
      shapes: [
        { kind: 'line', x1: 0, y1: 3, x2: 0.2, y2: 8.6, width: 3.4, fill: { color: LEG } },
        { kind: 'path', d: 'M -5.5 -3 Q -7 4 -2.5 7.5 Q 3.5 8 5.8 2 Q 6.2 -3.5 0 -4.5 Z', fill: { color: GREY } },
        { kind: 'path', d: 'M -5.5 -3 Q -7 4 -2.5 7.5 Q 0.5 8 2.5 6.8 Q -2 4 -3 -3 Z', fill: { color: GREY_DARK, alpha: 0.55 } },
        { kind: 'path', d: 'M 0 -4.5 Q 6.2 -3.5 5.8 2 Q 4.4 -1.8 -1 -3 Z', fill: { color: RIM, alpha: 0.35 } },
      ],
    },
    {
      // SECONDARY MARKING: scaly yellow tarsus (scale bands, a lit edge).
      id: 'shankF',
      parent: 'legF',
      x: 0.2,
      y: 8,
      z: 0,
      hideInClips: ['sleep'], // folded away under the settled body
      shapes: [
        { kind: 'path', d: 'M -1.9 0 L 1.9 0 Q 1.6 4 1.3 7.6 L -1.1 7.6 Q -1.7 4 -1.9 0 Z', fill: { color: LEG } },
        { kind: 'path', d: 'M -1.9 0 L -0.4 0 Q -0.6 4 -0.5 7.6 L -1.1 7.6 Q -1.7 4 -1.9 0 Z', fill: { color: LEG_DARK, alpha: 0.7 } },
        { kind: 'path', d: 'M 0.6 0.3 L 1.7 0.3 Q 1.5 4 1.2 7 Q 0.9 4 0.6 0.3 Z', fill: { color: LEG_LIGHT, alpha: 0.6 } },
        { kind: 'line', x1: -1.6, y1: 2.2, x2: 1.6, y2: 2.6, width: 0.6, fill: { color: LEG_DARK, alpha: 0.5 } },
        { kind: 'line', x1: -1.5, y1: 5, x2: 1.4, y2: 5.4, width: 0.6, fill: { color: LEG_DARK, alpha: 0.5 } },
      ],
    },
    {
      id: 'footF',
      parent: 'shankF',
      x: 0,
      y: 7.6,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -2 -1.5 L 3 -1.5 Q 8.5 -1.2 10 -0.2 Q 8 0.3 5.5 0 Q 7.5 0.5 6 0.5 Q 2 0.4 -2 0.3 Z',
          fill: { color: LEG },
        },
        { kind: 'line', x1: 3, y1: -0.6, x2: 9.5, y2: -0.2, width: 0.5, fill: { color: LEG_DARK, alpha: 0.6 } },
        { kind: 'line', x1: 3, y1: 0, x2: 6.5, y2: 0.4, width: 0.5, fill: { color: LEG_DARK, alpha: 0.6 } },
      ],
    },
    {
      // SECONDARY MARKING: the tiny yellowish winglet, hopeful and useless.
      id: 'winglet',
      parent: 'body',
      x: -2,
      y: -3,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 4 -2 Q -2 -5 -8 -1.5 Q -11 2 -9 5.5 Q -3 7 2 4 Q 5 1.5 4 -2 Z', fill: { color: WING } },
        { kind: 'path', d: 'M -8 -1.5 Q -11 2 -9 5.5 Q -6.5 4 -6.5 1.5 Z', fill: { color: WING_SHADE, alpha: 0.7 } },
        { kind: 'path', d: 'M -4 3 Q -6 6.5 -3 6.8 Q 0 6 1 4 Z', fill: { color: WING_SHADE, alpha: 0.6 } },
        { kind: 'path', d: 'M 4 -2 Q -2 -5 -8 -1.5 Q -2 -3.5 3 -1.2 Z', fill: { color: RIM, alpha: 0.4 } },
      ],
    },
    {
      // The heavy head, with bare pale face skin round the eye.
      id: 'head',
      parent: 'body',
      x: 14,
      y: -17,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -8 1 Q -9.5 -7 -1 -9.5 Q 7 -10 10 -4 Q 11.5 1 9 5 Q 4 9 -2 8.5 Q -7 7.5 -8 1 Z',
          fill: { color: HEAD },
        },
        {
          kind: 'path',
          d: 'M -8 1 Q -9.5 -7 -1 -9.5 Q 7 -10 10 -4 Q 5 -6.5 -1 -6 Q -6 -5 -8 1 Z',
          fill: { color: GREY_DARK, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M 3 -6.5 Q 9 -6 10.5 -1 Q 11 3 8.5 5.5 Q 4 7.5 0.5 5 Q -1.5 1 0 -3 Q 1 -5.5 3 -6.5 Z',
          fill: { color: FACE },
        },
        { kind: 'circle', x: 4.2, y: -1.6, r: 3.1, fill: { color: FACE_SHADE, alpha: 0.5 } },
        { kind: 'circle', x: 4.4, y: -1.6, r: 1.9, fill: { color: EYE } },
        { kind: 'circle', x: 5, y: -2.3, r: 0.6, fill: { color: 0xffffff, alpha: 0.85 } },
        { kind: 'path', d: 'M 1 -4.5 Q 5 -6.5 9 -4 Q 5 -5 1 -3.5 Z', fill: { color: RIM, alpha: 0.4 } },
        {
          kind: 'path',
          d: 'M -7 -3 Q -7 -8 -1 -9.2 Q 6 -9.5 9 -4.5 Q 4 -8 -1 -7.8 Q -5.5 -7 -7 -3 Z',
          fill: { color: RIM, alpha: 0.25 },
        },
      ],
    },
    {
      // Closed eye: face skin over the eye ring plus a curved lash line.
      // Visible only in `sleep`.
      id: 'lid',
      parent: 'head',
      x: 0,
      y: 0,
      z: 1,
      hideInClips: ['idle', 'walk', 'eat', 'social', 'carry', 'sit', 'feedGive', 'feedTake'],
      shapes: [
        { kind: 'ellipse', x: 4.3, y: -1.6, rx: 3.5, ry: 3.3, fill: { color: FACE } },
        { kind: 'path', d: 'M 1.6 -1.4 Q 4.4 1 7.2 -1.4 Q 4.4 0.1 1.6 -1.4 Z', fill: { color: EYE, alpha: 0.85 } },
      ],
    },
    {
      // PRIMARY MARKING: the huge pale hooked bill. Upper and lower mandible,
      // base band, lit ridge, nostril, mouth line, and the dark hooked tip.
      id: 'beak',
      parent: 'head',
      x: 8,
      y: 1.5,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M 0 -4.5 Q 8 -6.5 15 -5 Q 20.5 -3.5 20.5 1.5 Q 20.5 6.5 17 7.5 Q 16.5 4.5 14 3 Q 7 2.2 0 2.5 Z',
          fill: { color: BEAK },
        },
        { kind: 'path', d: 'M 0 2.5 Q 7 2.2 14 3 Q 13 6.5 8 7 L 0 6.5 Z', fill: { color: BEAK_SHADE } },
        { kind: 'path', d: 'M 0 -4.5 Q 3 -5 5.5 -5.2 Q 4.5 -1.5 5 2.4 L 0 2.5 Z', fill: { color: BEAK_BASE, alpha: 0.5 } },
        { kind: 'path', d: 'M 16 -4.6 Q 20.5 -3.5 20.5 1.5 Q 20.5 6.5 17 7.5 Q 17.8 3 16 -4.6 Z', fill: { color: BEAK_TIP } },
        { kind: 'path', d: 'M 1 -4.3 Q 8 -6.2 14 -4.8 Q 8 -4.4 1 -3 Z', fill: { color: RIM, alpha: 0.4 } },
        { kind: 'path', d: 'M 6 -2.5 Q 8.5 -3.2 10 -2 Q 8 -1.9 6 -2.5 Z', fill: { color: BEAK_TIP, alpha: 0.7 } },
        { kind: 'line', x1: 1, y1: 2.5, x2: 14, y2: 3, width: 0.8, fill: { color: BEAK_TIP, alpha: 0.55 } },
      ],
    },
    {
      // A morsel carried home to the chick. The dodo is a CARRY-mode species, so
      // `feedGive` (the delivery hold) is deliberately absent from hideInClips;
      // `feedTake` is the chick's, so it hides.
      id: 'food',
      parent: 'beak',
      x: 16.5,
      y: 6.5,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.8, ry: 2.4, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.7, y: -0.8, rx: 1, ry: 0.8, fill: { color: 0xffffff, alpha: 0.4 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // Big head, stubby bill and plume; the leg chain is left alone (rule 4F).
      scale: 0.5,
      partScale: {
        head: { x: 1.3, y: 1.3 },
        beak: { x: 0.6, y: 0.65 },
        tailPlume: { x: 0.5, y: 0.5 },
        winglet: { x: 0.8, y: 0.8 },
      },
      tint: 0xcfd2c9,
    },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 }, beak: { x: 0.9, y: 0.9 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xc7c9cd },
  },
  clips: {
    idle: {
      durationMs: 2400,
      tracks: [
        {
          partId: 'tailPlume',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.5, v: 0.25 },
            { t: 0.62, v: -0.1 },
            { t: 0.72, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.12 },
            { t: 0.55, v: -0.1 },
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
          partId: 'winglet',
          rot: [
            { t: 0, v: 0 },
            { t: 0.7, v: 0.08 },
            { t: 0.82, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      durationMs: 1000, // the famous waddle: 40 / (4 * 0.01)
      tracks: [
        ...WADDLE_TRACKS,
        {
          // The heavy head counter-rolls against the body and lags it.
          partId: 'head',
          rot: [
            { t: 0, v: -0.06 },
            { t: 0.3, v: 0 },
            { t: 0.55, v: 0.07 },
            { t: 0.8, v: 0.01 },
            { t: 1, v: -0.06 },
          ],
        },
      ],
    },
    sleep: {
      // Settled onto the ground: belly (body y 15 * sy + py) rests on the
      // ground line (26), shanks hidden, head sunk into the shoulders with the
      // bill lying on the breast, eye closed (`lid`), slow breathing swell.
      durationMs: 3800,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 1.1 },
            { t: 1, v: 1.1 },
          ],
          px: [
            { t: 0, v: -8 },
            { t: 1, v: -8 },
          ],
          py: [
            { t: 0, v: 8 },
            { t: 1, v: 8 },
          ],
        },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1.03 },
            { t: 1, v: 1 },
          ],
          py: [
            { t: 0, v: 9 },
            { t: 0.5, v: 8.6 },
            { t: 1, v: 9 },
          ],
        },
        {
          partId: 'tailPlume',
          rot: [
            { t: 0, v: -0.12 },
            { t: 1, v: -0.12 },
          ],
        },
      ],
    },
    eat: {
      // Pecking low: the head swings down, the body tips after it.
      durationMs: 760,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.7 },
            { t: 0.5, v: 0.7 },
            { t: 0.68, v: 0 },
            { t: 0.82, v: 0.35 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.14 },
            { t: 0.65, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'beak',
          sy: [
            { t: 0, v: 1 },
            { t: 0.4, v: 1.15 },
            { t: 0.5, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'tailPlume',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.25 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      durationMs: 950, // happy little winglet flaps
      tracks: [
        {
          partId: 'winglet',
          rot: [
            { t: 0, v: 0 },
            { t: 0.2, v: 0.6 },
            { t: 0.4, v: 0 },
            { t: 0.6, v: 0.6 },
            { t: 0.8, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -2.5 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -2.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tailPlume',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.25 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.25 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching food home: the same heavy waddle, beak held low and full.
      durationMs: 1000,
      tracks: [
        ...WADDLE_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.3 },
            { t: 0.3, v: 0.36 },
            { t: 0.55, v: 0.42 },
            { t: 0.8, v: 0.34 },
            { t: 1, v: 0.3 },
          ],
        },
      ],
    },
    sit: {
      // Settled to brood: 26 * 0.85 + 3.9 = 26 keeps the belly on the ground.
      durationMs: 1000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 3.9 },
            { t: 1, v: 3.9 },
          ],
        },
        {
          partId: 'tailPlume',
          rot: [
            { t: 0, v: -0.1 },
            { t: 1, v: -0.1 },
          ],
        },
      ],
    },
    feedGive: {
      // The delivery hold: one gentle dip of the head, shallower than eat's
      // peck, held while the chick arrives. `food` stays visible.
      durationMs: 700,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.45 },
            { t: 0.65, v: 0.45 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.07 },
            { t: 0.65, v: 0.07 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // The chick stretches up and forward and gapes.
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
          partId: 'beak',
          sy: [
            { t: 0, v: 1 },
            { t: 0.3, v: 1.5 },
            { t: 0.7, v: 1.5 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'winglet',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.3 },
            { t: 0.42, v: 0.05 },
            { t: 0.54, v: 0.3 },
            { t: 0.66, v: 0.05 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
