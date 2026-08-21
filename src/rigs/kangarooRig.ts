/**
 * The kangaroo rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M12 task 7).
 *
 * Side view facing +x. The `body` part's origin sits at the middle of the
 * torso; the ground line is y = +30 in ROOT space (where `shadow` sits),
 * which is y = +50 in BODY space, and the hind foot and the tail tip both
 * land on it.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: a `path` torso whose mass sits at the HAUNCH and tail base
 *   and narrows forward to a light chest and tiny forearms — the opposite
 *   distribution from the deer, and the reason the two never read alike even
 *   though they share a colour family. The hind limb is three parts (a
 *   massive thigh, a long shank angling back to the heel, and a 32 px foot
 *   lying flat on the ground); the forelimb is a quarter of its length. The
 *   tail leaves the rump thick and reaches the ground line, the third leg of
 *   a kangaroo's tripod. Blacked out, that is a kangaroo and nothing else in
 *   the valley.
 * - MARKINGS (the naming set): PRIMARY is the pouch mouth — a dark interior
 *   crescent under a pale lining rim, sitting on the pale belly exactly
 *   where the eye lands. It is the species' whole signature, it survives a
 *   bake down to a ~30 px T1 sprite as a dark comma on a light front, and
 *   from M12 task 5 onward a REAL joey rides inside it. Secondaries — the
 *   pale cheek stripe, the cream throat-to-belly countershading, the dark
 *   paws and hind-foot toes and the dark tail tip — pay off at T2.
 * - SHADING: three tones (FUR / FUR_DARK+FUR_DEEP / CREAM+RIM) layered as
 *   flat-alpha shapes in the recipe's paint order — base, back mantle, belly
 *   countershading, contact band, rim sliver. No gradient fill kind exists;
 *   `format.ts` is untouched. The off-side hind and fore limbs are separate
 *   parts behind the body in the shade tone.
 * - MOTION: a real BOUND — both hind legs together, never alternating, a
 *   long flight phase, the thigh/shank/ankle chain folding and firing
 *   against each other, and the heavy tail counter-swinging the whole time.
 *
 * Rotation sign, once (recipe rule 4A): Pixi's +rotation is clockwise, so for
 * a part whose mass hangs DOWN from its pivot — every leg segment — +rot
 * swings the far end REARWARD (-x); for a part whose mass rises UP from its
 * pivot — every ear — the same +rot swings the tip FORWARD (+x). Legs and
 * ears therefore carry opposite signs inside one clip.
 *
 * THE POUCH CONTRACT (M12 task 5 — render-layer, not a style choice):
 * `pouch` must exist, must keep that exact id, and stays a pure empty-shapes
 * ANCHOR — `RigRenderer.buildRig` looks the part up by id and hands its
 * container to `Renderer`, which reparents a real riding joey's whole view
 * into it at zIndex 2 (POUCH_RIDER_Z). `pouchBack` (z 1) must stay strictly
 * BELOW that and `pouchFront` (z 3) strictly ABOVE it, with the gap intact,
 * or the joey renders on the wrong side of the pouch wall. `body` stays at
 * (0, -20) and `pouch` at (6, 20) because `Renderer.POUCH_WORLD_OFFSET_*` is
 * derived from exactly those two numbers summing to (6, 0). Task 7 owns the
 * ART inside pouchBack/pouchFront and nothing else about them.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const FUR = 0x9c8468; // base coat: sandy grey-brown
const FUR_DARK = 0x7c6a52; // shade: back mantle, off-side limbs
const FUR_DEEP = 0x584a39; // shade: creases and ground contact, low alpha only
const CREAM = 0xe9ddc4; // light: throat, belly, inner ear
const RIM = 0xfaf0da; // light: the sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const POUCH = 0x6f5c46; // the pouch's inner wall
const POUCH_DEEP = 0x453829; // the dark of the pouch mouth — primary marking
const POUCH_LINING = 0xd9c9a8; // the pale rim of the opening
const NOSE = 0x2e2620;
const BERRY = 0xcf5f52; // the carried morsel, shared with every other rig
const GROUND_SHADE = 0x3d5a2e;

/**
 * The bound (recipe rule 4B). A kangaroo has exactly one gait and it is not
 * a walk: both hind legs move as one, there is a long flight phase, and the
 * tail swings against the body throughout. t = 0 is touchdown.
 *
 *   0.00  the foot plants flat, ankle already flexing
 *   0.20  deepest compression — thigh forward, shank folded, body at its
 *         lowest, tail swung down and back
 *   0.38  the drive: the whole hind chain extends and the body starts up
 *   0.50  apex, airborne, hind legs tucked forward under the belly
 *   0.68  still floating, legs reaching ahead for the landing
 *   0.85  the foot swings down to meet the ground
 *   1.00  touchdown again
 *
 * The rise is faster than the fall on purpose: a symmetric arc samples
 * identically at t = 0.25 and t = 0.75, and those are two of the six frames
 * `RigBaker` bakes for T1 (the M9 pixel-twin bug the recipe forbids
 * reintroducing). Spot check: `body.py` reads +0.7 at t = 0.25 against −11.8
 * at t = 0.75.
 *
 * `head` is deliberately NOT here — `walk` and `carry` each add their own
 * (carry tucks the head down over the seed pod).
 */
const BOUND_TRACKS: Track[] = [
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.2, v: 4 },
      { t: 0.35, v: -6 },
      { t: 0.5, v: -24 },
      { t: 0.65, v: -20 },
      { t: 0.82, v: -6 },
      { t: 0.93, v: 2 },
      { t: 1, v: 0 },
    ],
    rot: [
      { t: 0, v: 0.06 },
      { t: 0.2, v: 0.12 },
      { t: 0.4, v: -0.08 },
      { t: 0.6, v: -0.12 },
      { t: 0.85, v: 0.02 },
      { t: 1, v: 0.06 },
    ],
  },
  {
    partId: 'hindThigh',
    rot: [
      { t: 0, v: 0.3 },
      { t: 0.2, v: 0.42 },
      { t: 0.38, v: -0.05 },
      { t: 0.5, v: -0.42 },
      { t: 0.68, v: -0.5 },
      { t: 0.85, v: -0.1 },
      { t: 1, v: 0.3 },
    ],
  },
  {
    // The shank folds AGAINST the thigh through the compression and fires
    // the other way through the drive — a curve of a different shape from
    // the thigh's, not a copy or a negation of it (recipe rule 4A's
    // articulation test). This joint is the whole reason a bound looks
    // powered rather than bounced.
    partId: 'hindShank',
    rot: [
      { t: 0, v: -0.18 },
      { t: 0.2, v: -0.45 },
      { t: 0.38, v: 0.1 },
      { t: 0.5, v: 0.5 },
      { t: 0.68, v: 0.55 },
      { t: 0.85, v: 0.15 },
      { t: 1, v: -0.18 },
    ],
  },
  {
    // The ankle: the long foot rolls flat on landing and points in flight.
    partId: 'hindFoot',
    rot: [
      { t: 0, v: 0.05 },
      { t: 0.15, v: 0.35 },
      { t: 0.35, v: 0.05 },
      { t: 0.5, v: -0.45 },
      { t: 0.7, v: -0.55 },
      { t: 0.88, v: -0.1 },
      { t: 1, v: 0.05 },
    ],
  },
  {
    // The off-side hind leg moves WITH its partner — that is what makes
    // this a bound and not a trot — damped, and a beat behind.
    partId: 'hindFar',
    rot: [
      { t: 0, v: 0.26 },
      { t: 0.22, v: 0.38 },
      { t: 0.4, v: -0.04 },
      { t: 0.52, v: -0.38 },
      { t: 0.7, v: -0.45 },
      { t: 0.87, v: -0.08 },
      { t: 1, v: 0.26 },
    ],
  },
  {
    partId: 'foreUpper',
    rot: [
      { t: 0, v: 0.2 },
      { t: 0.2, v: 0.35 },
      { t: 0.5, v: -0.15 },
      { t: 0.75, v: -0.05 },
      { t: 1, v: 0.2 },
    ],
  },
  {
    partId: 'foreLower',
    rot: [
      { t: 0, v: 0.15 },
      { t: 0.3, v: 0.4 },
      { t: 0.6, v: 0.05 },
      { t: 0.85, v: 0.1 },
      { t: 1, v: 0.15 },
    ],
  },
  {
    partId: 'foreFar',
    rot: [
      { t: 0, v: 0.16 },
      { t: 0.2, v: 0.3 },
      { t: 0.5, v: -0.12 },
      { t: 0.75, v: -0.04 },
      { t: 1, v: 0.16 },
    ],
  },
  {
    // The heavy tail counter-swings against the body all the way through —
    // down and back as she loads, up and forward as she flies.
    partId: 'tail',
    rot: [
      { t: 0, v: -0.14 },
      { t: 0.2, v: -0.24 },
      { t: 0.45, v: 0.2 },
      { t: 0.62, v: 0.26 },
      { t: 0.85, v: -0.02 },
      { t: 1, v: -0.14 },
    ],
  },
  {
    // The pouch is a slack bag of skin, not a rigid pocket: it lags the
    // body's arc by a couple of pixels. A riding joey is a child of this
    // container (M12 task 5), so this is also what makes the little one
    // jostle instead of being welded to her belly.
    partId: 'pouch',
    py: [
      { t: 0, v: 0 },
      { t: 0.25, v: 2.5 },
      { t: 0.5, v: -1 },
      { t: 0.75, v: 2.5 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'earL',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.3, v: -0.2 },
      { t: 0.62, v: -0.04 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'earR',
    rot: [
      { t: 0, v: -0.12 },
      { t: 0.35, v: -0.24 },
      { t: 0.68, v: -0.06 },
      { t: 1, v: -0.12 },
    ],
  },
];

export const kangarooRig: CreatureRig = {
  species: 'kangaroo',
  // Honest stride (recipe rule 4C): one bound covers 48 world px, most of
  // the 57 px torso — the long unhurried bound sim/species.ts describes. At
  // the kangaroo's sim speed of 9/tick × 10 ticks/s = 90 px/s (the valley's
  // fastest) that is 90/48 = 1.88 bounds per second, mid-band for a bounding
  // mammal (1.4–2.4). The old 40 px claim gave 2.25 — inside the band but at
  // its busy end, and it made the valley's biggest animal read hurried.
  // `walk`'s 533 ms duration is 48 / 0.09 px-per-ms, so the renderer's
  // playback-rate multiplier sits at ≈ 1.0 while cruising (rule 4D).
  strideLength: 48,
  parts: [
    {
      // Two ellipses, not one, and both offset rearward: a kangaroo's
      // weight is over the hind foot and the tail, not under her chest.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 30,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: -8, y: 0, rx: 46, ry: 11, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -12, y: 0.5, rx: 24, ry: 6, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The torso: deep and heavy through the haunch and tail base at the
      // rear, narrowing forward to a light chest — the mass distribution
      // that separates her from the deer even in pure outline.
      // Paint order per recipe rule 3: base, back mantle, haunch mass,
      // belly countershading, contact band, rim sliver.
      id: 'body',
      parent: null,
      x: 0,
      y: -20,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -30 0 Q -31 -12 -20 -19 Q -5 -26 11 -26 Q 23 -25 26 -16 Q 29 -8 25 -1 Q 21 9 12 15 Q 0 22 -14 21 Q -26 19 -30 0 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -30 -3 Q -31 -12 -20 -19 Q -5 -26 11 -26 Q 22 -25 25.5 -17 Q 18 -22 8 -22 Q -6 -21 -18 -14 Q -27 -8 -30 -3 Z',
          fill: { color: FUR_DARK, alpha: 0.55 },
        },
        {
          // The haunch mass, so the rump reads as muscle rather than as the
          // fat end of an egg.
          kind: 'path',
          d: 'M -30 -2 Q -33 10 -24 19 Q -14 24 -6 19 Q -12 12 -14 2 Q -18 -8 -26 -8 Z',
          fill: { color: FUR_DARK, alpha: 0.35 },
        },
        {
          // SECONDARY MARKING: the cream front, running unbroken from the
          // throat down the chest to the pouch — a kangaroo's countershading
          // is high and pale and it is half of what makes her read upright.
          kind: 'path',
          d: 'M 24 -8 Q 22 4 14 12 Q 4 19 -8 20 Q 2 14 10 6 Q 18 -2 24 -8 Z',
          fill: { color: CREAM, alpha: 0.7 },
        },
        {
          kind: 'path',
          d: 'M -24 16 Q -12 22 2 20 Q 14 15 22 6 Q 18 12 10 17 Q -2 23 -14 22 Q -22 20 -24 16 Z',
          fill: { color: FUR_DEEP, alpha: 0.2 },
        },
        {
          kind: 'path',
          d: 'M -30 -2 Q -31 -12 -20 -19 Q -5 -26 11 -26 Q 22 -25 25.5 -17.5 Q 18 -24 8 -24 Q -7 -23 -19 -16 Q -28 -9 -30 -2 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
      ],
    },
    {
      // POUCH CONTRACT (M12 task 5): a pure empty-shapes ANCHOR, kept at
      // exactly (6, 20) off a `body` at exactly (0, -20) — the two offsets
      // Renderer.ts's POUCH_WORLD_OFFSET_X/Y are derived from. A real
      // riding joey's whole view is reparented into this container at
      // zIndex 2, between the two drawn walls below. Do not give it shapes
      // (they would draw at zIndex 0, under `pouchBack`), do not rename it,
      // do not move it.
      id: 'pouch',
      parent: 'body',
      x: 6,
      y: 20,
      z: 2,
      shapes: [],
    },
    {
      // The pouch's back wall — z 1, strictly BELOW the rider's zIndex 2.
      // Drawn deliberately TALLER than `pouchFront` so a dark crescent of
      // pouch interior always shows above the near rim: with a joey aboard
      // that crescent is the dark she is tucked into, and with the pouch
      // empty it is the opening itself. This is the rig's PRIMARY MARKING.
      id: 'pouchBack',
      parent: 'pouch',
      x: 0,
      y: 0,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -18 -14 Q -20 2 -9 13 Q 3 19 13 12 Q 19 1 17 -14 Q 0 -8 -18 -14 Z',
          fill: { color: POUCH_DEEP },
        },
        {
          kind: 'path',
          d: 'M -17 -11 Q -6 -6 15 -11 Q 16 -4 14 1 Q 0 6 -14 1 Q -18 -5 -17 -11 Z',
          fill: { color: POUCH, alpha: 0.85 },
        },
        { kind: 'ellipse', x: -1, y: -12, rx: 16, ry: 3.2, fill: { color: POUCH_DEEP, alpha: 0.55 } },
      ],
    },
    {
      // The near wall — z 3, strictly ABOVE the rider's zIndex 2, so it
      // genuinely draws OVER a riding joey's lower half and she reads as
      // tucked inside rather than pasted on. Filled in her own coat colour
      // because that is what it is: a fold of her belly skin, furred on the
      // outside, with the pale lining showing only along the opening.
      id: 'pouchFront',
      parent: 'pouch',
      x: 0,
      y: -4,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -16 -5 Q -18 8 -8 17 Q 4 23 14 15 Q 19 6 16 -5 Q 0 0 -16 -5 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -16 -5 Q 0 0 16 -5 Q 15 0 13 2 Q 0 6 -13 2 Q -15 -1 -16 -5 Z',
          fill: { color: POUCH_LINING, alpha: 0.85 },
        },
        { kind: 'path', d: 'M -12 12 Q 0 19 12 12 Q 6 21 -4 21 Q -9 18 -12 12 Z', fill: { color: FUR_DEEP, alpha: 0.3 } },
      ],
    },
    {
      // Heavy and ground-anchored: it leaves the rump as thick as her thigh
      // and plants at the shadow line, the third leg of the tripod.
      id: 'tail',
      parent: 'body',
      x: -27,
      y: 6,
      z: -2,
      shapes: [
        {
          kind: 'path',
          d: 'M 2 -8 Q -9 -4 -17 9 Q -25 24 -23 38 Q -16 45 -6 40 Q 2 23 6 4 Q 6 -6 2 -8 Z',
          fill: { color: FUR_DARK },
        },
        {
          kind: 'path',
          d: 'M 0 -4 Q -9 0 -16 11 Q -23 24 -21 36 Q -16 39 -12 36 Q -10 22 -4 8 Q 0 0 0 -4 Z',
          fill: { color: CREAM, alpha: 0.35 },
        },
        // SECONDARY MARKING: the dark tail tip.
        {
          kind: 'path',
          d: 'M -23 33 Q -23 41 -16 44 Q -9 44 -6 40 Q -14 42 -19 38 Q -22 35 -23 33 Z',
          fill: { color: FUR_DEEP, alpha: 0.6 },
        },
        {
          kind: 'path',
          d: 'M 3 -7 Q -9 -3 -18 9 Q -25 22 -24 34 Q -25 21 -18 11 Q -9 -1 3 -5 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // Off-side hind leg: flat shade masses behind the body. This part and
      // `foreFar` are where nearly all the rig's perceived depth comes from.
      id: 'hindFar',
      parent: 'body',
      x: -16,
      y: 0,
      z: -4,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 -6 Q -16 8 -10 22 Q -2 30 5 26 Q 11 16 10 2 Q 8 -8 -1 -10 Z',
          fill: { color: FUR_DARK },
        },
        { kind: 'path', d: 'M 0 24 Q -8 32 -10 40 Q -9 45 -5 46 Q 1 44 3 38 Q 6 30 6 24 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -10 43 Q -13 48 -8 50 L 16 50 Q 20 48 17 43 Z', fill: { color: FUR_DARK } },
      ],
    },
    {
      id: 'foreFar',
      parent: 'body',
      x: 14,
      y: -6,
      z: -3,
      shapes: [
        { kind: 'path', d: 'M -4 -5 Q -7 3 -5 11 Q -2 20 1 21 Q 5 16 5 8 Q 5 -1 3 -6 Z', fill: { color: FUR_DARK } },
        { kind: 'ellipse', x: 1, y: 19, rx: 3, ry: 2.4, fill: { color: FUR_DEEP, alpha: 0.5 } },
      ],
    },
    {
      // The engine of the bound. Three segments so the limb BENDS: a
      // massive thigh (hip → knee, angling forward), a long shank (knee →
      // heel, angling back), then the 32 px foot. 22 + 20 + 6 px from a hip
      // at body y = +2 puts the sole exactly on the ground line at y = +50.
      id: 'hindThigh',
      parent: 'body',
      x: -14,
      y: 2,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -12 -8 Q -19 8 -12 22 Q -3 31 6 26 Q 13 15 12 1 Q 10 -11 0 -13 Q -8 -14 -12 -8 Z',
          fill: { color: FUR },
        },
        { kind: 'path', d: 'M -14 -2 Q -19 10 -12 22 Q -16 10 -14 -2 Z', fill: { color: FUR_DEEP, alpha: 0.28 } },
        { kind: 'ellipse', x: 2, y: -3, rx: 8, ry: 7, fill: { color: RIM, alpha: 0.25 } },
      ],
    },
    {
      id: 'hindShank',
      parent: 'hindThigh',
      x: 6,
      y: 22,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -5 Q -10 4 -13 14 Q -15 19 -11 21 Q -5 21 -2 14 Q 2 4 4 -5 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -4 -3 Q -10 6 -12.5 15 Q -14 19 -11.5 20.5 Q -12 13 -8 5 Z', fill: { color: FUR_DEEP, alpha: 0.25 } },
      ],
    },
    {
      // The long hind foot, flat on the ground from x = -25 to x = +7 in
      // body space. This is the silhouette fact that separates a kangaroo
      // from every other big mammal in the valley from the side.
      id: 'hindFoot',
      parent: 'hindShank',
      x: -11,
      y: 20,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -6 -4 Q -10 -1 -9 3 Q -7 6 -2 6 L 20 5.5 Q 26 4.5 25 1 Q 24 -2 19 -2 L 4 -3 Q 1 -5 -6 -4 Z',
          fill: { color: FUR },
        },
        // SECONDARY MARKING: dark toes at the ground line.
        { kind: 'ellipse', x: 23, y: 3, rx: 3.5, ry: 2.4, fill: { color: FUR_DEEP, alpha: 0.7 } },
        { kind: 'ellipse', x: 8, y: -1.5, rx: 12, ry: 1.8, fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      // The forearm, held in at the chest and a quarter of the hind limb's
      // length — the ratio is the point.
      id: 'foreUpper',
      parent: 'body',
      x: 19,
      y: -8,
      z: 3,
      shapes: [
        { kind: 'path', d: 'M -4 -5 Q -7 2 -5 9 Q -2 13 1 12 Q 4 8 4 2 Q 4 -4 3 -6 Z', fill: { color: FUR } },
        { kind: 'path', d: 'M -4 -4 Q -6.5 2 -4.5 9 Q -3 12 -1 12.5 Q -3.5 7 -3 0 Z', fill: { color: FUR_DEEP, alpha: 0.25 } },
      ],
    },
    {
      id: 'foreLower',
      parent: 'foreUpper',
      x: 0,
      y: 11,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -3 Q -5 2 -4 7 Q -3 10 0 10 Q 3 9 3 6 Q 3 1 2.5 -3 Z', fill: { color: FUR } },
        // SECONDARY MARKING: the dark paw.
        { kind: 'ellipse', x: 0.5, y: 9, rx: 3, ry: 2.4, fill: { color: FUR_DEEP, alpha: 0.6 } },
      ],
    },
    {
      // Skull only — the muzzle is its own part below, so the face has a
      // real brow-to-nose break instead of being one ellipse. Kept as `head`
      // so M12 task 2's feedGive/feedTake tracks land on the same part
      // playing the same role.
      id: 'head',
      parent: 'body',
      x: 22,
      y: -26,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 4 Q -13 -6 -5 -11 Q 4 -14 11 -9 Q 15 -4 13 3 Q 8 9 -1 9 Q -8 9 -10 4 Z',
          fill: { color: FUR },
        },
        {
          kind: 'path',
          d: 'M -10 1 Q -13 -6 -5 -11 Q 4 -14 11 -9 Q 13.5 -7 14 -4 Q 8 -10 -1 -11 Q -8 -10 -10 1 Z',
          fill: { color: FUR_DARK, alpha: 0.5 },
        },
        // SECONDARY MARKING: the pale cheek stripe, running from the muzzle
        // back under the eye — a real grey/red kangaroo face mark.
        { kind: 'path', d: 'M -2 2 Q 4 3 11 0 Q 12 3 10 5 Q 3 8 -2 6 Z', fill: { color: CREAM, alpha: 0.7 } },
        {
          kind: 'path',
          d: 'M -10 -1 Q -12.5 -6.5 -5 -11 Q 4 -14 11 -9 Q 13 -7.5 13.5 -6 Q 7 -12 -1 -12.5 Q -8 -11.5 -10 -1 Z',
          fill: { color: RIM, alpha: 0.35 },
        },
        { kind: 'ellipse', x: 3, y: -4, rx: 4, ry: 3.6, fill: { color: CREAM, alpha: 0.4 } },
        { kind: 'circle', x: 3, y: -4, r: 2.4, fill: { color: NOSE } },
      ],
    },
    {
      // The long kangaroo muzzle — as much of the head's length as the
      // skull is, which is the head's own silhouette cue.
      id: 'muzzle',
      parent: 'head',
      x: 11,
      y: 1,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -6 -6 Q 3 -8 12 -4 Q 17 -1 15 4 Q 9 8 0 7 Q -6 5 -6 -6 Z', fill: { color: FUR } },
        { kind: 'ellipse', x: 6, y: 5, rx: 6, ry: 2.4, fill: { color: CREAM, alpha: 0.7 } },
        { kind: 'ellipse', x: 14, y: 0, rx: 2.8, ry: 2.4, fill: { color: NOSE } },
        { kind: 'line', x1: 12, y1: 2, x2: 9, y2: 4.5, width: 0.8, fill: { color: FUR_DEEP, alpha: 0.5 } },
      ],
    },
    {
      // Near ear: 25 px against a 23 px skull. Tall, narrow and mobile —
      // the ratio IS the silhouette cue, so it is stated rather than
      // eyeballed.
      id: 'earL',
      parent: 'head',
      x: -3,
      y: -9,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M -4 2 Q -8 -10 -5 -22 Q -2 -28 3 -23 Q 6 -11 4 2 Q 0 5 -4 2 Z', fill: { color: FUR } },
        { kind: 'ellipse', x: -0.5, y: -12, rx: 2.6, ry: 8.5, fill: { color: CREAM, alpha: 0.75 } },
        { kind: 'ellipse', x: 3, y: -11, rx: 1.4, ry: 9, fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      // Far ear: the same shape in the shade tone, set taller and further
      // back so the pair reads as two ears in depth, not a mirror.
      id: 'earR',
      parent: 'head',
      x: 3,
      y: -10,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M -4 2 Q -8.5 -11 -5 -23 Q -2 -29.5 3.5 -24 Q 7 -11 4 2 Q 0 5 -4 2 Z', fill: { color: FUR_DARK } },
        { kind: 'ellipse', x: -0.5, y: -13, rx: 2.6, ry: 9, fill: { color: CREAM, alpha: 0.5 } },
        { kind: 'ellipse', x: -3.5, y: -11, rx: 1.4, ry: 9, fill: { color: FUR_DEEP, alpha: 0.25 } },
      ],
    },
    {
      // A seed pod carried home to the joey (M11) — only ever visible
      // during the 'carry' clip. `feedGive`/`feedTake` are in the hidden
      // list too: the kangaroo's feedMode is 'nurse' (sim/species.ts), so
      // those clips are a NURSING hold, and a nursing mother must never be
      // drawn with a pod in her mouth (recipe: the food/hideInClips rule is
      // conditioned on feedMode, and nurse mode hides the prop in both feed
      // clips).
      id: 'food',
      parent: 'head',
      x: 24,
      y: 5,
      z: 3,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.2, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.7, y: -0.7, rx: 1, ry: 0.8, fill: { color: 0xffffff, alpha: 0.5 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedGive', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A joey is a big head with half-grown ears — and per recipe rule 4F
      // the load-bearing hind chain is left alone so the long foot stays on
      // the shadow line (the old rig scaled the hind leg to 0.8 and lifted
      // it clear). Zeroing the `pouch` anchor zeroes `pouchBack` and
      // `pouchFront` with it, since both are its children: a joey has no
      // pouch of its own.
      scale: 0.4,
      partScale: {
        head: { x: 1.35, y: 1.35 },
        muzzle: { x: 0.76, y: 0.85 },
        earL: { x: 0.85, y: 0.6 },
        earR: { x: 0.85, y: 0.58 },
        pouch: { x: 0, y: 0 },
      },
    },
    juvenile: {
      // Still no pouch — it is an adult female's, and a half-grown one has
      // not got there yet.
      scale: 0.7,
      partScale: {
        head: { x: 1.12, y: 1.12 },
        muzzle: { x: 0.9, y: 0.95 },
        earL: { x: 0.95, y: 0.85 },
        earR: { x: 0.95, y: 0.83 },
        pouch: { x: 0, y: 0 },
      },
    },
    adult: { scale: 1 },
    elder: { scale: 0.97, tint: 0xc7c0b2 }, // gentle silvering
  },
  clips: {
    idle: {
      // Standing on the tripod, never quite still: an ear swivels to a
      // sound, the head lifts and settles, the tail shifts its weight.
      durationMs: 2400,
      tracks: [
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.48, v: 0.3 },
            { t: 0.56, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.64, v: 0 },
            { t: 0.71, v: 0.24 },
            { t: 0.79, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.6, v: 0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.8 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'pouch',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.8 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // See BOUND_TRACKS above: both hind legs together, a real flight
      // phase, and a hind chain that folds and fires. 533 ms is
      // strideLength / speed, so the playback-rate multiplier sits at ≈ 1.0
      // while cruising.
      durationMs: 533,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.04 },
            { t: 0.25, v: -0.06 },
            { t: 0.5, v: -0.12 },
            { t: 0.75, v: 0.02 },
            { t: 1, v: 0.04 },
          ],
        },
      ],
    },
    sleep: {
      // Dozing low in the shade scrape: the hind leg folds under, the tail
      // curls forward, the head drops onto the chest and the ears lie back.
      // `sy` 0.9 with `py` +5 keeps the foot on the shadow line (recipe
      // rule 4E: 50 × 0.9 + 5 = 50).
      durationMs: 3600,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.9 },
            { t: 0.5, v: 0.87 },
            { t: 1, v: 0.9 },
          ],
          py: [
            { t: 0, v: 5 },
            { t: 1, v: 5 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.4 },
            { t: 1, v: 0.4 },
          ],
          py: [
            { t: 0, v: 6 },
            { t: 1, v: 6 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.6 },
            { t: 1, v: -0.6 },
          ],
        },
        {
          partId: 'hindThigh',
          rot: [
            { t: 0, v: 0.3 },
            { t: 1, v: 0.3 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: -0.42 },
            { t: 1, v: -0.42 },
          ],
        },
        {
          partId: 'hindFoot',
          rot: [
            { t: 0, v: 0.18 },
            { t: 1, v: 0.18 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: 0.28 },
            { t: 1, v: 0.28 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0.35 },
            { t: 1, v: 0.35 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0.3 },
            { t: 1, v: 0.3 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: 0.32 },
            { t: 1, v: 0.32 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.22 },
            { t: 1, v: 0.22 },
          ],
        },
      ],
    },
    eat: {
      // Grazing: she drops onto her forearms and the head swings right
      // down. The body carries a `sy`/`py` pair rather than a bare `py`
      // because lowering the whole animal is what actually gets the muzzle
      // near the grass — and 50 × 0.9 + 5 = 50 keeps her foot on the shadow
      // line while she does it (recipe rule 4E). 0.95 rad is the full graze
      // dip, the yardstick 'feedGive' is deliberately gentler than.
      durationMs: 1200,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 1 },
            { t: 0.3, v: 0.9 },
            { t: 0.65, v: 0.9 },
            { t: 1, v: 1 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 5 },
            { t: 0.65, v: 5 },
            { t: 1, v: 0 },
          ],
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.1 },
            { t: 0.65, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.95 },
            { t: 0.65, v: 0.95 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 8 },
            { t: 0.65, v: 8 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'muzzle',
          py: [
            { t: 0, v: 0 },
            { t: 0.36, v: -0.7 },
            { t: 0.44, v: 0.2 },
            { t: 0.52, v: -0.7 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.32, v: -0.24 },
            { t: 0.65, v: -0.24 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.32, v: -0.28 },
            { t: 0.65, v: -0.28 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.35 },
            { t: 0.65, v: -0.35 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.15 },
            { t: 0.65, v: 0.15 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A greeting: the head turns up and across, the ears semaphore, the
      // forearms lift toward the other animal and the tail sweeps.
      durationMs: 1200,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.2 },
            { t: 0.6, v: 0.12 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.25 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.25 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.34, v: 0.2 },
            { t: 0.6, v: -0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.3 },
            { t: 0.6, v: -0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.35 },
            { t: 0.6, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a seed pod home: the same bound as `walk`, shared
      // verbatim, with the head tucked low over the pod (M11).
      durationMs: 533,
      tracks: [
        ...BOUND_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.3 },
            { t: 0.5, v: 0.4 },
            { t: 1, v: 0.3 },
          ],
        },
      ],
    },
    sit: {
      // Settled to nurse: she rocks back onto her tail and haunch, the hind
      // chain folds, the forearms come in. Also the clip a riding joey is
      // forced into while carried (Renderer.ts, M12 task 5) — she plays this
      // same hold either way. `sy` 0.85 with `py` +7.5 lands the foot back
      // on the shadow line — 50 × 0.85 + 7.5 = 50 (recipe rule 4E; the old
      // rig used +3 here and sank the foot 4.5 px through the ground).
      durationMs: 1100,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 7.5 },
            { t: 1, v: 7.5 },
          ],
        },
        {
          partId: 'hindThigh',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: -0.28 },
            { t: 1, v: -0.28 },
          ],
        },
        {
          partId: 'hindFoot',
          rot: [
            { t: 0, v: 0.12 },
            { t: 1, v: 0.12 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: 0.18 },
            { t: 1, v: 0.18 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0.22 },
            { t: 1, v: 0.22 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.06 },
            { t: 1, v: 0.06 },
          ],
        },
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: the head lowers
      // toward a ground-level meeting point — a gentle lean, well short of
      // 'eat''s 0.95 rad graze dip — and holds while the joey arrives (M12
      // task 2). This is the joey ON ITS OWN FEET, walking up to be fed at
      // ground level; the pouch is a completely separate mechanism (M12
      // task 5's real pouch-carry, which forces the rider into 'sit'), and
      // the two never play at once.
      //
      // M12 task 7 kept the `head` track byte-for-byte: `head` still exists
      // and still plays the head's role, so the gesture is literally the one
      // task 2 authored. The ear and muzzle tracks below are additive.
      durationMs: 900,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.4 },
            { t: 0.65, v: 0.4 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 3 },
            { t: 0.65, v: 3 },
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
            { t: 0.42, v: -0.5 },
            { t: 0.52, v: 0 },
            { t: 0.62, v: -0.5 },
            { t: 0.74, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the baby kangaroo during a feeding interaction: the head
      // stretches up and forward from its resting height to meet the
      // parent partway — the mirror image of 'feedGive' (M12 task 2). The
      // `head` track is likewise unchanged by task 7; the ears tip back and
      // the muzzle works fast, which is what a hungry joey does.
      durationMs: 850,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.35 },
            { t: 0.65, v: -0.35 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -4 },
            { t: 0.65, v: -4 },
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
    mount: {
      // M13 Thread 3 task 10 — the pouch mount/dismount errand's own pose
      // (Task 8 sim, Task 9 renderer ease). Played by the JOEY, not the
      // mother: `Renderer.ts`'s `clipFor` shows it to a still-on-its-own-feet
      // baby settling just before climbing in, and again to the same baby
      // right after `carriedBy` attaches, while the mount/dismount ease is
      // still running — never to an adult, since only a joey ever carries.
      //
      // A reach-and-scramble, not a walk cycle: forelimbs reach up and
      // forward (the climb), the body pitches back onto the haunch as the
      // hind chain braces and pushes rather than travels, the tail swings
      // down and back to counterweight the forward reach exactly the way it
      // counterweights the opposite lean in BOUND_TRACKS, and the head lifts
      // to look up at the pouch mouth it's climbing toward. Built the same
      // way as `feedGive`/`feedTake` next to it: same `head`-led gesture
      // shape, same ear/muzzle-style secondary tracks, same loop-safety
      // requirement (`Animator` loops every clip with no one-shot mode, and
      // the sim only ever holds this pose a few hundred ms per Task
      // 8/9 — no designed "settle to rest" tail is needed, just a clean seam
      // at t=0/1 on every channel below).
      //
      // Rotation-sign precedent (recipe rule 4A, restated in this file's
      // header): forelimbs hang down from their shoulder pivot, so negative
      // rot swings them FORWARD/UP — exactly the sign `eat`'s foreUpper
      // track already uses for reaching toward the grass, pushed further
      // here (-0.7 vs. eat's -0.35) because a climb reaches higher than a
      // graze. `tail`'s positive/negative meaning is BOUND_TRACKS' own:
      // negative is down-and-back, positive is up-and-forward — so a
      // forward weight shift onto the forelimbs counterweights with
      // negative tail rot, the same relationship BOUND_TRACKS uses (just
      // the opposite direction, since there the body is driving forward
      // over the hind legs, not reaching up over the forelimbs). `head`'s
      // sign is `idle`/`walk`'s own: negative rot + negative py is raised,
      // positive is dipped — matched here for "head raised".
      durationMs: 880,
      tracks: [
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0.05 },
            { t: 0.3, v: -0.08 },
            { t: 0.55, v: -0.1 },
            { t: 0.8, v: 0.02 },
            { t: 1, v: 0.05 },
          ],
          py: [
            { t: 0, v: 4 },
            { t: 0.3, v: 0 },
            { t: 0.55, v: -2 },
            { t: 0.8, v: 3 },
            { t: 1, v: 4 },
          ],
        },
        {
          // The hind chain braces and pushes rather than travels — a
          // scramble, not a bound — so the excursion is smaller than
          // BOUND_TRACKS' but shaped the same way (thigh and shank folding
          // against each other, recipe rule 4A's articulation test).
          partId: 'hindThigh',
          rot: [
            { t: 0, v: 0.22 },
            { t: 0.3, v: 0.3 },
            { t: 0.55, v: 0.15 },
            { t: 0.8, v: 0.2 },
            { t: 1, v: 0.22 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: -0.26 },
            { t: 0.3, v: -0.35 },
            { t: 0.55, v: -0.2 },
            { t: 0.8, v: -0.24 },
            { t: 1, v: -0.26 },
          ],
        },
        {
          partId: 'hindFoot',
          rot: [
            { t: 0, v: 0.14 },
            { t: 0.3, v: 0.22 },
            { t: 0.55, v: 0.08 },
            { t: 0.8, v: 0.12 },
            { t: 1, v: 0.14 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: 0.2 },
            { t: 0.32, v: 0.28 },
            { t: 0.58, v: 0.14 },
            { t: 0.82, v: 0.18 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          // The primary gesture: the near forelimb reaches up and forward
          // for the climb, then curls (positive `foreLower`) as if gripping
          // and pulling in mid-scramble, before releasing back to start.
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0.1 },
            { t: 0.35, v: -0.65 },
            { t: 0.6, v: -0.7 },
            { t: 0.85, v: -0.15 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'foreLower',
          rot: [
            { t: 0, v: 0.15 },
            { t: 0.35, v: -0.3 },
            { t: 0.6, v: 0.25 },
            { t: 0.85, v: 0.05 },
            { t: 1, v: 0.15 },
          ],
        },
        {
          // The off-side forelimb mirrors the reach, damped and a touch
          // behind — the same "with its partner, not alternating" beat
          // BOUND_TRACKS' `hindFar` uses for the hind pair.
          partId: 'foreFar',
          rot: [
            { t: 0, v: 0.12 },
            { t: 0.38, v: -0.55 },
            { t: 0.62, v: -0.5 },
            { t: 0.85, v: -0.1 },
            { t: 1, v: 0.12 },
          ],
        },
        {
          // Counterweighting the forward reach: swings down-and-back as the
          // forelimbs reach up-and-forward, the opposite pairing from
          // BOUND_TRACKS but the identical mechanism.
          partId: 'tail',
          rot: [
            { t: 0, v: 0.05 },
            { t: 0.35, v: -0.28 },
            { t: 0.6, v: -0.32 },
            { t: 0.85, v: -0.05 },
            { t: 1, v: 0.05 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.02 },
            { t: 0.35, v: -0.3 },
            { t: 0.6, v: -0.34 },
            { t: 0.85, v: -0.08 },
            { t: 1, v: 0.02 },
          ],
          py: [
            { t: 0, v: 1 },
            { t: 0.35, v: -4 },
            { t: 0.6, v: -5 },
            { t: 0.85, v: -1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.22 },
            { t: 0.6, v: 0.24 },
            { t: 0.85, v: 0.05 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.38, v: 0.18 },
            { t: 0.62, v: 0.2 },
            { t: 0.85, v: 0.04 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
