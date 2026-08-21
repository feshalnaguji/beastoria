/**
 * The American robin rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M12 task 7). This is
 * also the template the rest of the valley's songbirds inherit in M13, so the
 * bird-specific decisions below (bird leg = tarsus + toes, head-stabilised
 * hop, folded-wing paint order) are written to be copied.
 *
 * Side view facing +x. The `body` part's origin sits at the middle of the
 * torso; the ground line is y = +2 in ROOT space (where `shadow` sits), which
 * is y = +20 in BODY space, and both feet land on it.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: a `path` body — a plump thrush egg tilted so the deepest
 *   mass sits high and FORWARD at the chest and tapers back to a long
 *   squared tail. 8 px of daylight under the belly carries visible legs,
 *   because a songbird that appears to sit on the grass reads as a duck.
 *   Blacked out, that upright chest-forward posture over two thin legs and a
 *   long straight tail is a thrush and not an owl.
 * - MARKINGS (the naming set): PRIMARY is the brick-orange breast — the
 *   mark the bird is literally named for, the largest and highest-contrast
 *   patch on it, and the one thing that still separates it from every other
 *   small bird at a baked ~30 px T1 sprite. Secondaries — the white broken
 *   eye ring, the blackish crown against the warmer back, the streaked white
 *   throat, the white lower belly and the white outer tail corners — are
 *   real robin field marks that only pay off at T2.
 * - SHADING: three tones (BACK / BACK_DARK+BACK_DEEP / BELLY+RIM) layered as
 *   flat-alpha shapes in the recipe's paint order — base, back mantle,
 *   breast, breast rim, pale belly, contact band, rim sliver. No gradient
 *   fill kind exists; `format.ts` is untouched. The off-side leg is a
 *   separate part behind the body in the shade tone.
 * - MOTION: a real HOP — both feet together, no leg cycle, all the drive in
 *   the body arc — with a fast rise, an early apex and a slow settle, so the
 *   arc is asymmetric and the T1 flipbook's t = 0.25 and t = 0.75 frames are
 *   genuinely different poses. The head counter-rotates against the body all
 *   the way through, because a bird stabilises its head and that single
 *   detail is most of what makes a hop read as a bird's hop.
 *
 * Rotation sign, once (recipe rule 4A): Pixi's +rotation is clockwise, so for
 * a part whose mass hangs DOWN from its pivot — the tarsus, the toes — +rot
 * swings the far end REARWARD (-x); for a part whose mass extends FORWARD
 * from its pivot — the bill — +rot tips the tip DOWN. Legs and bill
 * therefore carry different signs for the same visual direction.
 */
import type { CreatureRig, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const BACK = 0x6a6058; // base coat: warm grey-brown mantle
const BACK_DARK = 0x4b443f; // shade: mantle, folded wing, off-side leg
const BACK_DEEP = 0x332e2b; // shade: creases and ground contact, low alpha only
const BELLY = 0xf2ece0; // light: lower belly, throat, tail corners
const RIM = 0xfff6e8; // light: the sunlit sliver along the top edge
// --- markings -------------------------------------------------------------
const BREAST = 0xc8613c; // the brick-orange breast — primary marking
const BREAST_LIGHT = 0xe08a5c; // its lit upper curve
const CROWN = 0x393330; // the blackish head of a male robin
const EYE_RING = 0xf5f2ea;
const EYE = 0x1d1917;
const BEAK = 0xe8b23c;
const BEAK_SHADE = 0xc98f2c;
const BEAK_TIP = 0x6a5326;
const LEG = 0x8a6f4d;
const LEG_LIGHT = 0xc0a37a;
const LEG_DARK = 0x5f4c34;
const BERRY = 0xcf5f52; // the carried morsel, shared with every other rig
const GROUND_SHADE = 0x3d5a2e;

/**
 * The hop (recipe rule 4B). A small bird does not stride: both feet leave
 * and land together, there is no leg cycle at all, and every bit of the
 * motion lives in the body's arc. t = 0 is touchdown.
 *
 *   0.00  landing, legs straight under the weight
 *   0.10  the crouch — legs compress, body dips
 *   0.20  push-off, body already rising and pitching forward
 *   0.45  apex, feet tucked up under the tail
 *   0.60  the float begins to give
 *   0.80  legs swing forward and the toes splay for the landing
 *   1.00  touchdown again
 *
 * The rise is fast and the settle slow on purpose: a symmetric three-key arc
 * samples identically at t = 0.25 and t = 0.75, and those are two of the six
 * frames `RigBaker` bakes for T1 (the M9 pixel-twin bug the recipe forbids
 * reintroducing). Spot check: `body.py` reads −6.0 at t = 0.25 and −4.5 at
 * t = 0.75, and `legF` reads −0.5 against +0.13.
 *
 * `head` is deliberately NOT here — `walk` and `carry` each add their own
 * (carry holds the bill low and full the whole way).
 */
const HOP_TRACKS: Track[] = [
  {
    partId: 'body',
    py: [
      { t: 0, v: 0 },
      { t: 0.1, v: 2 },
      { t: 0.2, v: -5 },
      { t: 0.45, v: -10 },
      { t: 0.6, v: -9 },
      { t: 0.8, v: -3 },
      { t: 0.92, v: 1 },
      { t: 1, v: 0 },
    ],
    rot: [
      { t: 0, v: 0.05 },
      { t: 0.2, v: -0.18 },
      { t: 0.45, v: -0.1 },
      { t: 0.7, v: 0.08 },
      { t: 0.9, v: 0.12 },
      { t: 1, v: 0.05 },
    ],
  },
  {
    // Both legs together — that IS the hop. The near one leads by a frame.
    partId: 'legF',
    rot: [
      { t: 0, v: 0.2 },
      { t: 0.12, v: 0.35 },
      { t: 0.25, v: -0.5 },
      { t: 0.45, v: -0.7 },
      { t: 0.62, v: -0.45 },
      { t: 0.8, v: 0.05 },
      { t: 0.92, v: 0.3 },
      { t: 1, v: 0.2 },
    ],
  },
  {
    // The toes curl closed at the tuck and splay open for the landing — a
    // curve of a different SHAPE from the tarsus's, not a copy or a
    // negation of it (recipe rule 4A's articulation test).
    partId: 'footF',
    rot: [
      { t: 0, v: -0.1 },
      { t: 0.12, v: -0.35 },
      { t: 0.3, v: 0.5 },
      { t: 0.5, v: 0.55 },
      { t: 0.7, v: 0.2 },
      { t: 0.85, v: -0.3 },
      { t: 1, v: -0.1 },
    ],
  },
  {
    partId: 'legB',
    rot: [
      { t: 0, v: 0.18 },
      { t: 0.14, v: 0.32 },
      { t: 0.28, v: -0.46 },
      { t: 0.47, v: -0.66 },
      { t: 0.64, v: -0.42 },
      { t: 0.82, v: 0.04 },
      { t: 0.93, v: 0.28 },
      { t: 1, v: 0.18 },
    ],
  },
  {
    partId: 'footB',
    rot: [
      { t: 0, v: -0.08 },
      { t: 0.14, v: -0.32 },
      { t: 0.32, v: 0.46 },
      { t: 0.52, v: 0.5 },
      { t: 0.72, v: 0.18 },
      { t: 0.87, v: -0.28 },
      { t: 1, v: -0.08 },
    ],
  },
  {
    // The tail pumps down at take-off and up on landing — a thrush's tail
    // is a counterweight, never dead weight.
    partId: 'tail',
    rot: [
      { t: 0, v: 0.1 },
      { t: 0.25, v: -0.12 },
      { t: 0.5, v: -0.05 },
      { t: 0.75, v: 0.14 },
      { t: 1, v: 0.1 },
    ],
  },
  {
    partId: 'wing',
    rot: [
      { t: 0, v: 0.04 },
      { t: 0.2, v: -0.14 },
      { t: 0.5, v: -0.2 },
      { t: 0.8, v: 0 },
      { t: 1, v: 0.04 },
    ],
  },
];

export const robinRig: CreatureRig = {
  species: 'robin',
  // Honest stride (recipe rule 4C). The old rig claimed 16 px per hop, which
  // against the robin's sim speed of 8/tick × 10 ticks/s = 80 px/s worked out
  // at 80/16 = 5.0 hops per second — well OUTSIDE the 2.5–4.0 band for a
  // hopping small bird, and the reason ground-moving robins read as
  // vibrating rather than hopping. 26 px per hop gives 80/26 = 3.08 hops per
  // second, mid-band, and reads as the long bounding hop a robin actually
  // uses to cross open lawn. `walk`'s 325 ms duration is 26 / 0.08 px-per-ms
  // (rule 4D), which is the same 3.08 Hz stated the other way round — so the
  // renderer's playback-rate multiplier sits at ≈ 1.0 while cruising.
  strideLength: 26,
  parts: [
    {
      // Two ellipses, not one: a wide soft pool plus a tighter darker core
      // right under the feet.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 17, ry: 5, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: 1, y: 0.4, rx: 9, ry: 3, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The torso: chest-forward and deepest at x ≈ +12, tapering back to
      // the tail base. Belly line at y = +13 with the ground at +20, so
      // there is real leg showing under the bird.
      // Paint order per recipe rule 3: base, back mantle, breast, breast
      // rim, pale belly, contact band, rim sliver.
      id: 'body',
      parent: null,
      x: 0,
      y: -18,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -17 -1 Q -17 -10 -6 -14 Q 6 -17 15 -12 Q 20 -9 20 -2 Q 20 5 13 9 Q 3 13 -7 10 Q -15 7 -17 -1 Z',
          fill: { color: BACK },
        },
        {
          kind: 'path',
          d: 'M -16 -3 Q -16 -10 -6 -14 Q 6 -17 15 -12 Q 18.5 -10 19.5 -5 Q 12 -11 2 -12 Q -8 -12 -14 -5 Z',
          fill: { color: BACK_DARK, alpha: 0.55 },
        },
        {
          // PRIMARY MARKING: the brick-orange breast, wrapping the whole
          // front and underside from throat to flank. Deliberately the
          // largest single patch in the rig — at T1 the bird is a grey-brown
          // back over an orange front and nothing else needs to read.
          kind: 'path',
          d: 'M 19 -6 Q 21 3 15 9 Q 6 14 -4 11 Q -6 4 0 -2 Q 8 -10 19 -6 Z',
          fill: { color: BREAST },
        },
        {
          kind: 'path',
          d: 'M 18 -6 Q 21 -2 20 2 Q 19 -4 14 -6 Q 8 -8 2 -4 Q 8 -9 18 -6 Z',
          fill: { color: BREAST_LIGHT, alpha: 0.6 },
        },
        {
          // SECONDARY MARKING: the white lower belly and undertail — the
          // mark that stops the orange running all the way to the vent, and
          // the countershading tone at the same time.
          kind: 'path',
          d: 'M -8 8 Q 0 12 9 10 Q 12 9 14 7 Q 8 14 -2 13 Q -8 12 -8 8 Z',
          fill: { color: BELLY, alpha: 0.85 },
        },
        {
          kind: 'path',
          d: 'M -12 7 Q -2 12 8 11 Q 15 9 19 3 Q 18 8 12 11 Q 2 15 -6 12 Q -11 10 -12 7 Z',
          fill: { color: BACK_DEEP, alpha: 0.18 },
        },
        {
          kind: 'path',
          d: 'M -16 -4 Q -16 -10 -6 -14 Q 6 -17 15 -12 Q 18 -10 19 -6 Q 12 -13 2 -14 Q -8 -14 -14 -6 Z',
          fill: { color: RIM, alpha: 0.35 },
        },
      ],
    },
    {
      // The tail: long, straight and squared off, angled down and back.
      // SECONDARY MARKING: the white outer corner — a genuine robin field
      // mark, and the thing that makes the tail read as feathers with tips
      // rather than a dark paddle.
      id: 'tail',
      parent: 'body',
      x: -15,
      y: -1,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 -5 Q -8 -6 -16 -2 Q -19 1 -18 4 Q -10 7 -2 5 Q 2 2 2 -2 Z', fill: { color: BACK_DARK } },
        { kind: 'path', d: 'M -16 -1 Q -10 -3 -2 -2 Q -10 1 -17 2 Z', fill: { color: BACK_DEEP, alpha: 0.45 } },
        { kind: 'ellipse', x: -16.5, y: 3, rx: 3, ry: 1.6, fill: { color: BELLY, alpha: 0.9 } },
      ],
    },
    {
      // The folded wing, lying along the flank with its tip reaching back
      // over the tail base. Two hinted primary shafts are all the feather
      // detail a 30 px bird can carry, and they are invisible at T1 by
      // design — that is what makes zooming to T2 feel different.
      id: 'wing',
      parent: 'body',
      x: -2,
      y: -4,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 6 -6 Q -2 -9 -10 -4 Q -16 2 -14 7 Q -8 10 0 6 Q 6 2 8 -2 Z', fill: { color: BACK_DARK } },
        { kind: 'path', d: 'M -13 6 Q -7 9 0 6 Q -6 10 -12 8 Z', fill: { color: BACK_DEEP, alpha: 0.4 } },
        {
          kind: 'path',
          d: 'M 6 -6 Q -2 -9 -10 -4 Q -13 -1 -13.5 1 Q -8 -5 0 -6.5 Q 4 -7 6 -6 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
        { kind: 'line', x1: -4, y1: 4, x2: -14, y2: 7, width: 0.9, fill: { color: BACK_DEEP, alpha: 0.5 } },
        { kind: 'line', x1: -2, y1: 1, x2: -13, y2: 4, width: 0.9, fill: { color: BACK_DEEP, alpha: 0.4 } },
      ],
    },
    {
      // Off-side leg, entirely in the shade tone and behind the body — the
      // cheapest depth in the rig.
      id: 'legB',
      parent: 'body',
      x: -3,
      y: 11,
      z: -2,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: -0.6, y2: 8, width: 2.2, fill: { color: LEG_DARK } },
        { kind: 'line', x1: -0.1, y1: 1.5, x2: -0.5, y2: 6, width: 0.9, fill: { color: LEG, alpha: 0.5 } },
      ],
    },
    {
      id: 'footB',
      parent: 'legB',
      x: -0.6,
      y: 8,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 4.5, y2: 1.4, width: 1.5, fill: { color: LEG_DARK } },
        { kind: 'line', x1: 0, y1: 0, x2: -3.2, y2: 1.6, width: 1.3, fill: { color: LEG_DARK } },
      ],
    },
    {
      // A bird's visible leg is the TARSUS, and the toes are a separate
      // joint below it — two parts, not one stick, which is what lets the
      // foot splay for a landing while the shin is still swinging.
      id: 'legF',
      parent: 'body',
      x: 4,
      y: 11,
      z: 2,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 0.5, y2: 8, width: 2.3, fill: { color: LEG } },
        { kind: 'line', x1: 0.2, y1: 1.5, x2: 0.6, y2: 6, width: 1, fill: { color: LEG_LIGHT, alpha: 0.6 } },
      ],
    },
    {
      id: 'footF',
      parent: 'legF',
      x: 0.5,
      y: 8,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 5, y2: 1.4, width: 1.6, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: 3.4, y2: 2.8, width: 1.4, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: -3.4, y2: 1.8, width: 1.4, fill: { color: LEG_DARK } },
      ],
    },
    {
      // The head is its own mass with a real nape break from the body, so
      // the crown can carry its own darker tone. Kept as `head` so M12
      // task 2's feedGive/feedTake tracks land on the same part playing the
      // same role.
      id: 'head',
      parent: 'body',
      x: 13,
      y: -11,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -9 3 Q -11 -5 -5 -9 Q 3 -12 8 -7 Q 11 -3 9 3 Q 5 8 -1 8 Q -7 8 -9 3 Z',
          fill: { color: BACK },
        },
        {
          // SECONDARY MARKING: the blackish crown and nape a male robin
          // carries against its warmer back.
          kind: 'path',
          d: 'M -9 1 Q -11 -5 -5 -9 Q 3 -12 8 -7 Q 10 -5 10 -2 Q 5 -8 -1 -8 Q -7 -7 -9 1 Z',
          fill: { color: CROWN, alpha: 0.8 },
        },
        // SECONDARY MARKING: the streaked white throat.
        { kind: 'ellipse', x: -1, y: 6, rx: 5, ry: 2.4, fill: { color: BELLY, alpha: 0.75 } },
        // SECONDARY MARKING: the white eye ring — the single thing that
        // makes the eye read as an eye rather than a dot once you reach T2.
        { kind: 'ellipse', x: 3.5, y: -2.5, rx: 3.4, ry: 3, fill: { color: EYE_RING, alpha: 0.85 } },
        { kind: 'circle', x: 3.5, y: -2.5, r: 2, fill: { color: EYE } },
        { kind: 'circle', x: 4.4, y: -3.4, r: 0.7, fill: { color: 0xffffff, alpha: 0.85 } },
        {
          kind: 'path',
          d: 'M -9 0 Q -10.5 -5.5 -5 -9 Q 3 -12 8 -7 Q 9.5 -5.5 10 -4 Q 4 -10 -1 -10 Q -7 -9 -9 0 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // Two mandibles rather than one wedge, so the bill can GAPE: the
      // 'feedTake' clip scales this part vertically and the halves part
      // company, which is what a begging chick actually does.
      id: 'beak',
      parent: 'head',
      x: 8,
      y: -1,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M 0 -2.4 L 9.5 0 L 0 0.2 Z', fill: { color: BEAK } },
        { kind: 'path', d: 'M 0 0.6 L 9 0.4 L 0 2.6 Z', fill: { color: BEAK_SHADE } },
        { kind: 'path', d: 'M 6 -0.6 L 9.5 0 L 6 0.9 Z', fill: { color: BEAK_TIP } },
      ],
    },
    {
      // A morsel carried home to the chicks (M9 task 5). The robin's
      // feedMode is 'carry' (sim/species.ts), so — unlike every nurse-mode
      // rig in the valley — 'feedGive' is deliberately ABSENT from this
      // list: that clip IS the delivery hold, the moment the parent offers
      // the morsel, and hiding the morsel through it would delete the whole
      // point of the beat. 'feedTake' stays hidden because that clip is
      // played by the BABY, and the baby is never the one holding food.
      id: 'food',
      parent: 'beak',
      x: 9,
      y: 0.2,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.1, fill: { color: BERRY } },
        { kind: 'ellipse', x: -0.7, y: -0.7, rx: 1, ry: 0.8, fill: { color: 0xffffff, alpha: 0.5 } },
      ],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'flap', 'sit', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A nestling is a big head and an enormous gape on a stub of a tail —
      // and per recipe rule 4F the load-bearing leg chain is left alone so
      // the toes stay on the shadow line.
      scale: 0.55,
      partScale: {
        head: { x: 1.32, y: 1.32 },
        beak: { x: 1.25, y: 1.3 }, // gape-y chick bill
        tail: { x: 0.5, y: 0.8 }, // stubby chick tail
        wing: { x: 0.7, y: 0.75 },
      },
      tint: 0xd8c9a8, // downy brown fluff
    },
    juvenile: { scale: 0.8, partScale: { head: { x: 1.1, y: 1.1 }, tail: { x: 0.85, y: 0.95 } } },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xcdc8c3 },
  },
  clips: {
    idle: {
      // Standing, never quite still: the tail flicks, the whole head cocks
      // to listen for worms (the most robin thing a robin does), and the
      // body breathes.
      durationMs: 1900,
      tracks: [
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.48, v: 0.35 },
            { t: 0.58, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.2, v: -0.12 },
            { t: 0.35, v: 0.08 },
            { t: 0.5, v: 0 },
            { t: 0.66, v: -0.3 },
            { t: 0.78, v: -0.3 },
            { t: 0.88, v: 0 },
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
            { t: 0.3, v: -0.08 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // See HOP_TRACKS above: robins hop. 325 ms is strideLength / speed, so
      // the playback-rate multiplier sits at ≈ 1.0 while cruising.
      durationMs: 325,
      tracks: [
        ...HOP_TRACKS,
        {
          // The head counter-rotates against the body's pitch through the
          // whole arc — a bird holds its head still and lets its body move
          // underneath it, and that is most of what makes this read as a
          // bird rather than a bouncing ball.
          partId: 'head',
          rot: [
            { t: 0, v: -0.05 },
            { t: 0.2, v: 0.16 },
            { t: 0.45, v: 0.1 },
            { t: 0.7, v: -0.08 },
            { t: 0.9, v: -0.12 },
            { t: 1, v: -0.05 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.45, v: 3 },
            { t: 0.8, v: 1 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    sleep: {
      // Roosting: the bill is tucked back into the shoulder feathers, the
      // legs bend, and the whole bird puffs and settles. `sy` 0.94 with
      // `py` +1.2 keeps the toes on the shadow line (recipe rule 4E:
      // 20 × 0.94 + 1.2 = 20).
      durationMs: 3400,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.6 },
            { t: 1, v: -0.6 },
          ],
          px: [
            { t: 0, v: -4 },
            { t: 1, v: -4 },
          ],
          py: [
            { t: 0, v: 3 },
            { t: 1, v: 3 },
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
            { t: 0, v: 1.2 },
            { t: 1, v: 1.2 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0.12 },
            { t: 1, v: 0.12 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.18 },
            { t: 1, v: 0.18 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.16 },
            { t: 1, v: 0.16 },
          ],
        },
        {
          partId: 'footF',
          rot: [
            { t: 0, v: -0.18 },
            { t: 1, v: -0.18 },
          ],
        },
        {
          partId: 'footB',
          rot: [
            { t: 0, v: -0.16 },
            { t: 1, v: -0.16 },
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
      // Peck-peck: two quick jabs of the whole head, the bill opening on
      // each one, the body tipping over the food and the tail rising as a
      // counterweight. This is the yardstick 'feedGive' is measured against
      // — its single held dip is deliberately gentler than this.
      durationMs: 560,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.75 },
            { t: 0.45, v: 0.75 },
            { t: 0.6, v: 0 },
            { t: 0.75, v: 0.4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'beak',
          sy: [
            { t: 0, v: 1 },
            { t: 0.28, v: 1.35 },
            { t: 0.42, v: 1 },
            { t: 0.74, v: 1.25 },
            { t: 0.86, v: 1 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.15 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.22 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A greeting: two wing flicks, a head bob and a tail fan.
      durationMs: 900,
      tracks: [
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.2, v: -0.55 },
            { t: 0.4, v: 0 },
            { t: 0.6, v: -0.55 },
            { t: 0.8, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.28, v: -0.2 },
            { t: 0.55, v: 0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.24 },
            { t: 0.55, v: -0.06 },
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
      ],
    },
    flap: {
      // Calm wing-beat locomotion (M9 task 4) — not a frantic flutter. The
      // legs trail back and the toes close, which is what a bird in level
      // flight actually does with them.
      durationMs: 420,
      tracks: [
        {
          partId: 'wing',
          rot: [
            { t: 0, v: -0.9 },
            { t: 0.5, v: 0.25 },
            { t: 1, v: -0.9 },
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
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'footB',
          rot: [
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.06 },
            { t: 0.5, v: 0.1 },
            { t: 1, v: -0.06 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -2 },
            { t: 1, v: 0 },
          ],
          rot: [
            { t: 0, v: -0.08 },
            { t: 0.5, v: -0.02 },
            { t: 1, v: -0.08 },
          ],
        },
      ],
    },
    carry: {
      // Fetching food home: the same hop as `walk`, shared verbatim, with
      // the bill held low and full (M9 task 5).
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
      // Settled onto the eggs: the body squashes down over them, the legs
      // fold away underneath and the tail lifts clear of the nest rim.
      // `sy` 0.85 with `py` +3 lands the toes back on the shadow line —
      // 20 × 0.85 + 3 = 20 (recipe rule 4E).
      durationMs: 1000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 1, v: 0.85 },
          ],
          py: [
            { t: 0, v: 3 },
            { t: 1, v: 3 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.5 },
            { t: 1, v: 0.5 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.46 },
            { t: 1, v: 0.46 },
          ],
        },
        {
          partId: 'footF',
          rot: [
            { t: 0, v: -0.45 },
            { t: 1, v: -0.45 },
          ],
        },
        {
          partId: 'footB',
          rot: [
            { t: 0, v: -0.42 },
            { t: 1, v: -0.42 },
          ],
        },
        {
          partId: 'tail',
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
        },
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: the head/beak
      // lowers toward a ground-level meeting point — a single gentle dip
      // and hold, unlike 'eat''s quick repeated peck-peck (M12 task 2).
      //
      // M12 task 7 kept the `head` track byte-for-byte: `head` still exists
      // and still plays the head's role, so the gesture is literally the one
      // task 2 authored. The tracks below are additive — the bill parts
      // slightly (she is holding a morsel out, not swallowing it), the body
      // tips over the chick, and the tail counterweights. And because the
      // robin is a CARRY-mode species, `food` stays visible right through
      // this clip: it is the morsel changing hands.
      durationMs: 700,
      tracks: [
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
      // Played by the baby (chick) during a feeding interaction: the head
      // stretches/gapes up to meet the parent's beak partway — the mirror
      // image of 'feedGive' (M12 task 2). The `head` track is likewise
      // unchanged by task 7; the bill now really opens (a 1.9× vertical
      // scale on the two-mandible `beak` part) because an open gape is the
      // whole visual of a chick being fed, and the wings quiver the way a
      // begging nestling's do.
      durationMs: 650,
      tracks: [
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
            { t: 0.3, v: 1.9 },
            { t: 0.7, v: 1.9 },
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
