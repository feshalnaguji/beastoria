/**
 * The frog rig: a squat round body, huge golden eyes on top of the head,
 * folded legs built for a hop. Side view facing +x; origin at ground contact
 * under the body. Built from the rabbit's squat-body structure (M10 task 3),
 * with a robin-style hop gait: a body bob and a tucked-legs mid-air moment.
 */
import type { CreatureRig } from './format';

const SKIN = 0x7fa653;
const SKIN_DARK = 0x6b8f44;
const BELLY = 0xe8dfa8;
const EYE_GOLD = 0xe8c34a;
const FLY = 0x4a4441;

export const frogRig: CreatureRig = {
  species: 'frog',
  strideLength: 14, // frogs hop
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 16,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 20, ry: 6, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: -2, rx: 22, ry: 16, fill: { color: SKIN } },
        { kind: 'ellipse', x: 2, y: 8, rx: 15, ry: 9, fill: { color: BELLY, alpha: 0.85 } },
        { kind: 'ellipse', x: -6, y: -10, rx: 6, ry: 4, fill: { color: SKIN_DARK, alpha: 0.6 } }, // back mottle
      ],
    },
    {
      id: 'legB',
      parent: 'body',
      x: -12,
      y: 8,
      z: -1,
      shapes: [
        { kind: 'ellipse', x: -4, y: 0, rx: 11, ry: 8, fill: { color: SKIN_DARK } }, // folded haunch
        { kind: 'ellipse', x: -12, y: 8, rx: 6, ry: 4, fill: { color: SKIN_DARK } }, // webbed foot
      ],
    },
    {
      id: 'legF',
      parent: 'body',
      x: 12,
      y: 10,
      z: 1,
      shapes: [{ kind: 'ellipse', x: 3, y: 3, rx: 5, ry: 6, fill: { color: SKIN_DARK } }],
    },
    {
      id: 'eyeL',
      parent: 'body',
      x: -3,
      y: -14,
      z: 3,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 6.5, fill: { color: EYE_GOLD } },
        { kind: 'circle', x: 0, y: 0, r: 3, fill: { color: 0x201c1a } },
      ],
    },
    {
      id: 'eyeR',
      parent: 'body',
      x: 9,
      y: -14,
      z: 3,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 6.5, fill: { color: EYE_GOLD } },
        { kind: 'circle', x: 0, y: 0, r: 3, fill: { color: 0x201c1a } },
      ],
    },
    {
      // A fly carried home to the froglets (M10 task 3) — only ever visible
      // during the 'carry' clip; every other clip hides it via hideInClips.
      // (Frogs are actually self-feeding — feedMode 'self' — so this clip
      // exists for the compile-enforced clip set but is never triggered in
      // play, matching koi's food part.)
      id: 'food',
      parent: 'body',
      x: 20,
      y: -2,
      z: 4,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2, ry: 1.6, fill: { color: FLY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit'],
    },
  ],
  stages: {
    baby: {
      scale: 0.45,
      partScale: {
        eyeL: { x: 1.2, y: 1.2 },
        eyeR: { x: 1.2, y: 1.2 },
        legB: { x: 0.75, y: 0.75 }, // tadpole-fresh froglet: small haunches
      },
      tint: 0x9fc47a, // paler froglet green
    },
    juvenile: { scale: 0.7, partScale: { eyeL: { x: 1.05, y: 1.05 }, eyeR: { x: 1.05, y: 1.05 } } },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xb8c2a8 },
  },
  clips: {
    idle: {
      // A still, throat-pulsing wait.
      durationMs: 1600,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 1 },
            { t: 0.5, v: 1.03 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'eyeL',
          py: [
            { t: 0, v: 0 },
            { t: 0.92, v: 0 },
            { t: 0.96, v: 4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'eyeR',
          py: [
            { t: 0, v: 0 },
            { t: 0.92, v: 0 },
            { t: 0.96, v: 4 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // A hop: body bob with the legs tucked at the apex, robin-style.
      durationMs: 420,
      tracks: [
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -8 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.1 },
            { t: 0.5, v: -0.55 },
            { t: 1, v: 0.1 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.1 },
            { t: 0.5, v: -0.4 },
            { t: 1, v: 0.1 },
          ],
        },
      ],
    },
    sleep: {
      durationMs: 3400,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.85 },
            { t: 0.5, v: 0.8 },
            { t: 1, v: 0.85 },
          ],
        },
        { partId: 'eyeL', sy: [{ t: 0, v: 0.15 }, { t: 1, v: 0.15 }] },
        { partId: 'eyeR', sy: [{ t: 0, v: 0.15 }, { t: 1, v: 0.15 }] },
      ],
    },
    eat: {
      // A snap at a passing insect.
      durationMs: 500,
      tracks: [
        {
          partId: 'body',
          sx: [
            { t: 0, v: 1 },
            { t: 0.25, v: 1.1 },
            { t: 0.5, v: 0.95 },
            { t: 1, v: 1 },
          ],
        },
        {
          partId: 'eyeL',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -2 },
            { t: 0.5, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'eyeR',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -2 },
            { t: 0.5, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      // A throat-pouch chorus inflate.
      durationMs: 900,
      tracks: [
        {
          partId: 'body',
          sx: [
            { t: 0, v: 1 },
            { t: 0.3, v: 1.18 },
            { t: 0.55, v: 1 },
            { t: 0.8, v: 1.18 },
            { t: 1, v: 1 },
          ],
        },
      ],
    },
    swim: {
      // Legs kick, floating on the surface — legs stay visible (unlike the
      // duck's, which vanish underwater) since a frog's kick is a top-level
      // read of the character (M10 task 3).
      durationMs: 700,
      tracks: [
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: 2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.15 },
            { t: 0.35, v: -0.7 },
            { t: 0.7, v: 0.15 },
            { t: 1, v: 0.15 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a morsel home: the same hop, mouth held closed (M10 task 3).
      durationMs: 420,
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -8 }, { t: 1, v: 0 }] },
        { partId: 'legB', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: -0.55 }, { t: 1, v: 0.1 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0.1 }] },
      ],
    },
    sit: {
      // Settled at the spawn clump: a gentle squash (M10 task 3).
      durationMs: 1000,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.82 }, { t: 1, v: 0.82 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
      ],
    },
  },
};
