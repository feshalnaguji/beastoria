/**
 * The turtle rig, rebuilt to the art recipe
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md, M14).
 *
 * PRIMARY MARKING: the high-contrast yellow rim of the marginal scutes
 * against a dark olive domed carapace. It is the biggest value jump on the
 * animal, runs the whole length of the shell, and survives a T1 bake; it is
 * what separates the turtle from the frog on a green valley floor.
 * SECONDARY MARKINGS (T2): a red ear patch behind the eye, yellow head/neck
 * stripes, scute seams on the dome (with dark seams ticking across the yellow
 * rim), and pale clawed feet.
 *
 * Side view facing +x. Origin sits at the shell's centre line; the ground line
 * is y = +15 (the `shadow` part), where every foot lands. The dome is a path
 * silhouette; the neck and head are children of a `neck` part that sits BEHIND
 * the shell (z below it), so the head tucks in by sliding the neck back under
 * the carapace and never detaches.
 *
 * SHADING: three tones (SHELL / SHELL_DARK+SHELL_DEEP / SHELL_LIGHT, and the
 * same for SKIN) as flat-alpha layers in the recipe's paint order. Far-side
 * legs are separate parts behind the body in the shade tone.
 *
 * MOTION: a slow diagonal walk — near fore with far hind, then near hind with
 * far fore — each foot dragging back through a long stance and lifting on a
 * short swing, with the head bobbing forward on each step. Sleep and sit tuck
 * the head and legs and lower the shell onto the ground.
 *
 * Rotation sign: +rot swings a limb's far end rearward (-x) because legs hang
 * down from their pivot; +rot on the neck lowers the head toward the ground.
 */
import type { CreatureRig, Keyframe } from './format';

// --- the three-tone palette (recipe rule 3) -------------------------------
const SHELL = 0x4f6a3a; // base: dark olive carapace
const SHELL_DARK = 0x3a4f2b; // shade: the lower flank
const SHELL_DEEP = 0x28391e; // shade: seams and creases
const SHELL_LIGHT = 0x8fa65e; // light: the sunlit crest of the dome
const SKIN = 0x5f7843; // base: head, legs, tail (dark olive, reads against grass)
const SKIN_DARK = 0x465c32; // shade: far-side legs, undersides
const SKIN_DEEP = 0x2f4222; // shade: creases and ground contact
const SKIN_LIGHT = 0xcadba0; // light: chin, rim slivers
// --- markings -------------------------------------------------------------
const RIM_YELLOW = 0xe9cd55; // the marginal scutes — primary marking
const RIM_SHADE = 0x8a6f1f; // dark seams across the rim and its contact band
const PLASTRON = 0xb9a54e; // the belly plate peeking under the shell
const STRIPE = 0xe6cf5c; // yellow head and neck stripes
const EAR_RED = 0xc9453b; // the red ear patch
const CLAW = 0xefe6c4;
const EYE = 0x201c1a;
const FLY = 0x4a4441;
const GROUND_SHADE = 0x3d5a2e;

// One stride per diagonal pair. Stance (foot dragging back) takes 60% of the
// cycle and the swing 40%; the two pairs are half a cycle apart. A is the
// near fore + far hind, B is the near hind + far fore.
const UP_A: Keyframe[] = [
  { t: 0, v: -0.3 },
  { t: 0.6, v: 0.32 },
  { t: 0.8, v: 0.05 },
  { t: 1, v: -0.3 },
];
const UP_B: Keyframe[] = [
  { t: 0, v: 0.22 },
  { t: 0.1, v: 0.32 },
  { t: 0.3, v: 0.05 },
  { t: 0.5, v: -0.3 },
  { t: 1, v: 0.22 },
];
// The shin bends against the thigh (a joint, not a copy) and lifts on the swing.
const LOW_A: Keyframe[] = [
  { t: 0, v: 0.05 },
  { t: 0.6, v: -0.12 },
  { t: 0.8, v: -0.3 },
  { t: 1, v: 0.05 },
];
const LOW_B: Keyframe[] = [
  { t: 0, v: -0.09 },
  { t: 0.1, v: -0.12 },
  { t: 0.3, v: -0.3 },
  { t: 0.5, v: 0.05 },
  { t: 1, v: -0.09 },
];
const LIFT_A: Keyframe[] = [
  { t: 0, v: 0 },
  { t: 0.6, v: 0 },
  { t: 0.78, v: -2.5 },
  { t: 1, v: 0 },
];
const LIFT_B: Keyframe[] = [
  { t: 0, v: 0 },
  { t: 0.1, v: 0 },
  { t: 0.28, v: -2.5 },
  { t: 0.5, v: 0 },
  { t: 1, v: 0 },
];

/** Shared by `walk` and `carry` so the two gaits cannot drift apart. */
const WALK_TRACKS = [
  { partId: 'legFUp', rot: UP_A },
  { partId: 'legFLow', rot: LOW_A, py: LIFT_A },
  { partId: 'legBFar', rot: UP_A, py: LIFT_A },
  { partId: 'legBUp', rot: UP_B },
  { partId: 'legBLow', rot: LOW_B, py: LIFT_B },
  { partId: 'legFFar', rot: UP_B, py: LIFT_B },
  {
    // The shell rocks a hair onto each planted pair.
    partId: 'shell',
    rot: [
      { t: 0, v: 0.015 },
      { t: 0.5, v: -0.015 },
      { t: 1, v: 0.015 },
    ],
    py: [
      { t: 0, v: 0 },
      { t: 0.25, v: -0.8 },
      { t: 0.5, v: 0 },
      { t: 0.75, v: -0.8 },
      { t: 1, v: 0 },
    ],
  },
  {
    // The head bob: the neck slides out a little further on every step.
    partId: 'neck',
    px: [
      { t: 0, v: -0.5 },
      { t: 0.2, v: 1.5 },
      { t: 0.5, v: 0.2 },
      { t: 0.7, v: 2 },
      { t: 1, v: -0.5 },
    ],
  },
  {
    partId: 'tail',
    rot: [
      { t: 0, v: 0.08 },
      { t: 0.5, v: -0.08 },
      { t: 1, v: 0.08 },
    ],
  },
];

export const turtleRig: CreatureRig = {
  species: 'turtle',
  // Honest stride (recipe rule 4C): one diagonal cycle covers 24 world px. The
  // turtle's sim speed is 2/tick x 10 ticks/s = 20 px/s, so 20/24 = 0.83
  // cycles per second, inside the 0.5-1.2 slow-walker band. `walk`'s 1200 ms
  // is 24 / 0.02 px-per-ms, so the playback multiplier sits near 1.0.
  strideLength: 24,
  parts: [
    {
      // Two ellipses: a wide soft pool and a tighter core under the shell.
      id: 'shadow',
      parent: null,
      x: 0,
      y: 15,
      z: -10,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 27, ry: 7, fill: { color: GROUND_SHADE, alpha: 0.18 } },
        { kind: 'ellipse', x: -1, y: 0.5, rx: 17, ry: 4.4, fill: { color: GROUND_SHADE, alpha: 0.22 } },
      ],
    },
    {
      // The soft belly between the legs: a skin lens with the yellowish
      // plastron plate on it, seen just below the shell's lower edge.
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        { kind: 'path', d: 'M -17 7 Q 0 15 17 7 Q 0 10 -17 7 Z', fill: { color: SKIN_DARK } },
        { kind: 'path', d: 'M -15 8 Q 0 14 15 8 Q 0 10.4 -15 8 Z', fill: { color: PLASTRON, alpha: 0.85 } },
      ],
    },
    {
      // Far-side hind leg: a flat shade mass behind everything.
      id: 'legBFar',
      parent: 'body',
      x: -7,
      y: 5,
      z: -4,
      shapes: [
        {
          kind: 'path',
          d: 'M -4.5 -3 Q -6 3 -5.2 8 Q -5.4 11 -3.6 10.4 L 5 10.4 Q 8 10.2 7.6 8.2 Q 6.5 7 4.5 6.8 Q 4.7 2 4.5 -3 Z',
          fill: { color: SKIN_DARK },
        },
        { kind: 'path', d: 'M -4.5 -3 Q -6 3 -5.2 8 L -3.5 8 Q -4.4 3 -3.4 -3 Z', fill: { color: SKIN_DEEP, alpha: 0.35 } },
        { kind: 'path', d: 'M 7.2 8 L 9.6 9 L 7 9.8 Z', fill: { color: SKIN_DEEP, alpha: 0.6 } },
      ],
    },
    {
      id: 'legFFar',
      parent: 'body',
      x: 8,
      y: 5,
      z: -4,
      shapes: [
        {
          kind: 'path',
          d: 'M -4.5 -3 Q -6 3 -5.2 8 Q -5.4 11 -3.6 10.4 L 5 10.4 Q 8 10.2 7.6 8.2 Q 6.5 7 4.5 6.8 Q 4.7 2 4.5 -3 Z',
          fill: { color: SKIN_DARK },
        },
        { kind: 'path', d: 'M -4.5 -3 Q -6 3 -5.2 8 L -3.5 8 Q -4.4 3 -3.4 -3 Z', fill: { color: SKIN_DEEP, alpha: 0.35 } },
        { kind: 'path', d: 'M 7.2 8 L 9.6 9 L 7 9.8 Z', fill: { color: SKIN_DEEP, alpha: 0.6 } },
      ],
    },
    {
      // A short tapered wedge, not a stick; it peeks out from under the dome.
      id: 'tail',
      parent: 'body',
      x: -19,
      y: 5,
      z: -1,
      shapes: [
        { kind: 'path', d: 'M 2 -2.6 Q -3 -2.6 -7.5 2.8 Q -3.5 4.4 2 3.4 Z', fill: { color: SKIN } },
        { kind: 'path', d: 'M -6 3 Q -3 4.2 2 3.4 L 2 1.4 Q -2 2.6 -6 3 Z', fill: { color: SKIN_DARK, alpha: 0.7 } },
        { kind: 'path', d: 'M 1 -2.5 Q -3 -2.4 -5.5 0.3 Q -2.5 -1.2 1 -1.3 Z', fill: { color: SKIN_LIGHT, alpha: 0.35 } },
      ],
    },
    {
      id: 'legBUp',
      parent: 'body',
      x: -13,
      y: 5,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -4.8 -3 Q -6.2 3 -5.2 7.5 L 5 7.5 Q 6.2 3 4.8 -3 Z', fill: { color: SKIN } },
        { kind: 'path', d: 'M -4.8 -3 Q -6.2 3 -5.2 7.5 L -3 7.5 Q -4 3 -3 -3 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
        { kind: 'path', d: 'M -5.4 4.6 L 5.4 4.6 L 5.5 5.8 L -5.3 5.8 Z M -5.5 1.4 L 5.2 1.4 L 5.3 2.5 L -5.5 2.5 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
        { kind: 'path', d: 'M -5.2 7 L 5 7 L 5 7.5 L -5.2 7.5 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
      ],
    },
    {
      id: 'legBLow',
      parent: 'legBUp',
      x: 0,
      y: 5,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -4.9 -2.5 Q -5.4 2 -5.2 4 Q -5 5.4 -3 5.4 L 5.5 5.4 Q 8.6 5.2 8.2 3 Q 7.5 1.6 5 1.2 Q 4.8 -1 4.9 -2.5 Z',
          fill: { color: SKIN },
        },
        { kind: 'path', d: 'M -5.2 4 Q -5 5.4 -3 5.4 L 5.5 5.4 Q 8.6 5.2 8.2 3.6 Q 6 4.6 0 4.5 Q -4 4.4 -5.2 4 Z', fill: { color: SKIN_DEEP, alpha: 0.55 } },
        { kind: 'path', d: 'M -5.1 -0.5 L 4.9 -0.5 L 4.9 0.6 L -5.1 0.6 Z M -5.3 2.2 L 5 2.2 L 5 3.2 L -5.3 3.2 Z', fill: { color: SKIN_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M 6.8 1.6 L 9.6 2.3 L 6.9 3 Z M 7.6 3.2 L 10.4 4 L 7.7 4.6 Z', fill: { color: CLAW } },
      ],
    },
    {
      id: 'legFUp',
      parent: 'body',
      x: 12,
      y: 5,
      z: 2,
      shapes: [
        { kind: 'path', d: 'M -4.8 -3 Q -6.2 3 -5.2 7.5 L 5 7.5 Q 6.2 3 4.8 -3 Z', fill: { color: SKIN } },
        { kind: 'path', d: 'M -4.8 -3 Q -6.2 3 -5.2 7.5 L -3 7.5 Q -4 3 -3 -3 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
        { kind: 'path', d: 'M -5.4 4.6 L 5.4 4.6 L 5.5 5.8 L -5.3 5.8 Z M -5.5 1.4 L 5.2 1.4 L 5.3 2.5 L -5.5 2.5 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
        { kind: 'path', d: 'M -5.2 7 L 5 7 L 5 7.5 L -5.2 7.5 Z', fill: { color: SKIN_DEEP, alpha: 0.5 } },
      ],
    },
    {
      id: 'legFLow',
      parent: 'legFUp',
      x: 0,
      y: 5,
      z: 0,
      shapes: [
        {
          kind: 'path',
          d: 'M -4.9 -2.5 Q -5.4 2 -5.2 4 Q -5 5.4 -3 5.4 L 5.5 5.4 Q 8.6 5.2 8.2 3 Q 7.5 1.6 5 1.2 Q 4.8 -1 4.9 -2.5 Z',
          fill: { color: SKIN },
        },
        { kind: 'path', d: 'M -5.2 4 Q -5 5.4 -3 5.4 L 5.5 5.4 Q 8.6 5.2 8.2 3.6 Q 6 4.6 0 4.5 Q -4 4.4 -5.2 4 Z', fill: { color: SKIN_DEEP, alpha: 0.55 } },
        { kind: 'path', d: 'M -5.1 -0.5 L 4.9 -0.5 L 4.9 0.6 L -5.1 0.6 Z M -5.3 2.2 L 5 2.2 L 5 3.2 L -5.3 3.2 Z', fill: { color: SKIN_DEEP, alpha: 0.45 } },
        { kind: 'path', d: 'M 6.8 1.6 L 9.6 2.3 L 6.9 3 Z M 7.6 3.2 L 10.4 4 L 7.7 4.6 Z', fill: { color: CLAW } },
      ],
    },
    {
      // The dome. Paint order: base, lower-flank shade, scute seams, light
      // crescents on the crest, then the yellow marginal rim (PRIMARY MARKING)
      // with its dark seams and contact band.
      id: 'shell',
      parent: 'body',
      x: 0,
      y: 0,
      z: 3,
      shapes: [
        {
          kind: 'path',
          d: 'M -21 7 Q -23.5 -3 -14 -11 Q 0 -18 14 -11 Q 23.5 -3 21 7 Q 11 9.5 0 9.5 Q -11 9.5 -21 7 Z',
          fill: { color: SHELL },
        },
        {
          kind: 'path',
          d: 'M -21.4 1.2 Q -21.6 -2 -18 -6 Q 0 -1 18 -6 Q 21.6 -2 21.4 1.2 Q 0 5.8 -21.4 1.2 Z',
          fill: { color: SHELL_DARK, alpha: 0.7 },
        },
        { kind: 'line', x1: -14, y1: 1, x2: -9, y2: -12, width: 1.1, fill: { color: SHELL_DEEP, alpha: 0.55 } },
        { kind: 'line', x1: -1, y1: 3, x2: -2, y2: -13, width: 1.1, fill: { color: SHELL_DEEP, alpha: 0.55 } },
        { kind: 'line', x1: 11, y1: 1.5, x2: 7, y2: -12, width: 1.1, fill: { color: SHELL_DEEP, alpha: 0.55 } },
        { kind: 'path', d: 'M -12 -11.5 Q 0 -17 12 -11.5 Q 0 -14.5 -12 -11.5 Z', fill: { color: SHELL_LIGHT, alpha: 0.5 } },
        { kind: 'path', d: 'M 13.5 -9.5 Q 19 -6.5 20.5 -1 Q 17 -5.5 12.5 -8.2 Z', fill: { color: SHELL_LIGHT, alpha: 0.35 } },
        {
          kind: 'path',
          d: 'M -21.4 1.2 Q 0 5.8 21.4 1.2 L 21.4 4 Q 21.3 6 21 7 Q 11 9.5 0 9.5 Q -11 9.5 -21 7 Q -21.3 6 -21.4 4 Z',
          fill: { color: RIM_YELLOW },
        },
        {
          kind: 'path',
          d:
            'M -15 3.2 L -14 3.2 L -14.4 7.6 L -15.4 7.6 Z ' +
            'M -7.5 4 L -6.5 4 L -6.7 8.6 L -7.7 8.6 Z ' +
            'M -0.5 4.3 L 0.5 4.3 L 0.5 8.8 L -0.5 8.8 Z ' +
            'M 6.5 4 L 7.5 4 L 7.7 8.6 L 6.7 8.6 Z ' +
            'M 14 3.2 L 15 3.2 L 15.4 7.6 L 14.4 7.6 Z',
          fill: { color: RIM_SHADE, alpha: 0.6 },
        },
        {
          kind: 'path',
          d: 'M -21 7 Q -11 9.5 0 9.5 Q 11 9.5 21 7 Q 11 7.8 0 7.8 Q -11 7.8 -21 7 Z',
          fill: { color: RIM_SHADE, alpha: 0.6 },
        },
      ],
    },
    {
      // Sits BEHIND the shell (z 1 < 3), so retracting it slides head and
      // neck under the carapace instead of detaching them.
      id: 'neck',
      parent: 'body',
      x: 16,
      y: 2,
      z: 1,
      shapes: [
        { kind: 'path', d: 'M -7 -4 Q 0 -4.6 7.5 -4.2 L 8 4.6 Q 0 5.6 -7 4.8 Z', fill: { color: SKIN } },
        { kind: 'path', d: 'M -7 2 Q 0 3 8 2.4 L 8 4.6 Q 0 5.6 -7 4.8 Z', fill: { color: SKIN_DARK, alpha: 0.6 } },
        { kind: 'path', d: 'M -4 -1.4 Q 2 -1.8 8 -1.2 L 8 -0.2 Q 2 -0.8 -4 -0.2 Z', fill: { color: STRIPE, alpha: 0.9 } },
      ],
    },
    {
      id: 'head',
      parent: 'neck',
      x: 6,
      y: 0,
      z: 1,
      shapes: [
        {
          kind: 'path',
          d: 'M -4.5 -2.5 Q -3.5 -5.6 1.5 -5.6 Q 6 -5.6 8 -2.2 Q 9.2 0.2 8.2 2.6 Q 6 5.8 0.5 5.8 Q -4 5.5 -4.6 1.5 Z',
          fill: { color: SKIN },
        },
        { kind: 'path', d: 'M -3 3 Q 1 6 5.5 5 Q 8 3.5 8.4 2 Q 6 4.2 1 4 Q -2 3.8 -3 3 Z', fill: { color: SKIN_LIGHT, alpha: 0.5 } },
        { kind: 'path', d: 'M -3.4 -3.8 Q -2 -5.4 1.5 -5.4 Q 5.5 -5.4 7.6 -2.6 Q 5 -4.3 1.5 -4.3 Q -1.8 -4.3 -3.4 -3.8 Z', fill: { color: SKIN_LIGHT, alpha: 0.4 } },
        // SECONDARY MARKINGS: the red ear patch and the two yellow stripes.
        { kind: 'ellipse', x: 1.4, y: -1.2, rx: 2.3, ry: 1.2, fill: { color: EAR_RED } },
        { kind: 'path', d: 'M 7.2 1 Q 2 0.5 -3.5 1.2 L -3.5 2.1 Q 2 1.7 7.4 2 Z', fill: { color: STRIPE } },
        { kind: 'path', d: 'M 6 3.3 Q 2 3.3 -3.4 4 L -3.4 4.8 Q 2 4.2 6 4.2 Z', fill: { color: STRIPE } },
        { kind: 'circle', x: 5, y: -1.6, r: 1.5, fill: { color: EYE } },
        { kind: 'circle', x: 5.5, y: -2.1, r: 0.5, fill: { color: 0xffffff, alpha: 0.8 } },
        { kind: 'ellipse', x: 8, y: -0.6, rx: 0.6, ry: 0.5, fill: { color: SKIN_DEEP, alpha: 0.7 } },
      ],
    },
    {
      // A morsel carried home, though turtles are self-feeding (feedMode
      // 'self') — this exists only for the compile-enforced clip set and
      // stays carry-only, never triggered in play (M10 task 3).
      id: 'food',
      parent: 'head',
      x: 8.5,
      y: 3,
      z: 5,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 1.8, ry: 1.4, fill: { color: FLY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit', 'feedGive', 'feedTake'],
    },
  ],
  stages: {
    baby: {
      // A hatchling: a big head on a rounder shell. The leg chain is left
      // alone (recipe rule 4F) so the feet stay on the shadow line.
      scale: 0.45,
      partScale: {
        shell: { x: 1.08, y: 1.1 },
        head: { x: 1.3, y: 1.3 },
        tail: { x: 0.8, y: 0.8 },
      },
      tint: 0xa8bd80, // paler hatchling green
    },
    juvenile: { scale: 0.7, partScale: { head: { x: 1.12, y: 1.12 } } },
    adult: { scale: 1 },
    elder: { scale: 1.02, tint: 0xc4c4b0 }, // ancient, faintly silvered
  },
  clips: {
    idle: {
      // A slow breath and a settle — nothing hurries a turtle.
      durationMs: 3200,
      tracks: [
        {
          partId: 'neck',
          px: [
            { t: 0, v: 0 },
            { t: 0.5, v: 1.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.05 },
            { t: 0.7, v: 0.04 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'shell',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.6, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // The slow diagonal walk; see WALK_TRACKS. 1200 ms is strideLength /
      // speed, so the playback multiplier sits near 1.0 while cruising.
      durationMs: 1200,
      tracks: [
        ...WALK_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.05 },
            { t: 0.2, v: -0.06 },
            { t: 0.5, v: 0.03 },
            { t: 0.7, v: -0.08 },
            { t: 1, v: 0.05 },
          ],
        },
      ],
    },
    sleep: {
      // Tucked in: the neck slides back under the carapace, the legs fold
      // away, and the shell settles onto the ground (py 5 puts its yellow rim
      // at the shadow line — recipe rule 4E).
      durationMs: 4000,
      tracks: [
        {
          partId: 'neck',
          px: [
            { t: 0, v: -10 },
            { t: 1, v: -10 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.1 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'shell',
          py: [
            { t: 0, v: 5 },
            { t: 1, v: 5 },
          ],
          sy: [
            { t: 0, v: 0.99 },
            { t: 0.5, v: 0.96 },
            { t: 1, v: 0.99 },
          ],
        },
        { partId: 'legBUp', sy: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }] },
        { partId: 'legFUp', sy: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }] },
        { partId: 'legBFar', sy: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }] },
        { partId: 'legFFar', sy: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0.3 }, { t: 1, v: 0.3 }] },
      ],
    },
    eat: {
      // A slow bite at pond-edge greens: the neck reaches down and out, the
      // head nips at the bottom of the dip.
      durationMs: 1300,
      tracks: [
        {
          partId: 'neck',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.42 },
            { t: 0.62, v: 0.42 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 4 },
            { t: 0.62, v: 4 },
            { t: 1, v: 0 },
          ],
          px: [
            { t: 0, v: 0 },
            { t: 0.3, v: 2.5 },
            { t: 0.62, v: 2.5 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.2 },
            { t: 0.4, v: 0.34 },
            { t: 0.5, v: 0.2 },
            { t: 0.58, v: 0.34 },
            { t: 0.66, v: 0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'legFUp',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.08 },
            { t: 0.62, v: -0.08 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A greeting: the neck stretches and the head turns up and across.
      durationMs: 1500,
      tracks: [
        {
          partId: 'neck',
          px: [
            { t: 0, v: 0 },
            { t: 0.35, v: 2.5 },
            { t: 0.7, v: 1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.18 },
            { t: 0.7, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.14 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    swim: {
      // Buoyant paddling: the shell rides high, the neck reaches out with the
      // head lifted, and the diagonal pairs sweep wide with the shins a
      // quarter-beat behind the thighs.
      durationMs: 1000,
      tracks: [
        {
          partId: 'shell',
          py: [
            { t: 0, v: -2 },
            { t: 0.5, v: 0 },
            { t: 1, v: -2 },
          ],
        },
        {
          partId: 'neck',
          px: [
            { t: 0, v: 2.5 },
            { t: 0.5, v: 3.2 },
            { t: 1, v: 2.5 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.12 },
            { t: 0.5, v: -0.06 },
            { t: 1, v: -0.12 },
          ],
        },
        { partId: 'legFUp', rot: [{ t: 0, v: 0.55 }, { t: 0.5, v: -0.55 }, { t: 1, v: 0.55 }] },
        { partId: 'legBFar', rot: [{ t: 0, v: 0.55 }, { t: 0.5, v: -0.55 }, { t: 1, v: 0.55 }] },
        { partId: 'legBUp', rot: [{ t: 0, v: -0.55 }, { t: 0.5, v: 0.55 }, { t: 1, v: -0.55 }] },
        { partId: 'legFFar', rot: [{ t: 0, v: -0.55 }, { t: 0.5, v: 0.55 }, { t: 1, v: -0.55 }] },
        {
          partId: 'legFLow',
          rot: [
            { t: 0, v: -0.35 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: 0.35 },
            { t: 0.75, v: 0 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          partId: 'legBLow',
          rot: [
            { t: 0, v: 0.35 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: -0.35 },
            { t: 0.75, v: 0 },
            { t: 1, v: 0.35 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a morsel home: the same slow diagonal walk, head lowered.
      durationMs: 1200,
      tracks: [
        ...WALK_TRACKS,
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.15 },
            { t: 0.5, v: 0.22 },
            { t: 1, v: 0.15 },
          ],
        },
      ],
    },
    sit: {
      // Settled at the sand nest: head drawn partly in, legs folded, shell
      // lowered (py 4) so its rim rests near the ground line.
      durationMs: 1400,
      tracks: [
        { partId: 'shell', py: [{ t: 0, v: 4 }, { t: 1, v: 4 }] },
        { partId: 'neck', px: [{ t: 0, v: -4 }, { t: 1, v: -4 }] },
        { partId: 'head', rot: [{ t: 0, v: 0.1 }, { t: 1, v: 0.1 }] },
        { partId: 'legBUp', sy: [{ t: 0, v: 0.62 }, { t: 1, v: 0.62 }] },
        { partId: 'legFUp', sy: [{ t: 0, v: 0.62 }, { t: 1, v: 0.62 }] },
        { partId: 'legBFar', sy: [{ t: 0, v: 0.62 }, { t: 1, v: 0.62 }] },
        { partId: 'legFFar', sy: [{ t: 0, v: 0.62 }, { t: 1, v: 0.62 }] },
      ],
    },
  },
};
