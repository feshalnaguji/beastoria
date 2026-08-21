/**
 * The deer rig: warm fawn coat, cream belly, alert ears, fawn spots that
 * fade after babyhood. Side view facing +x; origin at ground contact.
 */
import type { CreatureRig } from './format';

const COAT = 0xc99b6f;
const COAT_DARK = 0xb0855c;
const CREAM = 0xf1e5d2;
const BERRY = 0xcf5f52;

export const deerRig: CreatureRig = {
  species: 'deer',
  strideLength: 48,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 46, ry: 12, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'body', parent: null, x: 0, y: -58, z: 0,
      shapes: [
        { kind: 'roundRect', x: -45, y: -20, w: 88, h: 42, r: 20, fill: { color: COAT } },
        { kind: 'ellipse', x: 0, y: 16, rx: 30, ry: 12, fill: { color: CREAM, alpha: 0.75 } },
      ] },
    { id: 'spots', parent: 'body', x: 0, y: -6, z: 1,
      shapes: [
        { kind: 'circle', x: -20, y: -4, r: 3.2, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -8, y: 2, r: 2.8, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: -26, y: 6, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 4, y: -6, r: 3, fill: { color: CREAM, alpha: 0.9 } },
        { kind: 'circle', x: 14, y: 2, r: 2.6, fill: { color: CREAM, alpha: 0.9 } },
      ] },
    { id: 'tail', parent: 'body', x: -45, y: -12, z: -1,
      shapes: [{ kind: 'ellipse', x: -4, y: -2, rx: 7, ry: 5, fill: { color: COAT_DARK } }] },
    { id: 'legBB', parent: 'body', x: -32, y: 18, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -3, y2: 40, width: 7, fill: { color: COAT_DARK } }] },
    { id: 'legBF', parent: 'body', x: -24, y: 20, z: 2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: 38, width: 7, fill: { color: COAT } }] },
    { id: 'legFB', parent: 'body', x: 22, y: 18, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: 40, width: 6.5, fill: { color: COAT_DARK } }] },
    { id: 'legFF', parent: 'body', x: 32, y: 20, z: 2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 3, y2: 38, width: 6.5, fill: { color: COAT } }] },
    { id: 'neck', parent: 'body', x: 38, y: -14, z: 3,
      shapes: [{ kind: 'ellipse', x: 7, y: -16, rx: 11, ry: 22, fill: { color: COAT } }] },
    { id: 'head', parent: 'neck', x: 12, y: -34, z: 1,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 13, fill: { color: COAT } },
        { kind: 'ellipse', x: 11, y: 4, rx: 8, ry: 5.5, fill: { color: CREAM } },
        { kind: 'circle', x: 17, y: 4, r: 2.2, fill: { color: 0x3a3230 } }, // nose
        { kind: 'circle', x: 3, y: -3, r: 2.6, fill: { color: 0x3a3230 } }, // eye
      ] },
    // A morsel carried home to the fawns (M9 task 5) — only ever visible
    // during the 'carry' clip; every other clip hides it via hideInClips.
    { id: 'food', parent: 'head', x: 19, y: 6, z: 3,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 3, ry: 2.5, fill: { color: BERRY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit'] },
    { id: 'earL', parent: 'head', x: -8, y: -9, z: -1,
      shapes: [
        { kind: 'ellipse', x: -3, y: -8, rx: 5, ry: 10, fill: { color: COAT } },
        { kind: 'ellipse', x: -3, y: -7, rx: 2.4, ry: 6, fill: { color: 0xe9c9d4, alpha: 0.85 } },
      ] },
    { id: 'earR', parent: 'head', x: 2, y: -11, z: -2,
      shapes: [
        { kind: 'ellipse', x: 2, y: -8, rx: 5, ry: 10, fill: { color: COAT_DARK } },
        { kind: 'ellipse', x: 2, y: -7, rx: 2.4, ry: 6, fill: { color: 0xe9c9d4, alpha: 0.85 } },
      ] },
  ],
  stages: {
    baby: {
      scale: 0.45, // a wobbly fawn
      partScale: {
        head: { x: 1.3, y: 1.3 },
        neck: { x: 0.9, y: 0.8 },
        legBB: { x: 1, y: 0.85 }, legBF: { x: 1, y: 0.85 },
        legFB: { x: 1, y: 0.85 }, legFF: { x: 1, y: 0.85 },
      },
    },
    juvenile: { scale: 0.72, partScale: { head: { x: 1.1, y: 1.1 }, spots: { x: 0.6, y: 0.6 } } },
    adult: { scale: 1, partScale: { spots: { x: 0, y: 0 } } }, // spots fade with age
    elder: { scale: 0.97, tint: 0xcfcac2, partScale: { spots: { x: 0, y: 0 } } },
  },
  clips: {
    idle: {
      durationMs: 2600,
      tracks: [
        { partId: 'earL', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0 }, { t: 0.48, v: 0.35 }, { t: 0.56, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.7, v: 0 }, { t: 0.78, v: 0.5 }, { t: 0.86, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.06 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 640,
      tracks: [
        { partId: 'legBB', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'legBF', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFB', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFF', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
      ],
    },
    sleep: {
      durationMs: 3800,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 10 }, { t: 1, v: 10 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.91 }, { t: 1, v: 0.95 }] },
      ],
    },
    eat: {
      durationMs: 1400,
      tracks: [
        { partId: 'neck', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 1.05 }, { t: 0.6, v: 1.05 }, { t: 0.8, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1100,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.25 }, { t: 0.6, v: 0.15 }, { t: 1, v: 0 }] },
        { partId: 'earL', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
        { partId: 'earR', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0 }] },
      ],
    },
    carry: {
      // Fetching food home: head carried low the whole way (M9 task 5's
      // "deer head-low carry"), legs still striding underneath.
      durationMs: 640,
      tracks: [
        { partId: 'legBB', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'legBF', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFB', rot: [{ t: 0, v: -0.3 }, { t: 0.5, v: 0.3 }, { t: 1, v: -0.3 }] },
        { partId: 'legFF', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0.3 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
        { partId: 'neck', rot: [{ t: 0, v: 0.35 }, { t: 1, v: 0.35 }] },
      ],
    },
    sit: {
      // Settled to brood: a gentle squash (M9 task 5).
      durationMs: 1000,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: the neck lowers
      // toward a ground-level meeting point — a gentle lean, well short of
      // 'eat''s full 1.05 rad graze — and holds while the fawn arrives
      // (M12 task 2).
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
      ],
    },
    feedTake: {
      // Played by the baby (fawn) during a feeding interaction: the neck
      // stretches up beyond its resting height to meet the parent's lowered
      // head partway — the mirror image of 'feedGive' (M12 task 2).
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
      ],
    },
  },
};
