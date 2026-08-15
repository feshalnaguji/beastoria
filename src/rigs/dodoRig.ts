/**
 * The dodo rig: plump blue-grey wanderer with a grand hooked beak, tiny
 * hopeful winglet, and a puff of tail plumes. Side view facing +x.
 */
import type { CreatureRig } from './format';

const GREY = 0x9aa0a8;
const GREY_LIGHT = 0xbcc2c8;
const GREY_DARK = 0x848b94;
const BEAK = 0xc9b06a;

export const dodoRig: CreatureRig = {
  species: 'dodo',
  strideLength: 26,
  parts: [
    { id: 'shadow', parent: null, x: 0, y: 2, z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 22, ry: 6.5, fill: { color: 0x3d5a2e, alpha: 0.25 } }] },
    { id: 'body', parent: null, x: 0, y: -24, z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 20, ry: 15, fill: { color: GREY } },
        { kind: 'ellipse', x: 5, y: 5, rx: 12, ry: 9, fill: { color: GREY_LIGHT } },
      ] },
    // Parented to body (was root-level); offset = old root offset minus
    // body's base offset (0, -24), so the resting pose is unchanged.
    { id: 'legB', parent: 'body', x: -5, y: 24, z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -2, y2: -11, width: 3.6, fill: { color: 0xd9b13f } }] },
    { id: 'legF', parent: 'body', x: 4, y: 24, z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 2, y2: -11, width: 3.6, fill: { color: 0xd9b13f } }] },
    { id: 'tailPlume', parent: 'body', x: -17, y: -7, z: -1,
      shapes: [
        { kind: 'circle', x: -3, y: -2, r: 5, fill: { color: 0xd8d3c4 } },
        { kind: 'circle', x: -7, y: 1, r: 4, fill: { color: 0xcfc9b8 } },
        { kind: 'circle', x: -2, y: 3, r: 3.6, fill: { color: 0xd8d3c4 } },
      ] },
    { id: 'winglet', parent: 'body', x: -3, y: 0, z: 1,
      shapes: [{ kind: 'ellipse', x: -1, y: 2, rx: 6, ry: 4, fill: { color: GREY_DARK } }] },
    { id: 'head', parent: 'body', x: 15, y: -16, z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 10, fill: { color: 0x8d939c } },
        { kind: 'ellipse', x: 4, y: -1, rx: 5, ry: 4, fill: { color: 0xd6c9a8 } }, // bare face
        { kind: 'circle', x: 2, y: -3, r: 2.2, fill: { color: 0x2a2622 } },
      ] },
    { id: 'beak', parent: 'head', x: 8, y: -1, z: 1,
      shapes: [
        { kind: 'path', d: 'M 0 -3 L 11 -2.5 Q 15 0 11 3.5 L 0 4 Z', fill: { color: BEAK } },
        { kind: 'circle', x: 12, y: 0.5, r: 2.2, fill: { color: 0x8a7440 } }, // hooked tip
      ] },
  ],
  stages: {
    baby: { scale: 0.5, partScale: { head: { x: 1.3, y: 1.3 }, beak: { x: 0.6, y: 0.6 }, tailPlume: { x: 0.5, y: 0.5 } }, tint: 0xcfd2c9 },
    juvenile: { scale: 0.78, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.96, tint: 0xc7c9cd },
  },
  clips: {
    idle: {
      durationMs: 2400,
      tracks: [
        { partId: 'tailPlume', rot: [{ t: 0, v: 0 }, { t: 0.4, v: 0 }, { t: 0.5, v: 0.25 }, { t: 0.62, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.12 }, { t: 0.55, v: -0.1 }, { t: 1, v: 0 }] },
      ],
    },
    walk: {
      durationMs: 680, // the famous waddle
      tracks: [
        { partId: 'body', rot: [{ t: 0, v: 0.15 }, { t: 0.5, v: -0.15 }, { t: 1, v: 0.15 }],
          py: [{ t: 0, v: 0 }, { t: 0.25, v: -2 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2 }, { t: 1, v: 0 }] },
        { partId: 'head', rot: [{ t: 0, v: -0.08 }, { t: 0.5, v: 0.08 }, { t: 1, v: -0.08 }] },
        { partId: 'tailPlume', rot: [{ t: 0, v: -0.15 }, { t: 0.5, v: 0.15 }, { t: 1, v: -0.15 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.4 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0.4 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.4 }, { t: 0.5, v: 0.4 }, { t: 1, v: -0.4 }] },
      ],
    },
    sleep: {
      durationMs: 3800,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: -0.5 }, { t: 1, v: -0.5 }], px: [{ t: 0, v: -5 }, { t: 1, v: -5 }], py: [{ t: 0, v: 5 }, { t: 1, v: 5 }] },
        { partId: 'body', sy: [{ t: 0, v: 0.94 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.94 }] },
      ],
    },
    eat: {
      durationMs: 760,
      tracks: [
        { partId: 'head', rot: [{ t: 0, v: 0 }, { t: 0.3, v: 0.7 }, { t: 0.5, v: 0.7 }, { t: 0.68, v: 0 }, { t: 0.82, v: 0.35 }, { t: 1, v: 0 }] },
        { partId: 'body', rot: [{ t: 0, v: 0 }, { t: 0.35, v: 0.12 }, { t: 0.65, v: 0 }, { t: 1, v: 0 }] },
      ],
    },
    social: {
      durationMs: 950, // happy little winglet flaps
      tracks: [
        { partId: 'winglet', rot: [{ t: 0, v: 0 }, { t: 0.2, v: -0.6 }, { t: 0.4, v: 0 }, { t: 0.6, v: -0.6 }, { t: 0.8, v: 0 }, { t: 1, v: 0 }] },
        { partId: 'head', py: [{ t: 0, v: 0 }, { t: 0.25, v: -2.5 }, { t: 0.5, v: 0 }, { t: 0.75, v: -2.5 }, { t: 1, v: 0 }] },
      ],
    },
  },
};
