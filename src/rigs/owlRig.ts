/**
 * The owl rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14).
 *
 * Side view facing +x. The `body` part's origin sits at the middle of the
 * barrel torso; the ground line is y = +2 in ROOT space (where `shadow` sits),
 * which is y = +22 in BODY space, and both sets of toes land on it.
 *
 * PRIMARY MARKING: the pale facial disc with a dark rim — the one mark that
 * names an owl at a baked ~30 px T1 sprite, and the largest value jump on the
 * animal (a cream plate on a tawny head). Nearest confusable is the dodo
 * (also a big round upright bird); the disc plus two huge dark eyes is what
 * separates them.
 * SECONDARY MARKS (T2 only): the huge dark eyes with a thin amber ring, the
 * dark-streaked cream breast, the barred wings and tail, and the pale V brow
 * between the eyes.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: a `path` barrel body, widest at the belly, with a wide head
 *   sitting directly on the shoulders (NO neck), a short squared tail and
 *   feathered "trousers" ending in short toes. Blacked out that is an upright
 *   cylinder topped by a wide flat-faced head with two tiny ear points — an
 *   owl, not a robin and not a dodo.
 * - MARKINGS: see above.
 * - SHADING: TAWNY base / TAWNY_DARK+DEEP shade / CREAM+RIM light, layered as
 *   flat-alpha shapes in the recipe's paint order. The far wing and far leg
 *   are separate parts behind the body, wholly in the shade tone.
 * - MOTION: the head SWIVELS — an owl turns its face away and back while the
 *   body stays put, read here as a tilt plus a horizontal squeeze and shift of
 *   the head part. The BLINK is a separate `lid` part (two tawny lids) that
 *   squashes shut and open slowly; it is only visible in the clips that author
 *   it (idle / sleep / sit). Ground motion is a low unhurried hop-walk with the
 *   head counter-rotating (a bird stabilises its head); flight is a slow,
 *   deep, asymmetric wingbeat of both wings.
 *
 * Rotation sign, once (recipe rule 4A): Pixi's +rotation is clockwise, so for
 * a part whose mass hangs DOWN from its pivot — the legs, toes, wings, tail —
 * +rot swings the far end REARWARD (-x); for a part whose mass rises UP from
 * its pivot — the ear tufts — +rot swings the tip FORWARD (+x). The head's
 * face points +x, so +rot tips the face DOWN.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const TAWNY = 0xa08058; // base coat
const TAWNY_HEAD = 0xa88a64; // base coat, head
const TAWNY_DARK = 0x8a6c48; // shade: mantle, wings, tail, far side
const TAWNY_DEEP = 0x5e4630; // shade: bars and ground contact, low alpha only
const CREAM = 0xe3d5b8; // light: breast, thigh feathers
const RIM = 0xfff3dc; // light: sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const DISC = 0xefe4cc; // the facial disc — primary marking
const DISC_RIM = 0x6b5236; // its dark rim
const EYE_PATCH = 0x9a7a52; // darker feathering round each eye (and the lids)
const BROW = 0xfaf3e0; // the pale V brow
const EYE_RING = 0xd9a441; // thin amber ring round the huge dark eye
const EYE = 0x1d1815;
const BEAK = 0xd8c590;
const BEAK_TIP = 0x6b5636;
const LEG = 0xc9a86a; // toes
const LEG_DARK = 0x8f7544;
const TALON = 0x3a2f22;
const BERRY = 0xcf5f52; // the carried morsel, shared with every other rig
const GROUND_SHADE = 0x3d5a2e;

/**
 * The owl's ground gait (recipe rule 4B): a low, unhurried hop-walk — both feet
 * together, all the drive in the body arc, the head holding steady against it.
 * Rise is quicker than the settle, so t = 0.25 and t = 0.75 are different
 * poses (spot check: body.py reads −4.2 at t = 0.25 and −3.4 at t = 0.75).
 */
const HOP_TRACKS: Track[] = [
  // Lid held open (hidden here anyway) so no clip transition pops a half-closed lid.
  { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.1, v: 1.5 },
      { t: 0.2, v: -3 },
      { t: 0.45, v: -6 },
      { t: 0.6, v: -5.5 },
      { t: 0.8, v: -2 },
      { t: 0.92, v: 0.8 },
      { t: 1, v: 0 },
    ],
    rot: [
      { t: 0, v: 0.04 },
      { t: 0.2, v: -0.12 },
      { t: 0.45, v: -0.07 },
      { t: 0.7, v: 0.06 },
      { t: 0.9, v: 0.09 },
      { t: 1, v: 0.04 },
    ],
  },
  {
    partId: 'legF',
    rot: [
      { t: 0, v: 0.15 },
      { t: 0.12, v: 0.28 },
      { t: 0.25, v: -0.4 },
      { t: 0.45, v: -0.55 },
      { t: 0.62, v: -0.35 },
      { t: 0.8, v: 0.04 },
      { t: 0.92, v: 0.22 },
      { t: 1, v: 0.15 },
    ],
  },
  {
    // The toes curl at the tuck and splay for the landing — a different SHAPE
    // of curve from the thigh's (recipe rule 4A's articulation test).
    partId: 'footF',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.12, v: -0.3 },
      { t: 0.3, v: 0.45 },
      { t: 0.5, v: 0.5 },
      { t: 0.7, v: 0.18 },
      { t: 0.85, v: -0.28 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'legB',
    rot: [
      { t: 0, v: 0.13 },
      { t: 0.14, v: 0.26 },
      { t: 0.28, v: -0.36 },
      { t: 0.47, v: -0.52 },
      { t: 0.64, v: -0.32 },
      { t: 0.82, v: 0.02 },
      { t: 0.93, v: 0.2 },
      { t: 1, v: 0.13 },
    ],
  },
  {
    partId: 'footB',
    rot: [
      { t: 0, v: -0.08 },
      { t: 0.14, v: -0.26 },
      { t: 0.32, v: 0.4 },
      { t: 0.52, v: 0.44 },
      { t: 0.72, v: 0.16 },
      { t: 0.87, v: -0.24 },
      { t: 1, v: -0.08 },
    ],
  },
  {
    partId: 'tail',
    rot: [
      { t: 0, v: 0.08 },
      { t: 0.25, v: -0.1 },
      { t: 0.5, v: -0.04 },
      { t: 0.75, v: 0.12 },
      { t: 1, v: 0.08 },
    ],
  },
  {
    partId: 'wing',
    rot: [
      { t: 0, v: 0.03 },
      { t: 0.2, v: -0.12 },
      { t: 0.5, v: -0.16 },
      { t: 0.8, v: 0 },
      { t: 1, v: 0.03 },
    ],
  },
];

export const owlRig: CreatureRig = {
  species: 'owl',
  // Honest stride (recipe rule 4C): sim speed 8 → 80 px/s; 80 / 26 = 3.08
  // hops per second, mid-band for a hopping bird. `walk`'s 325 ms is
  // 26 / 0.08 (rule 4D), so the playback multiplier sits at ≈ 1.0 cruising.
  strideLength: 26,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 17, ry: 5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: 1, y: 0.4, rx: 10, ry: 3, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The barrel: widest at the belly, tapering to the shoulders under the
      // head. Belly line at y = +19, ground at +22: the feathered legs show.
      id: 'body',
      parent: null,
      x: 0,
      y: -22,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -14 -6 Q -15 -15 -4 -17 Q 9 -18 14 -10 Q 17 0 14 9 Q 10 18 0 19 Q -10 19 -14 11 Q -16 3 -14 -6 Z',
          fill: { color: TAWNY },
        },
        {
          // The darker back mantle.
          kind: 'path',
          d: 'M -14 -6 Q -15 -15 -4 -17 Q 4 -18 6 -17 Q -4 -12 -6 0 Q -6 10 -2 17 Q -10 17 -14 11 Q -16 3 -14 -6 Z',
          fill: { color: TAWNY_DARK, alpha: 0.55 },
        },
        {
          // Countershaded cream breast and belly.
          kind: 'path',
          d: 'M 14 -8 Q 17 0 14 9 Q 10 18 1 19 Q -4 12 -4 2 Q -2 -8 6 -12 Q 12 -12 14 -8 Z',
          fill: { color: CREAM },
        },
        // SECONDARY MARKING: the dark-streaked breast.
        { kind: 'ellipse', x: 5, y: -4, rx: 1, ry: 4, fill: { color: TAWNY_DEEP, alpha: 0.5 } },
        { kind: 'ellipse', x: 9, y: -1, rx: 1, ry: 4.2, fill: { color: TAWNY_DEEP, alpha: 0.5 } },
        { kind: 'ellipse', x: 6.5, y: 6, rx: 1, ry: 4, fill: { color: TAWNY_DEEP, alpha: 0.45 } },
        { kind: 'ellipse', x: 11, y: 6.5, rx: 0.9, ry: 3.4, fill: { color: TAWNY_DEEP, alpha: 0.4 } },
        {
          // Ground-contact band hugging the underside.
          kind: 'path',
          d: 'M -10 15 Q 0 20 10 15 Q 4 19.5 -2 19.2 Q -8 18.5 -10 15 Z',
          fill: { color: TAWNY_DEEP, alpha: 0.22 },
        },
        {
          // Sunlit sliver along the back edge.
          kind: 'path',
          d: 'M -14 -6 Q -15 -15 -4 -17 Q -9 -13 -12 -5 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // Short squared tail, barred. Tip lands on the ground line.
      id: 'tail',
      parent: 'body',
      x: -8,
      y: 11,
      z: -1,
      shapes: [
        // A short squared-off fan, tucked behind the lower body.
        { kind: 'path', d: 'M 2 -3 L -8 0 L -10 10 L -1 11.5 L 4 6 Z', fill: { color: TAWNY_DARK } },
        { kind: 'path', d: 'M -8.4 3 L 3 1 L 3.6 3.2 L -8.8 5.6 Z', fill: { color: TAWNY_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M -9.2 7.6 L 4 5.6 L 3.2 7.8 L -9.6 10 Z', fill: { color: TAWNY_DEEP, alpha: 0.45 } },
      ],
    },
    {
      // The far wing: shade tone only, peeking behind the body.
      id: 'wingFar',
      parent: 'body',
      x: -1,
      y: -9,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M 6 -3 Q -3 -6 -9 0 Q -13 9 -10 19 Q -7 22 -3 19 Q 5 12 8 3 Z', fill: { color: TAWNY_DEEP } },
      ],
    },
    {
      // The near wing, folded along the flank: barred, with a lit upper edge.
      id: 'wing',
      parent: 'body',
      x: -3,
      y: -8,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 6 -3 Q -3 -6 -9 0 Q -13 9 -10 19 Q -7 22 -3 19 Q 5 12 8 3 Z', fill: { color: TAWNY_DARK } },
        // SECONDARY MARKING: the barred wing.
        { kind: 'path', d: 'M -10 4 Q -2 1 7 3 L 7.4 5.2 Q -2 3.2 -10.4 6.6 Z', fill: { color: TAWNY_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M -11.4 10 Q -3 7 5 9 L 4.6 11.2 Q -3 9.2 -11.6 12.4 Z', fill: { color: TAWNY_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M -11 15.4 Q -4 13 2 14 L 1.2 16.2 Q -4 15.2 -10.6 17.8 Z', fill: { color: TAWNY_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M 6 -3 Q -3 -6 -9 0 Q -11 4 -11.5 6 Q -6 -1 0 -2.5 Q 4 -3 6 -3 Z', fill: { color: RIM, alpha: 0.28 } },
      ],
    },
    {
      // Off-side leg: feathered thigh wholly in shade, behind the body.
      id: 'legB',
      parent: 'body',
      x: -3,
      y: 14,
      z: -2,
      shapes: [{ kind: 'path', d: 'M -3.4 0 Q -4.4 4 -3 8 L 3 8 Q 4.4 4 3.4 0 Z', fill: { color: TAWNY_DEEP } }],
    },
    {
      id: 'footB',
      parent: 'legB',
      x: 0,
      y: 7.8,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 4.2, y2: 0.8, width: 1.7, fill: { color: LEG_DARK } },
        { kind: 'line', x1: 0, y1: 0, x2: -2.6, y2: 1, width: 1.5, fill: { color: LEG_DARK } },
      ],
    },
    {
      // Near leg: feathered "trousers" with a pale lit stripe; only the toes
      // are bare, and they are their own joint below.
      id: 'legF',
      parent: 'body',
      x: 4,
      y: 14,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -3.6 0 Q -4.6 4 -3.2 8 L 3.2 8 Q 4.6 4 3.6 0 Z', fill: { color: CREAM } },
        { kind: 'path', d: 'M -3.6 3 Q -1 5 3.4 4 Q 4 6 3.2 8 L -3.2 8 Q -4.4 5.5 -3.6 3 Z', fill: { color: TAWNY_DARK, alpha: 0.3 } },
      ],
    },
    {
      id: 'footF',
      parent: 'legF',
      x: 0,
      y: 7.8,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 5, y2: 0.8, width: 1.8, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: 3.4, y2: 1.8, width: 1.6, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: -3, y2: 1, width: 1.6, fill: { color: LEG_DARK } },
        { kind: 'line', x1: 4.2, y1: 0.7, x2: 6, y2: 1.2, width: 1, fill: { color: TALON } },
      ],
    },
    {
      // The head: wide, flat-faced, no neck. Kept as `head` so feedGive /
      // feedTake land on the part that plays the head's role.
      id: 'head',
      parent: 'body',
      x: 3,
      y: -20,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -13 3 Q -14 -7 -6 -10 Q 3 -12 10 -8 Q 14 -3 13 3 Q 10 9 0 9 Q -10 9 -13 3 Z',
          fill: { color: TAWNY_HEAD },
        },
        {
          // Darker crown and nape.
          kind: 'path',
          d: 'M -13 2 Q -14 -7 -6 -10 Q 3 -12 8 -9 Q 0 -8 -6 -4 Q -10 0 -13 2 Z',
          fill: { color: TAWNY_DARK, alpha: 0.6 },
        },
        {
          // PRIMARY MARKING: the facial disc — dark rim, then the pale plate.
          kind: 'path',
          d: 'M 2.5 -9 Q 12 -9 13 0 Q 12 8 2.5 9 Q -8 8 -9 0 Q -8 -9 2.5 -9 Z',
          fill: { color: DISC_RIM, alpha: 0.9 },
        },
        {
          kind: 'path',
          d: 'M 2.5 -7.6 Q 11 -7.5 11.5 0 Q 10.5 7 2.5 7.6 Q -6.5 7 -7.5 0 Q -6.5 -7.5 2.5 -7.6 Z',
          fill: { color: DISC },
        },
        // The darker feathering round each eye.
        { kind: 'ellipse', x: -1.5, y: 0.3, rx: 5.2, ry: 5.4, fill: { color: EYE_PATCH, alpha: 0.5 } },
        { kind: 'ellipse', x: 6.5, y: 0.3, rx: 5.2, ry: 5.4, fill: { color: EYE_PATCH, alpha: 0.5 } },
        // SECONDARY MARKING: the huge dark eyes, each with a thin amber ring.
        { kind: 'circle', x: -1.5, y: 0.3, r: 4.7, fill: { color: EYE_RING, alpha: 0.85 } },
        { kind: 'circle', x: 6.5, y: 0.3, r: 4.7, fill: { color: EYE_RING, alpha: 0.85 } },
        { kind: 'circle', x: -1.5, y: 0.3, r: 4, fill: { color: EYE } },
        { kind: 'circle', x: 6.5, y: 0.3, r: 4, fill: { color: EYE } },
        { kind: 'circle', x: -0.4, y: -1, r: 1.1, fill: { color: 0xffffff, alpha: 0.85 } },
        { kind: 'circle', x: 7.6, y: -1, r: 1.1, fill: { color: 0xffffff, alpha: 0.85 } },
        // SECONDARY MARKING: the pale V brow rising from the beak between the eyes.
        {
          kind: 'path',
          d: 'M 2.5 -1.5 L -5 -7 L -3 -8 L 2.5 -3.5 L 8 -8 L 10 -7 Z',
          fill: { color: BROW, alpha: 0.9 },
        },
        {
          kind: 'path',
          d: 'M -13 1 Q -14 -7 -6 -10 Q 3 -12 10 -8 Q 12 -6.5 12.5 -5 Q 4 -10.5 -3 -9.5 Q -11 -8 -13 1 Z',
          fill: { color: RIM, alpha: 0.28 },
        },
      ],
    },
    {
      // The eyelids: two tawny caps that squash shut from the brow downwards.
      // Visible only in idle / sleep / sit (hidden everywhere else) so they
      // never sit closed by default — 'sy' is 1 with no track.
      id: 'lid',
      parent: 'head',
      x: 0,
      y: -4.5,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: -1.5, y: 4.8, rx: 4.9, ry: 4.9, fill: { color: EYE_PATCH } },
        { kind: 'ellipse', x: 6.5, y: 4.8, rx: 4.9, ry: 4.9, fill: { color: EYE_PATCH } },
        { kind: 'line', x1: -5.5, y1: 9.6, x2: 2.5, y2: 9.6, width: 0.9, fill: { color: TAWNY_DEEP, alpha: 0.8 } },
        { kind: 'line', x1: 2.5, y1: 9.6, x2: 10.5, y2: 9.6, width: 0.9, fill: { color: TAWNY_DEEP, alpha: 0.8 } },
      ],
      hideInClips: ['walk', 'eat', 'social', 'flap', 'carry', 'feedGive', 'feedTake'],
    },
    {
      id: 'tuftL',
      parent: 'head',
      x: -9,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 2 Q -3 -6 1 -8 Q 3 -3 3 2 Z', fill: { color: TAWNY_DARK } },
        { kind: 'path', d: 'M 0.5 1 Q -1.5 -4 1 -7 Q 2 -3 2 1 Z', fill: { color: TAWNY_DEEP, alpha: 0.4 } },
      ],
    },
    {
      id: 'tuftR',
      parent: 'head',
      x: 6,
      y: -9,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 2 Q 0 -6 4 -8 Q 5 -2 4 2 Z', fill: { color: TAWNY } },
        { kind: 'path', d: 'M 0.5 -1 Q 1 -5 3.6 -7 Q 3.4 -3 2.4 0 Z', fill: { color: RIM, alpha: 0.25 } },
      ],
    },
    {
      // A short hooked beak between the eyes. 'feedGive'/'eat' scale it
      // vertically to part the bill.
      id: 'beak',
      parent: 'head',
      x: 2.5,
      y: 1.4,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -2.1 -1 Q -2.5 3 0 5.6 Q 2.5 3 2.1 -1 Q 0 -2.2 -2.1 -1 Z', fill: { color: BEAK } },
        { kind: 'path', d: 'M -1 4 Q 0 6.4 1 4 Z', fill: { color: BEAK_TIP } },
      ],
    },
    {
      // A morsel carried home to the owlets (M9 task 5). The owl's feedMode is
      // 'carry', so 'feedGive' is deliberately ABSENT from hideInClips: that
      // clip is the delivery hold. 'feedTake' stays hidden — it is played by
      // the baby, who is never the one holding food.
      id: 'food',
      parent: 'beak',
      x: 0,
      y: 5.2,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.2, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.7, y: -0.7, rx: 1, ry: 0.8, fill: { color: 0xffffff, alpha: 0.5 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'flap', 'sit', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // An owlet is a big round head with stubby tufts and tail; the leg
      // chain is left alone so the toes stay on the shadow line (rule 4F).
      scale: 0.5,
      partScale: {
        head: { x: 1.25, y: 1.25 },
        tuftL: { x: 0.4, y: 0.4 },
        tuftR: { x: 0.4, y: 0.4 },
        beak: { x: 1.15, y: 1.15 },
        tail: { x: 0.55, y: 0.8 },
        wing: { x: 0.7, y: 0.75 },
        wingFar: { x: 0.7, y: 0.75 },
      },
      tint: 0xd9cdb8,
    },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 }, tail: { x: 0.85, y: 0.95 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xcac4bd },
  },
  clips: {
    idle: {
      // The slow owlish head swivel: the face turns away (tilt + squeeze +
      // shift), holds, returns, then turns the other way; two slow blinks.
      durationMs: 3600,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.1, v: 0.02 },
            { t: 0.22, v: -0.14 },
            { t: 0.4, v: -0.14 },
            { t: 0.52, v: 0.02 },
            { t: 0.64, v: 0.12 },
            { t: 0.82, v: 0.12 },
            { t: 0.94, v: 0 },
            { t: 1, v: 0 },
          ],
          sx: [
            { t: 0, v: 1 },
            { t: 0.1, v: 1 },
            { t: 0.22, v: 0.8 },
            { t: 0.4, v: 0.8 },
            { t: 0.52, v: 1 },
            { t: 0.64, v: 0.88 },
            { t: 0.82, v: 0.88 },
            { t: 0.94, v: 1 },
            { t: 1, v: 1 },
          ],
          px: [
            { t: 0, v: 0 },
            { t: 0.1, v: 0 },
            { t: 0.22, v: -1.8 },
            { t: 0.4, v: -1.8 },
            { t: 0.52, v: 0 },
            { t: 0.64, v: 1.2 },
            { t: 0.82, v: 1.2 },
            { t: 0.94, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          // Slow blink: shut over ~0.1 of the loop and open again.
          partId: 'lid',
          sy: [
            { t: 0, v: 0.02 },
            { t: 0.05, v: 0.02 },
            { t: 0.1, v: 1 },
            { t: 0.16, v: 0.02 },
            { t: 0.7, v: 0.02 },
            { t: 0.76, v: 1 },
            { t: 0.83, v: 0.02 },
            { t: 1, v: 0.02 },
          ],
        },
        {
          partId: 'tuftR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.08 },
            { t: 0.7, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 0.985 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.45, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // See HOP_TRACKS: the owl hops low and unhurried. 325 ms is
      // strideLength / speed (rule 4D). The head counter-rotates against the body.
      durationMs: 325,
      tracks: [
        ...HOP_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.04 },
            { t: 0.2, v: 0.12 },
            { t: 0.45, v: 0.07 },
            { t: 0.7, v: -0.06 },
            { t: 0.9, v: -0.09 },
            { t: 1, v: -0.04 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.45, v: 2 },
            { t: 0.8, v: 0.8 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    sleep: {
      // Daytime roost: eyes shut, head sunk into the shoulders. 'sy' .94 with
      // 'py' 1.3 keeps the toes on the shadow line (22 × .94 + 1.3 ≈ 22).
      durationMs: 4000,
      tracks: [
        {
          partId: 'head',
          py: [
            { t: 0, v: 5 },
            { t: 1, v: 5 },
          ],
          sy: [
            { t: 0, v: 0.9 },
            { t: 1, v: 0.9 },
          ],
          rot: [
            { t: 0, v: 0.08 },
            { t: 1, v: 0.08 },
          ],
        },
        {
          partId: 'lid',
          sy: [
            { t: 0, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.95 },
            { t: 0.5, v: 0.92 },
            { t: 1, v: 0.95 },
          ],
          py: [
            { t: 0, v: 1.1 },
            { t: 1, v: 1.1 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0.08 },
            { t: 1, v: 0.08 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
      ],
    },
    eat: {
      // Tearing at a morsel: the head dips and tugs twice, the bill parts.
      durationMs: 700,
      tracks: [
        { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.28, v: 0.65 },
            { t: 0.42, v: 0.5 },
            { t: 0.58, v: 0.65 },
            { t: 0.78, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'beak',
          sy: [
            { t: 0, v: 1 },
            { t: 0.26, v: 1.3 },
            { t: 0.4, v: 1 },
            { t: 0.56, v: 1.25 },
            { t: 0.7, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.1 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.18 },
            { t: 0.7, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // Bobbing display: the head bobs and tilts, the wings flare, the tufts lift.
      durationMs: 1000,
      tracks: [
        { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'head',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -3 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -3 },
            { t: 1, v: 0 },
          ],
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: -0.15 },
            { t: 0.5, v: 0.05 },
            { t: 0.75, v: -0.15 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.35 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'wingFar',
          rot: [
            { t: 0, v: 0 },
            { t: 0.55, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tuftR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.2 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -1.2 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    flap: {
      // Silent-wing owl flight — slow, deep, steady. The downstroke is longer
      // than the upstroke, so t = 0.25 and t = 0.75 differ; both wings beat,
      // the far one a touch behind; the legs trail back.
      durationMs: 600,
      tracks: [
        { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          // Spread wings. Mass hangs down, so +rot swings the tip rearward
          // and over the top: ~2.5 is up-and-back (top of the upstroke),
          // -0.6 is down-and-forward (bottom of the downstroke). Downstroke
          // (0.2 -> 0.75) is slower than the upstroke (0.75 -> 1.2).
          partId: 'wing',
          rot: [
            { t: 0, v: 2.0 },
            { t: 0.2, v: 2.5 },
            { t: 0.5, v: 1.0 },
            { t: 0.75, v: -0.6 },
            { t: 1, v: 2.0 },
          ],
          sy: [
            { t: 0, v: 1.6 },
            { t: 0.2, v: 1.75 },
            { t: 0.5, v: 1.5 },
            { t: 0.75, v: 1.55 },
            { t: 1, v: 1.6 },
          ],
          sx: [
            { t: 0, v: 1.3 },
            { t: 0.2, v: 1.5 },
            { t: 0.75, v: 1.3 },
            { t: 1, v: 1.3 },
          ],
        },
        {
          partId: 'wingFar',
          rot: [
            { t: 0, v: 1.7 },
            { t: 0.25, v: 2.1 },
            { t: 0.55, v: 0.7 },
            { t: 0.8, v: -0.9 },
            { t: 1, v: 1.7 },
          ],
          sy: [
            { t: 0, v: 1.5 },
            { t: 0.25, v: 1.65 },
            { t: 0.55, v: 1.4 },
            { t: 0.8, v: 1.5 },
            { t: 1, v: 1.5 },
          ],
          sx: [
            { t: 0, v: 1.2 },
            { t: 0.25, v: 1.4 },
            { t: 0.8, v: 1.2 },
            { t: 1, v: 1.2 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: -0.7 },
            { t: 1, v: -0.7 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: -0.7 },
            { t: 1, v: -0.7 },
          ],
        },
        {
          partId: 'footF',
          rot: [
            { t: 0, v: -0.4 },
            { t: 1, v: -0.4 },
          ],
        },
        {
          partId: 'footB',
          rot: [
            { t: 0, v: -0.4 },
            { t: 1, v: -0.4 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.05 },
            { t: 0.5, v: 0.1 },
            { t: 1, v: -0.05 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -2 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching food home: the same hop as `walk`, bill held low and full.
      durationMs: 325,
      tracks: [
        ...HOP_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.15 },
            { t: 0.45, v: 0.28 },
            { t: 0.8, v: 0.2 },
            { t: 1, v: 0.15 },
          ],
        },
      ],
    },
    sit: {
      // Settled to brood: a gentle squash, legs folded, slow blinks. 'sy' .85
      // with 'py' 3.3 puts the toes back on the shadow line (22 × .85 + 3.3 ≈ 22).
      durationMs: 3000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 3.3 },
            { t: 1, v: 3.3 },
          ],
        },
        {
          partId: 'lid',
          sy: [
            { t: 0, v: 0.02 },
            { t: 0.7, v: 0.02 },
            { t: 0.78, v: 1 },
            { t: 0.86, v: 0.02 },
            { t: 1, v: 0.02 },
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
            { t: 0, v: 0.38 },
            { t: 1, v: 0.38 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.2 },
            { t: 1, v: -0.2 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.05 },
            { t: 1, v: 0.05 },
          ],
        },
      ],
    },
    feedGive: {
      // The delivery hold: a single gentle dip of the head, shallower than
      // 'eat''s tug, held while the owlet arrives. `food` stays visible.
      durationMs: 700,
      tracks: [
        { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.55 },
            { t: 0.65, v: 0.55 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'beak',
          sy: [
            { t: 0, v: 1 },
            { t: 0.35, v: 1.2 },
            { t: 0.65, v: 1.2 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.1 },
            { t: 0.65, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.16 },
            { t: 0.65, v: -0.16 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the owlet: the head stretches up to the parent's bill, the
      // bill gapes, the wings quiver — the mirror of 'feedGive'.
      durationMs: 650,
      tracks: [
        { partId: 'lid', sy: [{ t: 0, v: 0.02 }, { t: 1, v: 0.02 }] },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.45 },
            { t: 0.65, v: -0.45 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'beak',
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
            { t: 0.3, v: -0.2 },
            { t: 0.42, v: -0.05 },
            { t: 0.54, v: -0.2 },
            { t: 0.66, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -1.5 },
            { t: 0.65, v: -1.5 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
