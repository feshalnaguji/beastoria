/**
 * The duck rig: warm brown paddler with a cream breast, teal wing speculum,
 * cheerful orange bill. Ducklings are golden fluff. Side view facing +x.
 */
import type { CreatureRig } from './format';

const BROWN = 0x9b8262;
const BROWN_DARK = 0x846d4e;
const CREAM = 0xe9dcc0;
const BILL = 0xe8a53c;
const WEED = 0x7da861;

export const duckRig: CreatureRig = {
  species: 'duck',
  strideLength: 22,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 19, ry: 5.5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'body', parent: null, x: 0, y: -16, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 19, ry: 12, fill: { color: BROWN } },
        { kind: 'ellipse', x: 7, y: 4, rx: 11, ry: 8, fill: { color: CREAM } },
      ] },
    // Parented to body (was root-level); offset = old root offset minus
    // body's base offset (0, -16), so the resting pose is unchanged.
    { id: 'legB', parent: 'body', x: -4, y: 16, z: -2, hideInClips: ['swim'],
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -1, y2: -9, width: 2.6, fill: { color: BILL } }] },
    { id: 'legF', parent: 'body', x: 3, y: 16, z: -1, hideInClips: ['swim'],
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 1, y2: -9, width: 2.6, fill: { color: BILL } }] },
    { id: 'tail', parent: 'body', x: -16, y: -4, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q -9 -1 -11 -7 Q -6 -3 -1 -3 Z', fill: { color: BROWN_DARK } }] },
    { id: 'wing', parent: 'body', x: -4, y: -2, z: 1,
      shapes: [
        { kind: 'ellipse', x: -3, y: 3, rx: 11, ry: 7, fill: { color: BROWN_DARK } },
        { kind: 'ellipse', x: -6, y: 4, rx: 4, ry: 2.4, fill: { color: 0x3e7d8a } }, // speculum
      ] },
    { id: 'head', parent: 'body', x: 14, y: -12, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 8.5, fill: { color: 0x8a7355 } },
        { kind: 'ellipse', x: 0, y: -4, rx: 7, ry: 4.5, fill: { color: 0x6f8a72, alpha: 0.6 } }, // soft teal crown
        { kind: 'circle', x: 3.5, y: -1.5, r: 1.9, fill: { color: 0x201c1a } },
      ] },
    { id: 'bill', parent: 'head', x: 7.5, y: 1, z: 1,
      shapes: [{ kind: 'path', d: 'M 0 -2.5 L 10 -1 Q 12 0.5 10 2 L 0 3.5 Z', fill: { color: BILL } }] },
    // A sprig of pondweed carried home to the ducklings (M9 task 5) — only
    // ever visible during the 'carry' clip; every other clip hides it.
    { id: 'food', parent: 'bill', x: 9, y: 0.5, z: 2,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2.5, ry: 2.2, fill: { color: WEED } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit'] },
  ],
  stages: {
    baby: {
      scale: 0.5,
      partScale: { head: { x: 1.3, y: 1.3 }, tail: { x: 0.5, y: 0.7 }, wing: { x: 0.7, y: 0.7 } },
      tint: 0xf0dc9a, // golden duckling fluff
    },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xd3cfc6 },
  },
  clips: {
    idle: {
      durationMs: 2100,
      tracks: [
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.42, v: 0 }, { t: 0.5, v: 0.4 }, { t: 0.6, v: -0.2 }, { t: 0.68, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.1 }, { t: 0.5, v: -0.08 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 520, // the waddle
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0.12 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.12 }],
          py: [{ t: 0, v: 0 }, { t: 0.25, v: -1.5 }, { t: 0.5, v: 0 }, { t: 0.75, v: -1.5 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.2 }, { t: 0.5, v: 0.2 }, { t: 1, v: -0.2 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.4 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0.4 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.4 }, { t: 0.5, v: 0.4 }, { t: 1, v: -0.4 }] },
      ],
    },
    sleep: {
      durationMs: 3600,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: -0.6 }, { t: 1, v: -0.6 }],
          px: [{ t: 0, v: -6 }, { t: 1, v: -6 }], py: [{ t: 0, v: 4 }, { t: 1, v: 4 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.94 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.94 }] },
      ],
    },
    eat: {
      durationMs: 900, // dabbling, bottoms-up hint
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.9 }, { t: 0.55, v: 0.9 }, { t: 0.75, v: 0.2 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.22 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.35, v: -0.35 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 850,
      tracks: [
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.5 }, { t: 0.4, v: 0 }, { t: 0.6, v: -0.5 }, { t: 0.8, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
      ],
    },
    swim: {
      // Floating and paddling, not walking — legs vanish (hideInClips) since
      // they're doing their work underwater, out of sight (M9 task 4).
      durationMs: 900,
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: 2 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
      ],
    },
    carry: {
      // Fetching food home: the same waddle, bill held low and full (M9 task 5).
      durationMs: 520,
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0.12 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.12 }],
          py: [{ t: 0, v: 0 }, { t: 0.25, v: -1.5 }, { t: 0.5, v: 0 }, { t: 0.75, v: -1.5 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.2 }, { t: 0.5, v: 0.2 }, { t: 1, v: -0.2 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.4 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0.4 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.4 }, { t: 0.5, v: 0.4 }, { t: 1, v: -0.4 }] },
        { partId: 'head', rot: [{ t: 0, v: 0.2 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0.2 }] },
      ],
    },
    sit: {
      // Settled to brood: a gentle squash (M9 task 5).
      durationMs: 1000,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
      ],
    },
  },
};
