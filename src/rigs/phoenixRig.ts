/**
 * The phoenix rig — built to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14).
 *
 * Side view facing +x. The `body` part's origin sits at the middle of the
 * slender torso; the ground line is y = +2 in ROOT space (where `shadow` sits),
 * which is y = +34 in BODY space, and both sets of toes land on it.
 *
 * PRIMARY MARKING: the long flame-gradient trailing tail — three tapered
 * streamers running red at the root, through orange, to gold at the tip, each
 * ending in an ember eye-spot. It is the single largest, longest, warmest mass
 * on the animal (the tail is about twice the body's length), so it names the
 * phoenix at a baked ~30 px T1 sprite. Nearest confusable is the robin (also a
 * small warm bird); the tail length and the tall neck are what separate them.
 * SECONDARY MARKS (T2 only): the crest of three eye-tipped plumes, the golden
 * eye ring, the ember-tipped flight feathers of the wing, and the soft low-alpha
 * flame glow behind the body.
 *
 * The four recipe dimensions, as built here:
 *
 * - SILHOUETTE: pheasant/crane proportions — a slender horizontal torso, a long
 *   S-curved neck carrying a small head and a three-plume crest, tall two-joint
 *   legs, and a tail longer than the body. Blacked out that is a tall bird
 *   with a swept-back rope of tail: not a robin, not a duck.
 * - MARKINGS: see above.
 * - SHADING: GOLD base / FLAME+RED shade / GOLD_LIGHT+EMBER light, as flat-alpha
 *   shapes in the recipe's paint order. The far wing, far leg and far streamer
 *   are separate parts behind the body, wholly in the shade tone. Light is only
 *   ever a sliver along an upper or front edge.
 * - MOTION: graceful and slow. The tail is a chain — `tail` carries three
 *   `streamA/B/C` children, each phase-lagged so the streamers sway with lag
 *   rather than in lockstep. The walk is a stately pheasant stride with a head
 *   bob; the flap is a deep, slow beat whose wings spread to ~1.5x their folded
 *   length at the top of the stroke.
 *
 * Rotation sign, once (recipe rule 4A): Pixi's +rotation is clockwise, so for
 * a part whose mass hangs DOWN from its pivot — the legs, shins — +rot swings
 * the far end REARWARD (-x); for a part whose mass rises UP from its pivot —
 * the neck, the crest — +rot swings the tip FORWARD (+x); for a part whose mass
 * points REARWARD (-x) from its pivot — the wings and the tail streamers —
 * +rot lifts the tip UP (and 1.5 is straight up). The head's beak points +x,
 * so +rot tips the beak DOWN.
 */
import type { CreatureRig, Keyframe, Track } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const GOLD = 0xe8a84c; // base coat
const GOLD_HEAD = 0xf0b656;
const GOLD_LIGHT = 0xf4c56a; // light: breast, throat, streamer tips
const FLAME = 0xd96b35; // shade: mantle, wing
const ORANGE = 0xee8f35; // mid: streamers
const RED = 0xc4472b; // shade: streamer roots
const DEEP = 0x9b3a22; // deep shade: far side, eye-spot rings
const EMBER = 0xf4d03f; // light: eye-spots, flight-feather tips
const RIM = 0xffe9b0; // sunlit sliver along the top edge
const LEG = 0xc98a3c;
const LEG_DARK = 0x9a6528;
const BEAK = 0xc9822f;
const BEAK_TIP = 0x8a5420;
const EYE_RING = 0xffd84a; // the golden eye ring
const EYE = 0x3a2210;
const GROUND_SHADE = 0x3d5a2e;
const GLOW = 0xffb36b;

const kf = (...p: [number, number][]): Keyframe[] => p.map(([t, v]) => ({ t, v }));
const f = (n: number): string => n.toFixed(1);

/**
 * A tapered leaf (wedge with a rounded belly and a pointed tip) from (x0,y0) to
 * (x1,y1): half-width `a` at the root, about `hw` at the belly (which sits
 * `bulge` of the way along), a point at the tip. Streamers and crest plumes are
 * leaves, never lines.
 */
function leaf(x0: number, y0: number, x1: number, y1: number, hw: number, a: number, bulge = 0.72): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const cx = x0 + dx * bulge;
  const cy = y0 + dy * bulge;
  return (
    `M ${f(x0 - nx * a)} ${f(y0 - ny * a)} ` +
    `Q ${f(cx - nx * 2 * hw)} ${f(cy - ny * 2 * hw)} ${f(x1)} ${f(y1)} ` +
    `Q ${f(cx + nx * 2 * hw)} ${f(cy + ny * 2 * hw)} ${f(x0 + nx * a)} ${f(y0 + ny * a)} Z`
  );
}

/** A flame-gradient streamer in streamer space: root at the origin, tip at (tx, ty). */
function streamerShapes(tx: number, ty: number, hw: number, far: boolean) {
  const sx = tx * 0.86;
  const sy = ty * 0.86;
  const shapes = [
    { kind: 'path' as const, d: leaf(0, 0, tx, ty, hw, 4), fill: { color: far ? DEEP : RED, alpha: far ? 0.9 : 1 } },
    {
      kind: 'path' as const,
      d: leaf(tx * 0.3, ty * 0.3, tx * 0.96, ty * 0.96, hw * 0.62, 1.8),
      fill: { color: far ? FLAME : ORANGE, alpha: far ? 0.85 : 0.95 },
    },
  ];
  if (!far) {
    shapes.push({
      kind: 'path' as const,
      d: leaf(tx * 0.6, ty * 0.6, tx * 0.97, ty * 0.97, hw * 0.36, 1),
      fill: { color: GOLD_LIGHT, alpha: 0.9 },
    });
  }
  return [
    ...shapes,
    // The eye-spot: a dark ring round an ember centre.
    { kind: 'circle' as const, x: sx, y: sy, r: 3, fill: { color: DEEP, alpha: 0.9 } },
    { kind: 'circle' as const, x: sx, y: sy, r: 1.8, fill: { color: EMBER, alpha: far ? 0.8 : 1 } },
  ];
}

const WING_D =
  'M 4 -3 Q -6 -9 -20 -7 Q -30 -5 -33 1 L -29 3 L -31 6 L -26 7 L -26 10 Q -12 12 0 7 Z';

/**
 * The stately pheasant stride (recipe rule 4B): diagonal-free alternation, the
 * knee flexing on the forward swing (a different curve from the thigh's — rule
 * 4A's articulation test), a double body bob per cycle. Cadence: speed 7 → 70
 * px/s over a 42 px stride = 1.67 strides/s; `walk` is 42 / 0.07 = 600 ms.
 */
const STRIDE_TRACKS: Track[] = [
  { partId: 'legF', rot: kf([0, -0.34], [0.25, -0.08], [0.5, 0.34], [0.72, 0.1], [1, -0.34]) },
  { partId: 'shinF', rot: kf([0, 0.05], [0.25, 0], [0.5, 0.1], [0.7, 0.75], [0.88, 0.3], [1, 0.05]) },
  { partId: 'footF', rot: kf([0, -0.15], [0.25, 0.1], [0.5, 0.35], [0.7, 0.5], [0.9, -0.1], [1, -0.15]) },
  { partId: 'legB', rot: kf([0, 0.34], [0.25, 0.1], [0.5, -0.34], [0.75, -0.08], [1, 0.34]) },
  { partId: 'shinB', rot: kf([0, 0.1], [0.2, 0.75], [0.38, 0.3], [0.5, 0.05], [0.75, 0], [1, 0.1]) },
  { partId: 'footB', rot: kf([0, 0.35], [0.2, 0.5], [0.4, -0.1], [0.5, -0.15], [0.75, 0.1], [1, 0.35]) },
  { partId: 'body', py: kf([0, 0], [0.25, -2.2], [0.5, 0], [0.75, -1.6], [1, 0]) },
  { partId: 'tail', rot: kf([0, 0.04], [0.3, -0.05], [0.65, 0.05], [1, 0.04]) },
  { partId: 'streamA', rot: kf([0, 0.1], [0.3, -0.12], [0.6, 0.1], [0.85, -0.05], [1, 0.1]) },
  { partId: 'streamB', rot: kf([0, -0.08], [0.35, 0.12], [0.7, -0.1], [1, -0.08]) },
  { partId: 'streamC', rot: kf([0, 0.12], [0.4, -0.08], [0.75, 0.1], [1, 0.12]) },
  { partId: 'wing', rot: kf([0, 0.02], [0.35, -0.05], [0.8, 0.04], [1, 0.02]) },
];

export const phoenixRig: CreatureRig = {
  species: 'phoenix',
  strideLength: 42,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 28, ry: 6.5, fill: { color: GROUND_SHADE, alpha: 0.16 } },
        { kind: 'ellipse', x: 2, y: 0.4, rx: 16, ry: 3.4, fill: { color: GLOW, alpha: 0.2 } }, // warm glow, not shade
      ],
    },
    {
      // The slender torso: widest at the breast, tapering to the rump.
      id: 'body',
      parent: null,
      x: 0,
      y: -34,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -19 -1 Q -18 -10 -4 -11 Q 10 -12 16 -5 Q 21 3 13 9 Q 2 14 -11 10 Q -20 6 -19 -1 Z',
          fill: { color: GOLD },
        },
        {
          // The darker back mantle.
          kind: 'path',
          d: 'M -19 -1 Q -18 -10 -4 -11 Q 4 -12 8 -9 Q 0 -6 -8 0 Q -12 6 -11 10 Q -20 6 -19 -1 Z',
          fill: { color: FLAME, alpha: 0.55 },
        },
        {
          // Countershaded light breast.
          kind: 'path',
          d: 'M 16 -5 Q 21 3 13 9 Q 5 11 0 9 Q 8 4 9 -4 Q 12 -7 16 -5 Z',
          fill: { color: GOLD_LIGHT },
        },
        {
          // Ground-contact band hugging the underside.
          kind: 'path',
          d: 'M -9 9 Q 2 13 12 9 Q 4 11.5 -2 11.5 Q -7 11 -9 9 Z',
          fill: { color: DEEP, alpha: 0.25 },
        },
        {
          // Sunlit sliver along the back edge.
          kind: 'path',
          d: 'M -19 -1 Q -18 -10 -4 -11 Q -12 -9 -16 -2 Z',
          fill: { color: RIM, alpha: 0.3 },
        },
      ],
    },
    {
      // SECONDARY MARKING: the soft flame glow — two low-alpha ellipses,
      // behind the body, never a hard halo.
      id: 'glow',
      parent: 'body',
      x: -4,
      y: -2,
      z: -5,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 44, ry: 27, fill: { color: GLOW, alpha: 0.06 } },
        { kind: 'ellipse', x: 2, y: 0, rx: 30, ry: 19, fill: { color: GLOW, alpha: 0.07 } },
      ],
    },
    {
      // PRIMARY MARKING, the root: the short fan the streamers grow out of.
      id: 'tail',
      parent: 'body',
      x: -15,
      y: -1,
      z: -1,
      shapes: [
        { kind: 'path', d: leaf(2, 0, -26, 5, 5.5, 4.5), fill: { color: RED } },
        { kind: 'path', d: leaf(0, 0, -23, 4.5, 3.4, 2.4), fill: { color: ORANGE, alpha: 0.9 } },
      ],
    },
    // PRIMARY MARKING: the three flame streamers, each a phase-lagged child.
    { id: 'streamC', parent: 'tail', x: -12, y: -3, z: -1, shapes: streamerShapes(-50, -2, 4.4, true) },
    { id: 'streamA', parent: 'tail', x: -14, y: -1, z: 0, shapes: streamerShapes(-62, 9, 5.4, false) },
    { id: 'streamB', parent: 'tail', x: -14, y: 2, z: 1, shapes: streamerShapes(-74, 20, 6, false) },
    {
      // The far wing: shade tone only, peeking behind the body.
      id: 'wingFar',
      parent: 'body',
      x: 1,
      y: -4,
      z: -2,
      shapes: [{ kind: 'path', d: WING_D, fill: { color: DEEP } }],
    },
    {
      // The near wing, folded back along the flank. Mass points rearward.
      id: 'wing',
      parent: 'body',
      x: 5,
      y: -5,
      z: 1,
      shapes: [
        { kind: 'path', d: WING_D, fill: { color: FLAME } },
        { kind: 'path', d: 'M 4 -3 Q -6 -9 -16 -7 Q -8 -2 0 -1 Z', fill: { color: GOLD, alpha: 0.85 } },
        // SECONDARY MARKING: ember-tipped flight feathers.
        { kind: 'path', d: 'M -24 -5 Q -30 -4 -32.5 1 L -29.4 2.8 Q -27 -1 -22 -1.5 Z', fill: { color: EMBER } },
        { kind: 'path', d: 'M -21 3 L -30 5.4 L -26.4 6.9 Q -23 5.5 -20 5 Z', fill: { color: EMBER } },
        { kind: 'path', d: 'M -17 7 L -25 8.6 L -26 9.8 Q -20 10.5 -15 10 Z', fill: { color: EMBER } },
      ],
    },
    {
      // Off-side leg: feathered thigh wholly in shade, behind the body.
      id: 'legB',
      parent: 'body',
      x: -4,
      y: 8,
      z: -2,
      shapes: [{ kind: 'path', d: 'M -4 -3 Q -6 3 -3 11 L 3 11 Q 5 3 4 -3 Z', fill: { color: DEEP } }],
      hideInClips: ['sleep'],
    },
    {
      id: 'shinB',
      parent: 'legB',
      x: 0,
      y: 11,
      z: 0,
      shapes: [{ kind: 'path', d: 'M -1.4 -1 L -1 15 L 1 15 L 1.4 -1 Z', fill: { color: LEG_DARK } }],
    },
    {
      id: 'footB',
      parent: 'shinB',
      x: 0,
      y: 15,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 4.6, y2: 0.8, width: 1.5, fill: { color: LEG_DARK } },
        { kind: 'line', x1: 0, y1: 0, x2: -2.8, y2: 0.8, width: 1.4, fill: { color: LEG_DARK } },
      ],
    },
    {
      // Near leg: a feathered gold thigh over a bare shin.
      id: 'legF',
      parent: 'body',
      x: 5,
      y: 8,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -4 -3 Q -6 3 -3 11 L 3 11 Q 5 3 4 -3 Z', fill: { color: GOLD } },
        { kind: 'path', d: 'M 4 -3 Q 5 3 3 11 L 0.6 11 Q 2.4 3 1.6 -3 Z', fill: { color: GOLD_LIGHT, alpha: 0.7 } },
      ],
      hideInClips: ['sleep'],
    },
    {
      id: 'shinF',
      parent: 'legF',
      x: 0,
      y: 11,
      z: 0,
      shapes: [{ kind: 'path', d: 'M -1.5 -1 L -1.1 15 L 1.1 15 L 1.5 -1 Z', fill: { color: LEG } }],
    },
    {
      id: 'footF',
      parent: 'shinF',
      x: 0,
      y: 15,
      z: 0,
      shapes: [
        { kind: 'line', x1: 0, y1: 0, x2: 5.4, y2: 0.8, width: 1.7, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: 3.8, y2: 1.6, width: 1.5, fill: { color: LEG } },
        { kind: 'line', x1: 0, y1: 0, x2: -3.2, y2: 0.8, width: 1.5, fill: { color: LEG_DARK } },
      ],
    },
    {
      // The long S-curved neck, rising from the breast.
      id: 'neck',
      parent: 'body',
      x: 11,
      y: -4,
      z: 2,
      shapes: [
        {
          kind: 'path',
          d: 'M -6 4 Q -7 -10 -3 -20 Q -2 -25 0 -27 L 6 -26 Q 8 -20 8 -10 Q 9 -2 9 5 Z',
          fill: { color: GOLD },
        },
        {
          // Lit front of the throat.
          kind: 'path',
          d: 'M 9 5 Q 9 -2 8 -10 Q 8 -20 6 -26 Q 3.5 -22 4 -12 Q 5 -4 3 4 Z',
          fill: { color: GOLD_LIGHT, alpha: 0.75 },
        },
      ],
    },
    {
      id: 'head',
      parent: 'neck',
      x: 3,
      y: -27,
      z: 1,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 7.5, ry: 6.2, fill: { color: GOLD_HEAD } },
        { kind: 'path', d: 'M -7.4 0 Q -7 -5 -2 -6 Q -5.5 -2 -5 3.5 Q -7 3 -7.4 0 Z', fill: { color: FLAME, alpha: 0.4 } },
        { kind: 'path', d: 'M -3 -6 Q 3 -7 7 -3.5 Q 2 -5 -3 -4.5 Z', fill: { color: RIM, alpha: 0.4 } },
        // SECONDARY MARKING: the golden eye ring round a dark eye.
        { kind: 'circle', x: 2.2, y: -0.8, r: 3, fill: { color: EYE_RING, alpha: 0.95 } },
        { kind: 'circle', x: 2.6, y: -0.8, r: 1.7, fill: { color: EYE } },
      ],
    },
    {
      // The closed eye: a head-coloured cap over the eye ring with a lash line.
      // Visible only in 'sleep'.
      id: 'lid',
      parent: 'head',
      x: 0,
      y: 0,
      z: 2,
      shapes: [
        { kind: 'circle', x: 2.3, y: -0.8, r: 3.4, fill: { color: GOLD_HEAD } },
        { kind: 'line', x1: -0.4, y1: -0.4, x2: 5, y2: -0.4, width: 0.9, fill: { color: FLAME, alpha: 0.85 } },
      ],
      hideInClips: ['idle', 'walk', 'eat', 'social', 'carry', 'sit', 'flap', 'feedGive', 'feedTake'],
    },
    {
      // SECONDARY MARKING: the crest of three eye-tipped plumes, rooted
      // behind the crown (z -1) so they grow out of the head.
      id: 'crest',
      parent: 'head',
      x: -2,
      y: -4,
      z: -1,
      shapes: [
        { kind: 'path', d: leaf(0, 0, -9, -15, 2.6, 2.4), fill: { color: FLAME } },
        { kind: 'circle', x: -7.6, y: -12.6, r: 1.9, fill: { color: EMBER } },
        { kind: 'path', d: leaf(0, 0, -1, -20, 2.8, 2.4), fill: { color: ORANGE } },
        { kind: 'circle', x: -0.9, y: -16.8, r: 2, fill: { color: EMBER } },
        { kind: 'path', d: leaf(0, 0, 7, -14, 2.5, 2.4), fill: { color: RED } },
        { kind: 'circle', x: 5.9, y: -11.8, r: 1.8, fill: { color: EMBER } },
      ],
    },
    {
      id: 'beak',
      parent: 'head',
      x: 6.5,
      y: 0.8,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -1 -2.4 Q 6 -2 11 1.2 Q 6 3 -1 2.6 Z', fill: { color: BEAK } },
        { kind: 'path', d: 'M 7 -0.6 Q 10 0.3 11 1.2 Q 9 2.2 6.5 2.3 Z', fill: { color: BEAK_TIP } },
      ],
    },
    // A little ember-fruit carried home to the chick. The phoenix's feedMode is
    // 'carry', so 'feedGive' (the delivery hold) is deliberately ABSENT from
    // hideInClips; 'feedTake' is played by the chick, who never holds food.
    {
      id: 'food',
      parent: 'beak',
      x: 11,
      y: 1.6,
      z: 2,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.3, fill: { color: EMBER } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'flap', 'sit', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // An ember chick: big head, a stub of tail, little wings.
      scale: 0.45,
      partScale: {
        head: { x: 1.4, y: 1.4 },
        tail: { x: 0.4, y: 0.6 },
        crest: { x: 0.7, y: 0.7 },
        wing: { x: 0.6, y: 0.65 },
        wingFar: { x: 0.6, y: 0.65 },
      },
      tint: 0xf5d9a8,
    },
    juvenile: {
      scale: 0.75,
      partScale: {
        head: { x: 1.1, y: 1.1 },
        tail: { x: 0.75, y: 0.9 },
        wing: { x: 0.85, y: 0.9 },
        wingFar: { x: 0.85, y: 0.9 },
      },
    },
    adult: { scale: 1 },
    elder: { scale: 1, tint: 0xfff0d0 }, // burning brighter, not fading
  },
  clips: {
    idle: {
      durationMs: 3400, // plumes breathe like slow flame
      tracks: [
        { partId: 'tail', rot: kf([0, 0], [0.3, 0.05], [0.65, -0.04], [1, 0]) },
        { partId: 'streamA', rot: kf([0, 0], [0.25, 0.13], [0.55, -0.1], [0.8, 0.06], [1, 0]) },
        { partId: 'streamB', rot: kf([0, 0.03], [0.35, 0.15], [0.7, -0.12], [1, 0.03]) },
        { partId: 'streamC', rot: kf([0, -0.04], [0.3, 0.07], [0.6, 0.13], [0.9, -0.1], [1, -0.04]) },
        { partId: 'neck', rot: kf([0, 0], [0.4, 0.04], [0.75, -0.03], [1, 0]) },
        { partId: 'head', rot: kf([0, 0], [0.3, -0.08], [0.55, 0.06], [0.8, -0.05], [1, 0]) },
        { partId: 'crest', sy: kf([0, 1], [0.5, 1.12], [1, 1]), rot: kf([0, 0], [0.35, 0.1], [0.8, -0.06], [1, 0]) },
        { partId: 'glow', sx: kf([0, 1], [0.5, 1.06], [1, 1]), sy: kf([0, 1], [0.5, 1.06], [1, 1]) },
        { partId: 'body', sy: kf([0, 1], [0.5, 0.985], [1, 1]) },
        { partId: 'wing', rot: kf([0, 0], [0.45, 0.05], [1, 0]) },
      ],
    },
    walk: {
      durationMs: 600, // 42 / 0.07, rule 4D
      tracks: [
        ...STRIDE_TRACKS,
        // The pheasant head bob: neck and head lag and counter the body.
        { partId: 'neck', rot: kf([0, 0.02], [0.3, 0.1], [0.55, 0], [0.8, 0.07], [1, 0.02]) },
        { partId: 'head', rot: kf([0, -0.03], [0.3, -0.09], [0.55, 0], [0.8, -0.06], [1, -0.03]) },
      ],
    },
    sleep: {
      // A roosting bird: legs hidden, belly settled on the ground line
      // (belly at body y ~12 + py 21 = 33), neck curled back so the head rests
      // on the shoulders with the bill tucked down toward the wing, eye shut,
      // streamers lying low behind, a slow breathing swell.
      durationMs: 4800,
      tracks: [
        { partId: 'body', sy: kf([0, 1], [0.5, 1.03], [1, 1]), py: kf([0, 21], [1, 21]), rot: kf([0, 0.03], [1, 0.03]) },
        // Neck squashed to a stub (sy .2); the head counter-stretches its own x axis
        // (which maps onto the neck's y at rot 1.5) so it stays round, and its
        // rot cancels the neck's: net +0.3, upright, bill tipped gently down.
        { partId: 'neck', rot: kf([0, -1.2], [1, -1.2]), sy: kf([0, 0.2], [1, 0.2]) },
        { partId: 'head', rot: kf([0, 1.5], [1, 1.5]), sx: kf([0, 5], [1, 5]) },
        { partId: 'wing', rot: kf([0, 0.02], [1, 0.02]) },
        { partId: 'crest', rot: kf([0, -1.1], [1, -1.1]), sy: kf([0, 0.55], [1, 0.55]) },
        { partId: 'glow', sx: kf([0, 0.8], [0.5, 0.85], [1, 0.8]), sy: kf([0, 0.8], [0.5, 0.85], [1, 0.8]) },
        { partId: 'tail', rot: kf([0, 0], [0.5, 0.03], [1, 0]) },
        { partId: 'streamA', rot: kf([0, -0.04], [0.5, -0.01], [1, -0.04]) },
        { partId: 'streamB', rot: kf([0, 0.07], [0.5, 0.1], [1, 0.07]) },
        { partId: 'streamC', rot: kf([0, -0.08], [0.5, -0.05], [1, -0.08]) },
      ],
    },
    eat: {
      // A long neck dipped to the ground: neck far forward, head tipped down,
      // two pecks.
      durationMs: 1000,
      tracks: [
        { partId: 'neck', rot: kf([0, 0], [0.25, 1.9], [0.4, 1.7], [0.55, 1.9], [0.8, 0.3], [1, 0]) },
        { partId: 'head', rot: kf([0, 0], [0.25, 0.9], [0.4, 0.7], [0.55, 0.9], [1, 0]) },
        { partId: 'beak', sy: kf([0, 1], [0.25, 1.25], [0.4, 1], [0.55, 1.25], [0.7, 1], [1, 1]) },
        { partId: 'body', rot: kf([0, 0], [0.3, 0.2], [0.7, 0.1], [1, 0]), py: kf([0, 0], [0.3, 1.5], [1, 0]) },
        { partId: 'tail', rot: kf([0, 0], [0.3, 0.14], [1, 0]) },
        { partId: 'streamB', rot: kf([0, 0], [0.45, 0.1], [1, 0]) },
      ],
    },
    social: {
      // A courtly display: wings flare, streamers fan, the crest lifts.
      durationMs: 1400,
      tracks: [
        { partId: 'wing', rot: kf([0, 0.05], [0.25, 0.95], [0.55, 0.8], [0.8, 0.95], [1, 0.05]), sx: kf([0, 1], [0.25, 1.3], [0.8, 1.3], [1, 1]) },
        { partId: 'wingFar', rot: kf([0, 0.05], [0.3, 0.85], [0.6, 0.7], [0.85, 0.85], [1, 0.05]), sx: kf([0, 1], [0.3, 1.25], [0.85, 1.25], [1, 1]) },
        { partId: 'streamA', rot: kf([0, 0], [0.3, 0.4], [0.7, 0.3], [1, 0]) },
        { partId: 'streamB', rot: kf([0, 0], [0.3, -0.25], [0.7, -0.2], [1, 0]) },
        { partId: 'streamC', rot: kf([0, 0], [0.35, 0.5], [0.75, 0.4], [1, 0]) },
        { partId: 'crest', sy: kf([0, 1], [0.3, 1.3], [0.7, 1.25], [1, 1]) },
        { partId: 'neck', rot: kf([0, 0], [0.3, 0.15], [0.7, 0.1], [1, 0]) },
        { partId: 'head', py: kf([0, 0], [0.3, -2], [0.6, 0], [1, 0]) },
        { partId: 'body', py: kf([0, 0], [0.35, -1.5], [1, 0]) },
      ],
    },
    flap: {
      // A deep, slow beat. The wings point rearward at rest, so +rot lifts them:
      // ~1.5 is straight up (top of the stroke, sx 1.55 -> ~56 px each, well over
      // 2x the body between the pair), -0.6 is down. The downstroke
      // (0.2 -> 0.72) is longer than the upstroke, so t = .25 and .75 differ.
      durationMs: 700,
      tracks: [
        {
          partId: 'wing',
          rot: kf([0, 0.6], [0.2, 1.5], [0.5, 0.2], [0.72, -0.6], [1, 0.6]),
          sx: kf([0, 1.35], [0.2, 1.55], [0.72, 1.35], [1, 1.35]),
          sy: kf([0, 1.2], [0.2, 1.3], [0.72, 1.2], [1, 1.2]),
        },
        {
          partId: 'wingFar',
          rot: kf([0, 0.45], [0.25, 1.4], [0.55, 0.1], [0.78, -0.7], [1, 0.45]),
          sx: kf([0, 1.3], [0.25, 1.5], [0.78, 1.3], [1, 1.3]),
          sy: kf([0, 1.15], [0.25, 1.25], [0.78, 1.15], [1, 1.15]),
        },
        // Legs trail rearward, neck and head stretched forward.
        { partId: 'legF', rot: kf([0, 0.95], [1, 0.95]) },
        { partId: 'legB', rot: kf([0, 0.95], [1, 0.95]) },
        { partId: 'shinF', rot: kf([0, 0.2], [1, 0.2]) },
        { partId: 'shinB', rot: kf([0, 0.2], [1, 0.2]) },
        { partId: 'footF', rot: kf([0, 0.3], [1, 0.3]) },
        { partId: 'footB', rot: kf([0, 0.3], [1, 0.3]) },
        { partId: 'neck', rot: kf([0, 1.25], [0.5, 1.32], [1, 1.25]) },
        { partId: 'head', rot: kf([0, -1.2], [0.5, -1.25], [1, -1.2]) },
        { partId: 'body', py: kf([0, 0], [0.45, -3], [1, 0]) },
        { partId: 'tail', rot: kf([0, -0.1], [0.5, 0.05], [1, -0.1]) },
        { partId: 'streamA', rot: kf([0, 0.1], [0.3, -0.12], [0.65, 0.14], [1, 0.1]) },
        { partId: 'streamB', rot: kf([0, -0.1], [0.4, 0.14], [0.8, -0.12], [1, -0.1]) },
        { partId: 'streamC', rot: kf([0, 0.08], [0.35, -0.14], [0.7, 0.12], [1, 0.08]) },
      ],
    },
    carry: {
      // Fetching food home: the same stately stride, neck bowed low the whole
      // way with an ember-fruit held in the beak.
      durationMs: 600,
      tracks: [
        ...STRIDE_TRACKS,
        { partId: 'neck', rot: kf([0, 0.45], [0.3, 0.55], [0.6, 0.45], [0.8, 0.52], [1, 0.45]) },
        { partId: 'head', rot: kf([0, 0.3], [0.3, 0.2], [0.6, 0.3], [1, 0.3]) },
      ],
    },
    sit: {
      // Settled to brood: a gentle squash. 34 * .86 + 4.8 ≈ 34 keeps the toes down.
      durationMs: 3600,
      tracks: [
        { partId: 'body', sy: kf([0, 0.86], [1, 0.86]), py: kf([0, 4.8], [1, 4.8]) },
        { partId: 'legF', rot: kf([0, 0.6], [1, 0.6]) },
        { partId: 'legB', rot: kf([0, 0.55], [1, 0.55]) },
        { partId: 'shinF', rot: kf([0, 0.8], [1, 0.8]) },
        { partId: 'shinB', rot: kf([0, 0.8], [1, 0.8]) },
        { partId: 'neck', rot: kf([0, -0.2], [0.5, -0.17], [1, -0.2]) },
        { partId: 'streamA', rot: kf([0, -0.05], [0.5, 0.05], [1, -0.05]) },
        { partId: 'streamB', rot: kf([0, 0.04], [0.5, -0.05], [1, 0.04]) },
      ],
    },
    feedGive: {
      // The delivery hold: one gentle dip of the neck and head, shallower than
      // 'eat''s peck, held while the chick arrives. `food` stays visible.
      durationMs: 800,
      tracks: [
        { partId: 'neck', rot: kf([0, 0], [0.35, 0.55], [0.65, 0.55], [1, 0]) },
        { partId: 'head', rot: kf([0, 0], [0.35, 0.4], [0.65, 0.4], [1, 0]) },
        { partId: 'beak', sy: kf([0, 1], [0.35, 1.2], [0.65, 1.2], [1, 1]) },
        { partId: 'body', rot: kf([0, 0], [0.35, 0.08], [0.65, 0.08], [1, 0]) },
        { partId: 'tail', rot: kf([0, 0], [0.35, 0.1], [0.65, 0.1], [1, 0]) },
      ],
    },
    feedTake: {
      // Played by the chick: neck stretched up and forward, bill gaping, wings
      // quivering — the mirror of 'feedGive'.
      durationMs: 650,
      tracks: [
        { partId: 'neck', rot: kf([0, 0], [0.35, 0.12], [0.65, 0.12], [1, 0]), sy: kf([0, 1], [0.35, 1.12], [0.65, 1.12], [1, 1]) },
        { partId: 'head', rot: kf([0, 0], [0.35, -0.35], [0.65, -0.35], [1, 0]) },
        { partId: 'beak', sy: kf([0, 1], [0.3, 1.7], [0.7, 1.7], [1, 1]) },
        { partId: 'wing', rot: kf([0, 0], [0.3, 0.25], [0.42, 0.05], [0.54, 0.25], [0.66, 0.05], [1, 0]) },
        { partId: 'body', py: kf([0, 0], [0.35, -1.5], [0.65, -1.5], [1, 0]) },
      ],
    },
  },
};
