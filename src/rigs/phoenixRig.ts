/**
 * The phoenix rig: a crane-elegant firebird — warm gold body, flame wing,
 * long trailing ember plumes, a little flame crest. Elders don't silver;
 * they glow brighter as their rebirth nears. Side view facing +x.
 */
import type { CreatureRig } from './format';

const GOLD = 0xe8a84c;
const GOLD_LIGHT = 0xf4c56a;
const FLAME = 0xd96b35;
const EMBER = 0xf4d03f;

export const phoenixRig: CreatureRig = {
  species: 'phoenix',
  strideLength: 30,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 26, ry: 8, fill: { color: 0xffb36b, alpha: 0.3 } }] }, // warm glow, not shade
    { id: 'body', parent: null, x: 0, y: -34, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 17, ry: 12, fill: { color: GOLD } },
        { kind: 'ellipse', x: 6, y: 4, rx: 10, ry: 7, fill: { color: GOLD_LIGHT } },
      ] },
    // Parented to body (was root-level); offset = old root offset minus
    // body's base offset (0, -34), so the resting pose is unchanged.
    { id: 'legB', parent: 'body', x: -4, y: 34, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: -16, width: 2.2, fill: { color: 0xc98a3c } }] },
    { id: 'legF', parent: 'body', x: 4, y: 34, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: -16, width: 2.2, fill: { color: 0xc98a3c } }] },
    { id: 'plumeFar', parent: 'body', x: -15, y: 2, z: -2,
      shapes: [
        { kind: 'path', d: 'M 0 0 Q -28 10 -46 4 Q -32 14 -14 10 Z', fill: { color: FLAME, alpha: 0.8 } },
        { kind: 'circle', x: -44, y: 5, r: 3, fill: { color: EMBER, alpha: 0.9 } },
      ] },
    { id: 'plumeNear', parent: 'body', x: -13, y: -2, z: -1,
      shapes: [
        { kind: 'path', d: 'M 0 0 Q -22 4 -36 -2 Q -24 8 -10 8 Z', fill: { color: 0xe89a3c, alpha: 0.9 } },
        { kind: 'circle', x: -34, y: -1, r: 2.6, fill: { color: EMBER } },
      ] },
    { id: 'wing', parent: 'body', x: -4, y: -3, z: 1,
      shapes: [
        { kind: 'ellipse', x: -3, y: 3, rx: 11, ry: 8, fill: { color: FLAME } },
        { kind: 'ellipse', x: -6, y: 5, rx: 6, ry: 4, fill: { color: EMBER, alpha: 0.6 } },
      ] },
    { id: 'neck', parent: 'body', x: 12, y: -7, z: 2,
      shapes: [{ kind: 'ellipse', x: 3, y: -12, rx: 6, ry: 14, fill: { color: GOLD } }] },
    { id: 'head', parent: 'neck', x: 4, y: -24, z: 1,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 7.5, fill: { color: 0xf0b656 } },
        { kind: 'circle', x: 3, y: -1.5, r: 1.9, fill: { color: 0x51321a } },
      ] },
    { id: 'crest', parent: 'head', x: -1, y: -6, z: -1,
      shapes: [{ kind: 'path', d: 'M -2 0 Q 0 -12 4 -4 Q 6 -14 9 -2 Z', fill: { color: FLAME } }] },
    { id: 'beak', parent: 'head', x: 7, y: 0.5, z: 1,
      shapes: [{ kind: 'path', d: 'M 0 -2 L 8 0.5 L 0 2.5 Z', fill: { color: 0xc9822f } }] },
    // A little ember-fruit carried home to the chick (M9 task 5) — only ever
    // visible during the 'carry' clip; every other clip hides it.
    { id: 'food', parent: 'beak', x: 6, y: 0.5, z: 2,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2.5, ry: 2.2, fill: { color: EMBER } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'flap', 'sit'] },
  ],
  stages: {
    baby: {
      scale: 0.45, // an ember chick
      partScale: { head: { x: 1.35, y: 1.35 }, plumeFar: { x: 0.3, y: 0.6 }, plumeNear: { x: 0.3, y: 0.6 }, crest: { x: 0.7, y: 0.7 } },
      tint: 0xf5d9a8,
    },
    juvenile: { scale: 0.75, partScale: { head: { x: 1.1, y: 1.1 }, plumeFar: { x: 0.7, y: 0.9 }, plumeNear: { x: 0.7, y: 0.9 } } },
    adult: { scale: 1 },
    elder: { scale: 1, tint: 0xfff0d0 }, // burning brighter, not fading
  },
  clips: {
    idle: {
      durationMs: 2800, // plumes breathe like slow flame
      tracks: [
        { partId: 'plumeFar', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.14 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.1 }, { t: 1, v: 0 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.12 }, { t: 0.6, v: 0.1 }, { t: 1, v: 0 }] },
        { partId: 'crest', sy: [{ t: 0, v: 1 }, { t: 0.5, v: 1.15 }, { t: 1, v: 1 }] },
      ],
    },
    walk: {
      durationMs: 700, // stately strides
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -3 }, { t: 1, v: 0 }] },
        { partId: 'plumeFar', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.1 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: -0.08 }, { t: 0.5, v: 0.1 }, { t: 1, v: -0.08 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0.04 }, { t: 0.5, v: -0.04 }, { t: 1, v: 0.04 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.2 }, { t: 0.5, v: -0.2 }, { t: 1, v: 0.2 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.2 }, { t: 0.5, v: 0.2 }, { t: 1, v: -0.2 }] },
      ],
    },
    sleep: {
      durationMs: 4200, // banked embers
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: -0.55 }, { t: 1, v: -0.55 }], py: [{ t: 0, v: 6 }, { t: 1, v: 6 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.91 }, { t: 1, v: 0.95 }] },
        { partId: 'crest', sy: [{ t: 0, v: 0.8 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.8 }] },
      ],
    },
    eat: {
      durationMs: 900,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.85 }, { t: 0.55, v: 0.85 }, { t: 0.8, v: 0.2 }, { t: 1, v: 0 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0.15 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1200, // a courtly wing-and-plume flare
      tracks: [
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.25, v: -0.7 }, { t: 0.5, v: -0.5 }, { t: 0.75, v: -0.7 }, { t: 1, v: 0 }] },
        { partId: 'plumeFar', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.3, v: -2 }, { t: 0.6, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    flap: {
      // Statelier still than the owl — a slow, gliding beat (M9 task 4).
      durationMs: 640,
      tracks: [
        { partId: 'wing', rot: [{ t: 0, v: -0.9 }, { t: 0.5, v: 0.25 }, { t: 1, v: -0.9 }] },
        { partId: 'legF', rot: [{ t: 0, v: -0.7 }, { t: 1, v: -0.7 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.7 }, { t: 1, v: -0.7 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -2 }, { t: 1, v: 0 }] },
      ],
    },
    carry: {
      // Fetching food home: the same stately stride, neck bowed low the
      // whole way with an ember-fruit held in the beak (M9 task 5).
      durationMs: 700,
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -3 }, { t: 1, v: 0 }] },
        { partId: 'plumeFar', rot: [{ t: 0, v: 0.1 }, { t: 0.5, v: -0.12 }, { t: 1, v: 0.1 }] },
        { partId: 'plumeNear', rot: [{ t: 0, v: -0.08 }, { t: 0.5, v: 0.1 }, { t: 1, v: -0.08 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0.25 }, { t: 0.5, v: 0.35 }, { t: 1, v: 0.25 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.2 }, { t: 0.5, v: -0.2 }, { t: 1, v: 0.2 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.2 }, { t: 0.5, v: 0.2 }, { t: 1, v: -0.2 }] },
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
