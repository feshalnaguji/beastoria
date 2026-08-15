/**
 * The rabbit rig: soft cream fur, blush inner ears, cotton tail.
 * Side view facing +x; origin at ground contact under the body.
 */
import type { CreatureRig } from './format';

const FUR = 0xe8dcc8;
const FUR_DARK = 0xd9cbb2;
const CREAM = 0xfaf6ee;
const BLUSH = 0xf2d8e4;

export const rabbitRig: CreatureRig = {
  species: 'rabbit',
  strideLength: 26,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 26,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 30, ry: 9, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        { kind: 'roundRect', x: -32, y: -14, w: 62, h: 40, r: 20, fill: { color: FUR } },
        { kind: 'ellipse', x: 2, y: 12, rx: 22, ry: 12, fill: { color: CREAM, alpha: 0.8 } },
      ],
    },
    {
      id: 'tail',
      parent: 'body',
      x: -30,
      y: 4,
      z: -2,
      shapes: [{ kind: 'circle', x: 0, y: 0, r: 11, fill: { color: CREAM } }],
    },
    {
      id: 'legB',
      parent: 'body',
      x: -16,
      y: 22,
      z: -1,
      shapes: [{ kind: 'ellipse', x: 0, y: 4, rx: 9, ry: 11, fill: { color: FUR_DARK } }],
    },
    {
      id: 'legF',
      parent: 'body',
      x: 14,
      y: 22,
      z: 1,
      shapes: [{ kind: 'ellipse', x: 0, y: 4, rx: 7, ry: 10, fill: { color: FUR_DARK } }],
    },
    {
      id: 'head',
      parent: 'body',
      x: 26,
      y: -14,
      z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 17, fill: { color: FUR } },
        { kind: 'circle', x: 5, y: -2, r: 2.6, fill: { color: 0x3a3230 } },
        { kind: 'ellipse', x: 16, y: 2, rx: 3.5, ry: 2.5, fill: { color: 0xd9a5b5 } },
      ],
    },
    {
      id: 'earL',
      parent: 'head',
      x: -8,
      y: -13,
      z: -1,
      shapes: [
        { kind: 'ellipse', x: 0, y: -12, rx: 6, ry: 17, fill: { color: FUR } },
        { kind: 'ellipse', x: 0, y: -11, rx: 3, ry: 11, fill: { color: BLUSH, alpha: 0.85 } },
      ],
    },
    {
      id: 'earR',
      parent: 'head',
      x: 6,
      y: -14,
      z: -2,
      shapes: [
        { kind: 'ellipse', x: 0, y: -13, rx: 6, ry: 18, fill: { color: FUR } },
        { kind: 'ellipse', x: 0, y: -12, rx: 3, ry: 12, fill: { color: BLUSH, alpha: 0.85 } },
      ],
    },
  ],
  stages: {
    baby: {
      scale: 0.5,
      partScale: {
        head: { x: 1.3, y: 1.3 }, // big head
        earL: { x: 1, y: 0.55 }, // kits have short ears
        earR: { x: 1, y: 0.55 },
        legB: { x: 1, y: 0.8 },
        legF: { x: 1, y: 0.8 },
      },
    },
    juvenile: { scale: 0.75, partScale: { head: { x: 1.1, y: 1.1 } } },
    adult: { scale: 1 },
    elder: { scale: 0.95, tint: 0xc9c9ce }, // gentle silvering
  },
  clips: {
    idle: {
      durationMs: 2200,
      tracks: [
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.42, v: 0 },
            { t: 0.5, v: 0.3 },
            { t: 0.58, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.7, v: 0.05 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      durationMs: 480,
      tracks: [
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.5 },
            { t: 0.5, v: -0.5 },
            { t: 1, v: 0.5 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: -0.5 },
            { t: 0.5, v: 0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -4 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.12 },
            { t: 1, v: -0.12 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
      ],
    },
    sleep: {
      durationMs: 3200,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.92 },
            { t: 0.5, v: 0.87 },
            { t: 1, v: 0.92 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.35 },
            { t: 1, v: 0.35 },
          ],
          py: [
            { t: 0, v: 7 },
            { t: 1, v: 7 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.55 },
            { t: 1, v: -0.55 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.65 },
            { t: 1, v: -0.65 },
          ],
        },
      ],
    },
    eat: {
      durationMs: 950,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.6 },
            { t: 0.6, v: 0.6 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 5 },
            { t: 0.6, v: 5 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      durationMs: 1300,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.18 },
            { t: 0.6, v: 0.1 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.25 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.25 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
