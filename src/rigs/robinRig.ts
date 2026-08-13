/**
 * The American robin rig: warm grey-brown back, rusty-orange breast, white
 * eye ring, cheerful yellow beak. Side view facing +x; origin at the feet.
 */
import type { CreatureRig } from './format';

const BACK = 0x5a5350;
const BACK_DARK = 0x4a4441;
const BREAST = 0xd2694a;
const BEAK = 0xe8a53c;

export const robinRig: CreatureRig = {
  species: 'robin',
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 2,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 16, ry: 5, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'legB',
      parent: null,
      x: -4,
      y: 0,
      z: -2,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: -1, y2: -10, width: 2.2, fill: { color: 0x8a6f4d } }],
    },
    {
      id: 'legF',
      parent: null,
      x: 3,
      y: 0,
      z: -1,
      shapes: [{ kind: 'line', x1: 0, y1: 0, x2: 1, y2: -10, width: 2.2, fill: { color: 0x8a6f4d } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: -18,
      z: 0,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 16, ry: 13, fill: { color: BACK } },
        { kind: 'ellipse', x: 6, y: 4, rx: 10, ry: 9, fill: { color: BREAST } },
      ],
    },
    {
      id: 'tail',
      parent: 'body',
      x: -13,
      y: -3,
      z: -1,
      shapes: [{ kind: 'ellipse', x: -8, y: -2, rx: 11, ry: 4, fill: { color: BACK_DARK } }],
    },
    {
      id: 'wing',
      parent: 'body',
      x: -3,
      y: -2,
      z: 1,
      shapes: [{ kind: 'ellipse', x: -3, y: 3, rx: 10, ry: 7, fill: { color: BACK_DARK } }],
    },
    {
      id: 'head',
      parent: 'body',
      x: 12,
      y: -9,
      z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 9.5, fill: { color: 0x4f4744 } },
        { kind: 'circle', x: 3.5, y: -2, r: 2.8, fill: { color: 0xf5f2ea } }, // eye ring
        { kind: 'circle', x: 3.5, y: -2, r: 1.9, fill: { color: 0x201c1a } },
      ],
    },
    {
      id: 'beak',
      parent: 'head',
      x: 8,
      y: 0,
      z: 1,
      shapes: [{ kind: 'path', d: 'M 0 -2 L 9 0.5 L 0 3 Z', fill: { color: BEAK } }],
    },
  ],
  stages: {
    baby: {
      scale: 0.55,
      partScale: {
        head: { x: 1.3, y: 1.3 },
        beak: { x: 1.25, y: 1.25 }, // gape-y chick beak
        tail: { x: 0.5, y: 0.8 }, // stubby chick tail
      },
      tint: 0xd8c9a8, // downy brown fluff
    },
    juvenile: { scale: 0.8, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xcdc8c3 },
  },
  clips: {
    idle: {
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
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // Robins hop!
      durationMs: 380,
      tracks: [
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -6 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'wing',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.1 },
            { t: 0.5, v: -0.1 },
            { t: 1, v: 0.1 },
          ],
        },
      ],
    },
    sleep: {
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
        },
      ],
    },
    eat: {
      // Peck-peck.
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
          partId: 'body',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.15 },
            { t: 0.6, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
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
            { t: 0.5, v: -0.15 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
