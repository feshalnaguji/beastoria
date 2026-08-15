/**
 * The koi rig: cream body with warm orange patches, translucent fins,
 * a slow easy tail. Side view facing +x; origin at body center — koi
 * float in the pond, so the shadow is a soft deep-water blur.
 */
import type { CreatureRig } from './format';

const BODY = 0xf2ede2;
const ORANGE = 0xe07a3f;
const FIN = 0xf5c9a5;

export const koiRig: CreatureRig = {
  species: 'koi',
  strideLength: 40,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 7, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 18, ry: 6, fill: { color: 0x2f6a78, alpha: 0.35 } }] },
    { id: 'body', parent: null, x: 0, y: 0, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 20, ry: 9, fill: { color: BODY } },
        { kind: 'circle', x: 13, y: -1.5, r: 2, fill: { color: 0x2a2a2a } }, // eye
      ] },
    { id: 'patch', parent: 'body', x: 0, y: 0, z: 1,
      shapes: [
        { kind: 'ellipse', x: 4, y: -3, rx: 7, ry: 4.5, fill: { color: ORANGE, alpha: 0.95 } },
        { kind: 'circle', x: -8, y: 2, r: 4, fill: { color: ORANGE, alpha: 0.9 } },
      ] },
    { id: 'dorsal', parent: 'body', x: -2, y: -8, z: -1,
      shapes: [{ kind: 'path', d: 'M -6 0 Q 0 -7 8 -1 Z', fill: { color: FIN, alpha: 0.85 } }] },
    { id: 'pectoral', parent: 'body', x: 4, y: 6, z: 1,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 4, ry: 6, fill: { color: FIN, alpha: 0.7 } }] },
    { id: 'tailFin', parent: 'body', x: -19, y: 0, z: -2,
      shapes: [{ kind: 'path', d: 'M 0 0 L -14 -9 L -9 0 L -14 9 Z', fill: { color: FIN, alpha: 0.9 } }] },
  ],
  stages: {
    baby: { scale: 0.45, partScale: { tailFin: { x: 1.2, y: 1.2 } } }, // fry: mostly tail
    juvenile: { scale: 0.7 },
    adult: { scale: 1 },
    elder: { scale: 0.97, tint: 0xdcdce2 },
  },
  clips: {
    idle: {
      durationMs: 2600, // lazy fanning
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.22 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.22 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.3 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 700, // swimming
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.55 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.55 }, { t: 1, v: 0 }] },
        { partId: 'body', sx: [{ t: 0, v: 1 }, { t: 0.25, v: 0.97 }, { t: 0.5, v: 1 }, { t: 0.75, v: 0.97 }, { t: 1, v: 1 }] },
        { partId: 'dorsal', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0 }] },
      ],
    },
    sleep: {
      durationMs: 4200, // resting in the shallows, barely a ripple
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.1 }, { t: 1, v: 0 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.5, v: 1.5 }, { t: 1, v: 0 }] },
      ],
    },
    eat: {
      durationMs: 800, // surface gulps
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.3, v: -0.18 }, { t: 0.6, v: 0 }, { t: 1, v: 0 }],
          sx: [{ t: 0, v: 1 }, { t: 0.35, v: 1.05 }, { t: 0.5, v: 1 }, { t: 1, v: 1 }] },
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.25, v: 0.4 }, { t: 0.5, v: 0 }, { t: 0.75, v: -0.4 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 600, // excited circling flicks
      tracks: [
        { partId: 'tailFin', rot: [{ t: 0, v: 0 }, { t: 0.2, v: 0.6 }, { t: 0.5, v: -0.6 }, { t: 0.8, v: 0.4 }, { t: 1, v: 0 }] },
        { partId: 'pectoral', rot: [{ t: 0, v: 0 }, { t: 0.5, v: 0.5 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
