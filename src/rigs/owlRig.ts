/**
 * The owl rig: round tawny body, cream facial disc, deep amber-ringed eyes,
 * little ear tufts. Side view facing +x; origin at the feet.
 */
import type { CreatureRig } from './format';

const TAWNY = 0xa08058;
const TAWNY_DARK = 0x8a6c48;
const DISC = 0xefe4cc;

export const owlRig: CreatureRig = {
  species: 'owl',
  strideLength: 20,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 16, ry: 5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'body', parent: null, x: 0, y: -22, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 15, ry: 17, fill: { color: TAWNY } },
        { kind: 'ellipse', x: 3, y: 5, rx: 9, ry: 11, fill: { color: 0xe3d5b8 } },
        { kind: 'ellipse', x: 3, y: 2, rx: 6, ry: 3, fill: { color: TAWNY_DARK, alpha: 0.4 } }, // breast bars
        { kind: 'ellipse', x: 3, y: 8, rx: 6, ry: 3, fill: { color: TAWNY_DARK, alpha: 0.35 } },
      ] },
    // Parented to body (was root-level); offset = old root offset minus
    // body's base offset (0, -22), so the resting pose is unchanged.
    { id: 'legB', parent: 'body', x: -4, y: 22, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -1, y2: -7, width: 2.4, fill: { color: 0xc9a86a } }] },
    { id: 'legF', parent: 'body', x: 3, y: 22, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 1, y2: -7, width: 2.4, fill: { color: 0xc9a86a } }] },
    { id: 'tail', parent: 'body', x: -9, y: 13, z: -1,
      shapes: [{ kind: 'ellipse', x: -3, y: 3, rx: 6, ry: 9, fill: { color: TAWNY_DARK } }] },
    { id: 'wing', parent: 'body', x: -7, y: -2, z: 1,
      shapes: [{ kind: 'ellipse', x: -2, y: 4, rx: 8, ry: 13, fill: { color: TAWNY_DARK } }] },
    { id: 'head', parent: 'body', x: 3, y: -20, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 12, fill: { color: 0xa88a64 } },
        { kind: 'circle', x: -3, y: -1, r: 6.5, fill: { color: DISC } }, // facial disc
        { kind: 'circle', x: 5, y: -1, r: 6.5, fill: { color: DISC } },
        { kind: 'circle', x: -2, y: -1, r: 3.6, fill: { color: 0xd9a441 } }, // amber rings
        { kind: 'circle', x: 5, y: -1, r: 3.6, fill: { color: 0xd9a441 } },
        { kind: 'circle', x: -2, y: -1, r: 2.2, fill: { color: 0x241f1a } },
        { kind: 'circle', x: 5, y: -1, r: 2.2, fill: { color: 0x241f1a } },
      ] },
    { id: 'tuftL', parent: 'head', x: -9, y: -9, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q -3 -6 1 -8 Q 3 -3 3 2 Z', fill: { color: TAWNY_DARK } }] },
    { id: 'tuftR', parent: 'head', x: 6, y: -10, z: -1,
      shapes: [{ kind: 'path', d: 'M 0 2 Q 0 -6 4 -8 Q 5 -2 4 2 Z', fill: { color: TAWNY } }] },
    { id: 'beak', parent: 'head', x: 1.5, y: 2.5, z: 1,
      shapes: [{ kind: 'path', d: 'M -2 0 Q 0 5 2 0 Z', fill: { color: 0x6b5636 } }] },
  ],
  stages: {
    baby: { scale: 0.5, partScale: { head: { x: 1.25, y: 1.25 }, tuftL: { x: 0.4, y: 0.4 }, tuftR: { x: 0.4, y: 0.4 } }, tint: 0xd9cdb8 },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xcac4bd },
  },
  clips: {
    idle: {
      durationMs: 3000, // the slow owlish head-turn
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.3 }, { t: 0.45, v: -0.3 }, { t: 0.6, v: 0.25 }, { t: 0.8, v: 0.25 }, { t: 1, v: 0 }] },
        { partId: 'body', sy: [{ t: 0, v: 1 }, { t: 0.5, v: 0.985 }, { t: 1, v: 1 }] },
      ],
    },
    walk: {
      durationMs: 460,
      tracks: [
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: -4 }, { t: 1, v: 0 }], rot: [{ t: 0, v: 0.06 }, { t: 0.5, v: -0.06 }, { t: 1, v: 0.06 }] },
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.15 }, { t: 1, v: 0 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.25 }, { t: 0.5, v: -0.25 }, { t: 1, v: 0.25 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.25 }, { t: 0.5, v: 0.25 }, { t: 1, v: -0.25 }] },
      ],
    },
    sleep: {
      durationMs: 4000, // daytime roost
      tracks: [
        { partId: 'head', py: [{ t: 0, v: 5 }, { t: 1, v: 5 }], sy: [{ t: 0, v: 0.9 }, { t: 1, v: 0.9 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.95 }, { t: 0.5, v: 0.92 }, { t: 1, v: 0.95 }] },
      ],
    },
    eat: {
      durationMs: 700,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.6 }, { t: 0.5, v: 0.6 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.1 }, { t: 0.7, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 1000, // bobbing display
      tracks: [
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -3 }, { t: 0.5, v: 0 }, { t: 0.75, v: -3 }, { t: 1, v: 0 }] },
        { partId: 'wing', rot: [{ t: 0, v: 0 }, { t: 0.5, v: -0.35 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
