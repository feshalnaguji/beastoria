/**
 * The deer rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M12 task 7).
 *
 * Side view facing +x. The `body` part's origin sits at the middle of the
 * torso; the ground line is y = +2 in ROOT space (where `shadow` sits), which
 * is y = +60 in BODY space, and every hoof lands on it.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: a `path` torso whose deepest point is the SHOULDER (37 px of
 *   chest at x = +30) tapering to a shallow 28 px loin at the rump — a deer
 *   carries its bulk forward, the opposite of the rabbit. Ground clearance is
 *   45 px against a 37 px body depth: more than a body's depth of daylight
 *   under the belly, which is the single loudest large-herbivore cue. Fore
 *   and hind legs are near-equal and both long, the hind one folding through
 *   a real stifle and hock. Blacked out that is a deer and not a kangaroo.
 * - MARKINGS (the naming set): PRIMARY is the white rump-and-tail flash — the
 *   biggest value jump on the animal, placed at the rear edge so it breaks
 *   the rump silhouette and survives a bake down to a ~30 px T1 sprite.
 *   Secondaries — the fawn spot line (baby/juvenile only, scaled away by the
 *   adult stage), the cream throat bib, the white muzzle band under a black
 *   nose, dark hooves and a pale eye surround — are true whitetail field
 *   marks that only pay off at T2.
 * - SHADING: three tones (COAT / COAT_SHADE+COAT_DEEP / CREAM+RIM) layered as
 *   flat-alpha shapes in the recipe's paint order — base, back mantle, belly
 *   countershading, contact band, rim sliver. No gradient fill kind exists;
 *   `format.ts` is untouched. The off-side legs are separate parts behind the
 *   body in the shade tone, which is where most of the depth comes from.
 * - MOTION: a real two-beat TROT — diagonal pairs, no flight phase, barely
 *   any vertical travel — with an asymmetric stance/swing split so the T1
 *   flipbook's t = 0.25 and t = 0.75 frames are genuinely different poses.
 *
 * Rotation sign, once (recipe rule 4A): Pixi's +rotation is clockwise, so for
 * a part whose mass hangs DOWN from its pivot — every leg segment — +rot
 * swings the far end REARWARD (-x); for a part whose mass rises UP from its
 * pivot — every ear — the same +rot swings the tip FORWARD (+x). Legs and
 * ears therefore carry opposite signs inside one clip.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const COAT = 0xc99b6f; // base coat: warm summer fawn
const COAT_SHADE = 0xa9805a; // shade: back mantle, off-side limbs
const COAT_DEEP = 0x7d5c3f; // shade: creases and ground contact, low alpha only
const CREAM = 0xf1e5d2; // light: belly, throat bib, muzzle band
const RIM = 0xfff3e0; // light: the sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const FLASH = 0xfaf6ee; // the white rump-and-tail flash — primary marking
const EAR_PINK = 0xe9c9d4; // inner ear lining
const HOOF = 0x3a322c; // dark hooves — the mark at the ground line
const NOSE = 0x2b2320;
const EYE = 0x2b2320;
const BERRY = 0xcf5f52; // the carried morsel, shared with every other rig
const GROUND_SHADE = 0x3d5a2e;

/**
 * The trot (recipe rule 4B). A deer does not bound: diagonal pairs move
 * together, there is no flight phase, and the body barely rises. t = 0 is the
 * near-fore / far-hind pair's touchdown; the other diagonal plants at t ≈ 0.5.
 *
 * Stance is deliberately SHORTER than swing (0 → 0.45 planted, 0.45 → 1
 * swinging) rather than a tidy half-and-half, because a symmetric three-key
 * clip samples identically at t = 0.25 and t = 0.75 — and those are two of
 * the six frames `RigBaker` bakes for T1, so a symmetric trot ships two
 * pixel-twin frames (the M9 bug the recipe forbids reintroducing). Spot
 * check: `foreUpper` reads +0.02 at t = 0.25 and −0.38 at t = 0.75.
 *
 * `neck`/`head` are deliberately NOT here — `walk` and `carry` each add their
 * own (carry holds the head low over the morsel the whole way).
 */
const TROT_TRACKS: Track[] = [
  {
    // Minimal vertical travel, twice per cycle — a trot is a level gait.
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.22, v: -2.5 },
      { t: 0.45, v: 0 },
      { t: 0.7, v: -2.2 },
      { t: 1, v: 0 },
    ],
  },
  {
    partId: 'foreUpper',
    rot: [
      { t: 0, v: -0.32 },
      { t: 0.45, v: 0.3 },
      { t: 0.6, v: 0.1 },
      { t: 0.75, v: -0.38 },
      { t: 0.9, v: -0.34 },
      { t: 1, v: -0.32 },
    ],
  },
  {
    // The knee folds hard during swing and stays near-straight through
    // stance — a curve of a different SHAPE from the upper's, not a copy or
    // a negation of it (recipe rule 4A's articulation test).
    partId: 'foreLower',
    rot: [
      { t: 0, v: 0.06 },
      { t: 0.45, v: 0.12 },
      { t: 0.6, v: 0.62 },
      { t: 0.75, v: 0.28 },
      { t: 0.9, v: 0 },
      { t: 1, v: 0.06 },
    ],
  },
  {
    // Half a cycle out of phase with the foreleg above: the near hind and
    // the near fore are on OPPOSITE diagonals.
    partId: 'hindThigh',
    rot: [
      { t: 0, v: 0.2 },
      { t: 0.1, v: 0.06 },
      { t: 0.25, v: -0.3 },
      { t: 0.4, v: -0.27 },
      { t: 0.5, v: -0.25 },
      { t: 0.95, v: 0.24 },
      { t: 1, v: 0.2 },
    ],
  },
  {
    // The hock flexes against the stifle — a deer's hind leg is a zig-zag
    // and the two joints never move in step.
    partId: 'hindShank',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.1, v: 0.05 },
      { t: 0.25, v: 0.5 },
      { t: 0.4, v: 0.3 },
      { t: 0.5, v: 0.12 },
      { t: 0.95, v: -0.16 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'hindHoof',
    rot: [
      { t: 0, v: 0.06 },
      { t: 0.12, v: -0.1 },
      { t: 0.28, v: -0.3 },
      { t: 0.5, v: -0.05 },
      { t: 0.75, v: 0.14 },
      { t: 1, v: 0.06 },
    ],
  },
  {
    // The off-side foreleg travels with the NEAR HIND (same diagonal).
    partId: 'foreFar',
    rot: [
      { t: 0, v: 0.18 },
      { t: 0.1, v: 0.05 },
      { t: 0.25, v: -0.28 },
      { t: 0.4, v: -0.25 },
      { t: 0.5, v: -0.23 },
      { t: 0.95, v: 0.22 },
      { t: 1, v: 0.18 },
    ],
  },
  {
    // ...and the off-side hind with the near fore.
    partId: 'hindFar',
    rot: [
      { t: 0, v: -0.26 },
      { t: 0.45, v: 0.24 },
      { t: 0.6, v: 0.08 },
      { t: 0.75, v: -0.3 },
      { t: 0.9, v: -0.28 },
      { t: 1, v: -0.26 },
    ],
  },
  {
    partId: 'tail',
    rot: [
      { t: 0, v: 0.04 },
      { t: 0.3, v: -0.06 },
      { t: 0.65, v: 0.08 },
      { t: 1, v: 0.04 },
    ],
  },
  {
    partId: 'earL',
    rot: [
      { t: 0, v: -0.06 },
      { t: 0.4, v: 0.02 },
      { t: 0.75, v: -0.1 },
      { t: 1, v: -0.06 },
    ],
  },
  {
    partId: 'earR',
    rot: [
      { t: 0, v: -0.08 },
      { t: 0.45, v: 0 },
      { t: 0.8, v: -0.12 },
      { t: 1, v: -0.08 },
    ],
  },
];

export const deerRig: CreatureRig = {
  species: 'deer',
  // Honest stride (recipe rule 4C): one full trot cycle covers 48 world px,
  // a little over half the 90 px torso — the long level reach of a trot, not
  // a scurry. At the deer's sim speed of 7/tick × 10 ticks/s = 70 px/s that
  // is 70/48 = 1.46 cycles per second, inside the 1.2–2.0 band for a walking
  // quadruped. `walk`'s 686 ms duration is 48 / 0.07 px-per-ms, so the
  // renderer's playback-rate multiplier sits at ≈ 1.0 while cruising
  // (rule 4D) and the six baked T1 frames show the poses the T2 rig shows.
  strideLength: 48,
  parts: [
    {
      // Two ellipses, not one: a wide soft pool plus a tighter darker core
      // under the chest, where a front-heavy animal's weight actually is.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 46, ry: 11, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: 12, y: 0.5, rx: 26, ry: 6, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The torso: withers highest and chest deepest at x ≈ +26, loin
      // shallow and tucked at the rear, belly line at y = +15 with the
      // ground at +60 — 45 px of daylight underneath.
      // Paint order per recipe rule 3: base, back mantle, belly
      // countershading, contact band, rim sliver — then the rump flash.
      id: 'body',
      parent: null,
      x: 0,
      y: -58,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -44 -4 Q -42 -19 -30 -20 Q -14 -23 4 -24 Q 24 -25 38 -16 Q 46 -10 46 -2 Q 46 8 38 13 Q 30 17 22 16 Q 10 14 0 11 Q -18 10 -30 8 Q -40 7 -44 -4 Z',
          fill: { color: COAT },
        },
        {
          // The darker dorsal mantle running withers to rump.
          kind: 'path',
          d: 'M -43 -7 Q -41 -19 -30 -20 Q -14 -23 4 -24 Q 24 -25 38 -16 Q 43 -12 45 -5 Q 38 -13 26 -17 Q 8 -19 -8 -18 Q -28 -16 -38 -11 Q -42 -9 -43 -7 Z',
          fill: { color: COAT_SHADE, alpha: 0.55 },
        },
        {
          // Countershaded belly — a marking as much as a tone.
          kind: 'path',
          d: 'M -36 4 Q -24 8 -8 9 Q 10 12 24 14 Q 34 15 42 8 Q 45 4 46 0 Q 44 8 38 13 Q 30 17 22 16 Q 10 14 0 11 Q -18 10 -30 8 Q -34 7 -36 4 Z',
          fill: { color: CREAM, alpha: 0.7 },
        },
        {
          // Thin ground-contact band hugging the bottom silhouette edge.
          kind: 'path',
          d: 'M -38 6 Q -22 11 -2 12 Q 18 16 30 17 Q 38 15 44 8 Q 42 13 36 15 Q 28 18 20 17 Q 6 14 -8 11 Q -26 9 -38 6 Z',
          fill: { color: COAT_DEEP, alpha: 0.2 },
        },
        {
          // Rim light: the outer 2–3 px of the back, sitting on the mantle.
          kind: 'path',
          d: 'M -43 -6 Q -41 -19 -30 -20 Q -14 -23 4 -24 Q 24 -25 38 -16 Q 43 -12 45 -6 Q 39 -15 26 -20 Q 8 -21 -8 -20 Q -28 -19 -38 -12 Q -41 -9 -43 -6 Z',
          fill: { color: RIM, alpha: 0.4 },
        },
        {
          // PRIMARY MARKING: the white rump flash, hard against the rear
          // silhouette edge so the tail's white underside reads as its
          // continuation. Near-white, and big enough to survive a T1 bake.
          kind: 'path',
          d: 'M -45 -6 Q -44 -16 -34 -17 Q -27 -10 -28 0 Q -30 7 -38 7 Q -44 4 -45 -6 Z',
          fill: { color: FLASH },
        },
      ],
    },
    {
      // SECONDARY MARKING: the fawn spot line. Scaled to zero by the adult
      // and elder stages — spots really do fade at the first moult, and it
      // costs no new art to say so (the deer's oldest trick, kept).
      id: 'spots',
      parent: 'body',
      x: 0,
      y: -6,
      z: 1,
      shapes: [
        { kind: 'circle', x: -20, y: -4, r: 3.2, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -8, y: 2, r: 2.8, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -26, y: 6, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 4, y: -6, r: 3, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 14, y: 2, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
      ],
    },
    {
      // Off-side hind leg: a flat shade mass behind the body. This part and
      // `foreFar` are where nearly all the rig's perceived depth comes from
      // — without them a side-view deer is a flat card with two legs.
      id: 'hindFar',
      parent: 'body',
      x: -34,
      y: 4,
      z: -3,
      shapes: [
        { kind: 'path', d: 'M -7 -5 Q -10 8 -6 20 Q -2 26 2 25 Q 6 19 6 7 Q 6 -3 4 -7 Z', fill: { color: COAT_SHADE } },
        {
          kind: 'path',
          d: 'M -3 22 Q -6 34 -5 44 Q -5 52 -3.5 56 L 2 56 Q 3.5 50 3 42 Q 3 32 3.5 22 Z',
          fill: { color: COAT_SHADE },
        },
      ],
    },
    {
      id: 'foreFar',
      parent: 'body',
      x: 22,
      y: 8,
      z: -3,
      shapes: [
        { kind: 'path', d: 'M -6 -6 Q -9 6 -6 18 Q -3 24 1 24 Q 5 18 5 6 Q 5 -4 3 -8 Z', fill: { color: COAT_SHADE } },
        {
          kind: 'path',
          d: 'M -3 21 Q -5 32 -4 42 Q -4 49 -3 52 L 2.5 52 Q 3.5 47 3 40 Q 3 30 3 21 Z',
          fill: { color: COAT_SHADE },
        },
      ],
    },
    {
      // The tail hangs (a calm deer's does) but its white underside carries
      // the rump flash down past the silhouette edge, so even blacked out
      // the rump is not a smooth arc.
      id: 'tail',
      parent: 'body',
      x: -43,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M -3 -6 Q -9 -2 -11 10 Q -9 20 -2 21 Q 5 17 6 4 Q 6 -4 -3 -6 Z', fill: { color: COAT_SHADE } },
        { kind: 'path', d: 'M -10 8 Q -10 -1 -4 -5 Q -3 4 -1 14 Q -4 20 -9 17 Q -11 13 -10 8 Z', fill: { color: FLASH } },
        { kind: 'ellipse', x: 2, y: 4, rx: 3, ry: 8, fill: { color: RIM, alpha: 0.25 } },
      ],
    },
    {
      // Near hind limb, three segments so it BENDS rather than swings:
      // thigh (hip → stifle), shank (stifle → hock, angling back), then the
      // cannon and hoof. 20 + 18 + 16 px from a hip at body y = +6 puts the
      // sole exactly on the ground line at y = +60.
      id: 'hindThigh',
      parent: 'body',
      x: -30,
      y: 6,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 -8 Q -14 4 -9 16 Q -3 24 4 21 Q 10 14 10 2 Q 9 -9 1 -12 Q -7 -13 -10 -8 Z',
          fill: { color: COAT },
        },
        { kind: 'path', d: 'M -12 -2 Q -14 8 -8 17 Q -11 8 -10 -2 Z', fill: { color: COAT_DEEP, alpha: 0.25 } },
      ],
    },
    {
      id: 'hindShank',
      parent: 'hindThigh',
      x: 4,
      y: 20,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -2.5 -5 Q -7 4 -9 13 Q -10 18 -7 19 Q -3 19 -1.5 13 Q 2 4 3 -5 Z', fill: { color: COAT } },
        { kind: 'path', d: 'M -3 -3 Q -7 5 -8.5 14 Q -9.5 18 -7.5 18.5 Q -8 12 -5 4 Z', fill: { color: COAT_DEEP, alpha: 0.22 } },
      ],
    },
    {
      id: 'hindHoof',
      parent: 'hindShank',
      x: -6,
      y: 18,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -2.5 -3 Q -4 4 -3.5 9 Q -3.5 12 -3 14 L 2.5 14 Q 3 11 3 7 Q 3 2 2.5 -3 Z', fill: { color: COAT } },
        // SECONDARY MARKING: a dark hoof, the mark that sits right where the
        // eye already is — on the ground line.
        { kind: 'path', d: 'M -3 11 Q -4.5 15 -2 16 L 2.5 16 Q 4 15 3 11 Z', fill: { color: HOOF } },
        { kind: 'ellipse', x: 1.5, y: 5, rx: 1.2, ry: 8, fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      // Near foreleg: shoulder → elbow (22 px), then cannon and hoof (31 px)
      // from a shoulder at body y = +8 — again exactly 60.
      id: 'foreUpper',
      parent: 'body',
      x: 28,
      y: 8,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -6 -8 Q -9 4 -6 16 Q -3 22 1 22 Q 5 16 6 4 Q 6 -7 3 -10 Z', fill: { color: COAT } },
        {
          kind: 'path',
          d: 'M -6 -6 Q -8.5 5 -6 16 Q -4 21 -1.5 22 Q -4.5 15 -4 6 Q -4 -2 -3 -7 Z',
          fill: { color: COAT_DEEP, alpha: 0.2 },
        },
      ],
    },
    {
      id: 'foreLower',
      parent: 'foreUpper',
      x: 0,
      y: 21,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -3 -4 Q -5 6 -4 16 Q -4 24 -3 28 L 2.5 28 Q 3.5 22 3 14 Q 3 4 3 -4 Z', fill: { color: COAT } },
        { kind: 'path', d: 'M -3.2 25 Q -4.6 30 -2 31 L 2.6 31 Q 4.2 30 3.2 25 Z', fill: { color: HOOF } },
        { kind: 'ellipse', x: 1.8, y: 8, rx: 1.2, ry: 10, fill: { color: RIM, alpha: 0.3 } },
      ],
    },
    {
      // The neck — kept as `neck` because M12 task 2's feedGive/feedTake
      // gesture lives on it, and it still plays exactly the neck's role.
      // Long and rising forward, the way a deer carries its head; the throat
      // side takes the light, the nape side takes the shade.
      id: 'neck',
      parent: 'body',
      x: 34,
      y: -15,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 6 Q -13 -10 -6 -25 Q 0 -35 10 -38 Q 19 -36 17 -28 Q 11 -17 7 -4 Q 0 8 -10 6 Z',
          fill: { color: COAT },
        },
        {
          kind: 'path',
          d: 'M -10 4 Q -12 -10 -6 -24 Q -1 -32 6 -36 Q -1 -28 -4 -18 Q -7 -8 -6 4 Z',
          fill: { color: COAT_SHADE, alpha: 0.5 },
        },
        {
          // SECONDARY MARKING: the cream throat bib.
          kind: 'path',
          d: 'M 11 -35 Q 17 -29 13 -18 Q 9 -8 5 -2 Q 1 4 -4 4 Q 4 -5 8 -17 Q 12 -26 11 -35 Z',
          fill: { color: CREAM, alpha: 0.65 },
        },
        { kind: 'path', d: 'M 10 -38 Q 18 -36 17 -28 Q 15 -34 9 -35 Z', fill: { color: RIM, alpha: 0.35 } },
      ],
    },
    {
      // Skull only — the muzzle is its own part below, so the face has a
      // real brow-to-nose break instead of being one circle.
      id: 'head',
      parent: 'neck',
      x: 12,
      y: -36,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -10 5 Q -13 -6 -5 -11 Q 5 -14 12 -8 Q 16 -3 14 4 Q 9 10 0 10 Q -7 10 -10 5 Z',
          fill: { color: COAT },
        },
        {
          kind: 'path',
          d: 'M -10 2 Q -13 -6 -5 -11 Q 5 -14 12 -8 Q 14.5 -6 15 -3 Q 9 -9 0 -10 Q -8 -9 -10 2 Z',
          fill: { color: COAT_SHADE, alpha: 0.5 },
        },
        {
          kind: 'path',
          d: 'M -10 0 Q -12.5 -6.5 -5 -11 Q 5 -14 12 -8 Q 14 -6.5 14.5 -4.5 Q 8 -11 0 -12 Q -8 -11 -10 0 Z',
          fill: { color: RIM, alpha: 0.35 },
        },
        // SECONDARY MARKING: the pale eye surround — the thing that turns a
        // dark dot into an eye once you zoom to T2.
        { kind: 'ellipse', x: 4, y: -3, rx: 4.6, ry: 4, fill: { color: CREAM, alpha: 0.45 } },
        { kind: 'circle', x: 4, y: -3, r: 2.7, fill: { color: EYE } },
        { kind: 'circle', x: 5, y: -4.2, r: 0.9, fill: { color: 0xffffff, alpha: 0.8 } },
      ],
    },
    {
      // SECONDARY MARKING: the white muzzle band under a black nose — the
      // whitetail's face, and the reason the head reads as a deer's head
      // rather than a generic hoofed wedge.
      id: 'muzzle',
      parent: 'head',
      x: 12,
      y: 0,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -6 -6 Q 4 -8 13 -4 Q 18 -1 16 4 Q 10 9 0 8 Q -6 6 -6 -6 Z', fill: { color: COAT } },
        { kind: 'ellipse', x: 9, y: 2, rx: 7, ry: 4, fill: { color: CREAM, alpha: 0.85 } },
        { kind: 'ellipse', x: 15, y: 0, rx: 3, ry: 2.6, fill: { color: NOSE } },
        { kind: 'ellipse', x: 4, y: 6.5, rx: 5, ry: 2, fill: { color: CREAM, alpha: 0.7 } },
      ],
    },
    {
      // A morsel carried home to the fawns (M9 task 5) — only ever visible
      // during the 'carry' clip. `feedGive`/`feedTake` are in the hidden
      // list too: the deer's feedMode is 'nurse' (sim/species.ts), so those
      // clips are a NURSING hold, and a doe must never nurse with a berry in
      // her mouth (recipe: the food/hideInClips rule is conditioned on
      // feedMode, and nurse mode hides the prop in both feed clips).
      id: 'food',
      parent: 'muzzle',
      x: 17,
      y: 2,
      z: 3,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 3, ry: 2.5, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.8, y: -0.8, rx: 1.1, ry: 0.9, fill: { color: 0xffffff, alpha: 0.5 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedGive', 'feedTake'],
    },
    {
      // Near ear: a big cupped leaf, ~22 px against a 24 px skull. Deer ears
      // are enormous and that ratio is half the head's silhouette.
      id: 'earL',
      parent: 'head',
      x: -4,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M -3 2 Q -10 -6 -9 -17 Q -6 -23 -1 -20 Q 4 -12 4 0 Q 1 4 -3 2 Z', fill: { color: COAT } },
        { kind: 'ellipse', x: -2.5, y: -10, rx: 3, ry: 7.5, fill: { color: EAR_PINK, alpha: 0.8 } },
        {
          kind: 'path',
          d: 'M -3 1 Q -9 -6 -8 -16 Q -6 -21 -3 -20 Q -7 -14 -6 -6 Q -5 -2 -3 1 Z',
          fill: { color: COAT_DEEP, alpha: 0.25 },
        },
      ],
    },
    {
      // Far ear: the same shape in the shade tone, set taller and further
      // back so the pair reads as two ears in depth, not a mirror.
      id: 'earR',
      parent: 'head',
      x: 2,
      y: -10,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M -3 2 Q -11 -7 -10 -18 Q -7 -25 -1.5 -21.5 Q 4 -13 4.5 0 Q 1 5 -3 2 Z', fill: { color: COAT_SHADE } },
        { kind: 'ellipse', x: -3, y: -11, rx: 3, ry: 8, fill: { color: EAR_PINK, alpha: 0.55 } },
        {
          kind: 'path',
          d: 'M -3 1 Q -10 -7 -9 -17 Q -7 -22 -4 -21 Q -8 -14 -7 -6 Q -6 -2 -3 1 Z',
          fill: { color: COAT_DEEP, alpha: 0.2 },
        },
      ],
    },
  ],
  stages: {
    baby: {
      // A fawn is a big head on a short neck with the spots still bright —
      // and per recipe rule 4F the load-bearing leg chain is left alone so
      // the hooves stay on the shadow line (the old rig scaled all four legs
      // to 0.85 and lifted every foot clear of the ground).
      scale: 0.45,
      partScale: {
        head: { x: 1.34, y: 1.34 },
        muzzle: { x: 0.78, y: 0.85 },
        neck: { x: 0.9, y: 0.78 },
        earL: { x: 0.92, y: 0.78 },
        earR: { x: 0.92, y: 0.76 },
      },
    },
    juvenile: {
      scale: 0.72,
      partScale: {
        head: { x: 1.12, y: 1.12 },
        muzzle: { x: 0.9, y: 0.95 },
        neck: { x: 0.96, y: 0.92 },
        spots: { x: 0.6, y: 0.6 },
      },
    },
    adult: { scale: 1, partScale: { spots: { x: 0, y: 0 } } }, // spots fade with age
    elder: { scale: 0.97, tint: 0xcfcac2, partScale: { spots: { x: 0, y: 0 } } },
  },
  clips: {
    idle: {
      // Standing, never quite still: an ear rotates to a sound, the tail
      // twitches at a fly, and the neck sways with the breath.
      durationMs: 2600,
      tracks: [
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.48, v: 0.35 },
            { t: 0.56, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.62, v: 0 },
            { t: 0.69, v: 0.26 },
            { t: 0.77, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.7, v: 0 },
            { t: 0.78, v: 0.5 },
            { t: 0.86, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.06 },
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
            { t: 0.5, v: 0.7 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // See TROT_TRACKS above: diagonal pairs, no flight phase, an
      // asymmetric stance/swing split. 686 ms is strideLength / speed, so
      // the playback-rate multiplier sits at ≈ 1.0 while cruising.
      durationMs: 686,
      tracks: [
        ...TROT_TRACKS,
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0.02 },
            { t: 0.25, v: -0.05 },
            { t: 0.5, v: 0.04 },
            { t: 0.75, v: -0.03 },
            { t: 1, v: 0.02 },
          ],
        },
        {
          // The head counter-swings against the neck so it stays level —
          // the thing that reads as poise rather than bobbing.
          partId: 'head',
          rot: [
            { t: 0, v: -0.02 },
            { t: 0.3, v: 0.04 },
            { t: 0.6, v: -0.05 },
            { t: 1, v: -0.02 },
          ],
        },
      ],
    },
    sleep: {
      // Bedded in the glade: the legs fold, the body settles, and the neck
      // curls the head round toward the flank. `sy` 0.94 with `py` +3.6
      // keeps the hooves on the shadow line (recipe rule 4E:
      // 60 × 0.94 + 3.6 = 60).
      durationMs: 3800,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.94 },
            { t: 0.5, v: 0.91 },
            { t: 1, v: 0.94 },
          ],
          py: [
            { t: 0, v: 3.6 },
            { t: 1, v: 3.6 },
          ],
        },
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 10 },
            { t: 1, v: 10 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.25 },
            { t: 1, v: 0.25 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.4 },
            { t: 1, v: -0.4 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
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
            { t: 0, v: -0.35 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          partId: 'hindHoof',
          rot: [
            { t: 0, v: 0.15 },
            { t: 1, v: 0.15 },
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
            { t: 0, v: -0.2 },
            { t: 1, v: -0.2 },
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
            { t: 0, v: -0.18 },
            { t: 1, v: -0.18 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.1 },
            { t: 1, v: -0.1 },
          ],
        },
      ],
    },
    eat: {
      // Grazing: the neck swings down as far as its reach allows (1.45 rad
      // — the yardstick every gentler head gesture in this file is measured
      // against), the muzzle nibbles at the bottom of the swing, the ears
      // sweep back and the forelegs brace forward. The neck deliberately
      // carries a `py` of its own: rotation alone leaves the muzzle high,
      // because a 40 px neck cannot reach a ground line 76 px below its own
      // base without the shoulders dropping too.
      durationMs: 1400,
      tracks: [
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.28, v: 1.45 },
            { t: 0.62, v: 1.45 },
            { t: 0.82, v: 0.5 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.28, v: 8 },
            { t: 0.62, v: 8 },
            { t: 0.82, v: 3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.28, v: -0.2 },
            { t: 0.42, v: -0.05 },
            { t: 0.55, v: -0.2 },
            { t: 0.68, v: -0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.24 },
            { t: 0.62, v: -0.24 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.3 },
            { t: 0.62, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'foreUpper',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.14 },
            { t: 0.62, v: -0.14 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.3 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A greeting: the neck lifts, the head turns up and across, the ears
      // semaphore, and the tail gives one soft sweep.
      durationMs: 1100,
      tracks: [
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.32, v: -0.16 },
            { t: 0.66, v: 0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.25 },
            { t: 0.6, v: 0.15 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.32 },
            { t: 0.5, v: 0 },
            { t: 0.72, v: 0.26 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.22 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching food home: the same trot as `walk`, shared verbatim, with
      // the neck carried low over the morsel the whole way (M9 task 5's
      // "deer head-low carry").
      durationMs: 686,
      tracks: [
        ...TROT_TRACKS,
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0.35 },
            { t: 0.5, v: 0.4 },
            { t: 1, v: 0.35 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.1 },
            { t: 0.5, v: 0.14 },
            { t: 1, v: 0.1 },
          ],
        },
      ],
    },
    sit: {
      // Settled to brood or to nurse: legs folded under, body down. `sy`
      // 0.85 with `py` +9 lands the hooves back on the shadow line —
      // 60 × 0.85 + 9 = 60 (recipe rule 4E; the old rig used +3 here and
      // sank every foot 6 px through the ground).
      durationMs: 1000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 9 },
            { t: 1, v: 9 },
          ],
        },
        {
          partId: 'hindThigh',
          rot: [
            { t: 0, v: 0.42 },
            { t: 1, v: 0.42 },
          ],
        },
        {
          partId: 'hindShank',
          rot: [
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'hindHoof',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          partId: 'hindFar',
          rot: [
            { t: 0, v: 0.38 },
            { t: 1, v: 0.38 },
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
            { t: 0, v: 0.7 },
            { t: 1, v: 0.7 },
          ],
        },
        {
          partId: 'foreFar',
          rot: [
            { t: 0, v: -0.28 },
            { t: 1, v: -0.28 },
          ],
        },
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0.15 },
            { t: 1, v: 0.15 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.14 },
            { t: 1, v: -0.14 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.18 },
            { t: 1, v: -0.18 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: the neck lowers
      // toward a ground-level meeting point — a gentle lean, well short of
      // 'eat''s full 1.45 rad graze — and holds while the fawn arrives
      // (M12 task 2).
      //
      // M12 task 7 kept the `neck` track byte-for-byte: `neck` still exists
      // and still plays the neck's role, so the gesture is literally the one
      // task 2 authored. The head and ear tracks below are additive — they
      // do not change the lean, they just point the doe's attention at the
      // fawn while she holds it.
      durationMs: 1200,
      tracks: [
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.75 },
            { t: 0.65, v: 0.75 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.12 },
            { t: 0.65, v: 0.12 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.2 },
            { t: 0.65, v: 0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.16 },
            { t: 0.65, v: 0.16 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the baby (fawn) during a feeding interaction: the neck
      // stretches up beyond its resting height to meet the parent's lowered
      // head partway — the mirror image of 'feedGive' (M12 task 2). The
      // `neck` track is likewise unchanged by task 7; the ears tip back and
      // the head reaches, which is what a hungry fawn does.
      durationMs: 1100,
      tracks: [
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.45 },
            { t: 0.65, v: -0.45 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.15 },
            { t: 0.65, v: -0.15 },
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
      ],
    },
  },
};
