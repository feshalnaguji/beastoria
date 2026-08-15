/**
 * The turtle rig: a low, wide domed shell over four stub legs, a small
 * patient head, a tiny tail nub. Side view facing +x; origin at ground
 * contact under the shell. Built low and wide rather than tall (M10 task 3)
 * — the valley's slowest, most serene silhouette.
 */
import type { CreatureRig } from './format';

const SHELL = 0x5f7a4a;
const SHELL_DARK = 0x4a6238;
const SHELL_RIM = 0x8a9a5e;
const SKIN = 0x8fa86a;
const FLY = 0x4a4441;

export const turtleRig: CreatureRig = {
  species: 'turtle',
  strideLength: 10, // a slow leg-paddle, not a stride
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 14,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 24, ry: 7, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: 6,
      z: 0,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 18, ry: 6, fill: { color: SKIN } }],
    },
    {
      id: 'legBB',
      parent: 'body',
      x: -13,
      y: 3,
      z: -2,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 5, ry: 4, fill: { color: SKIN } }],
    },
    {
      id: 'legBF',
      parent: 'body',
      x: -9,
      y: 4,
      z: 2,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 5, ry: 4, fill: { color: SKIN } }],
    },
    {
      id: 'legFB',
      parent: 'body',
      x: 9,
      y: 3,
      z: -2,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 5, ry: 4, fill: { color: SKIN } }],
    },
    {
      id: 'legFF',
      parent: 'body',
      x: 13,
      y: 4,
      z: 2,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 5, ry: 4, fill: { color: SKIN } }],
    },
    {
      id: 'tail',
      parent: 'body',
      x: -18,
      y: 0,
      z: -1,
      shapes: [{ kind: 'ellipse', x: -2, y: 2, rx: 4, ry: 2.6, fill: { color: SKIN } }],
    },
    {
      id: 'shell',
      parent: 'body',
      x: 0,
      y: -6,
      z: 3,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 22, ry: 13, fill: { color: SHELL } },
        { kind: 'ellipse', x: 0, y: -3, rx: 16, ry: 9, fill: { color: SHELL_DARK, alpha: 0.7 } },
        { kind: 'ellipse', x: -7, y: -2, rx: 4, ry: 3, fill: { color: SHELL_RIM, alpha: 0.55 } },
        { kind: 'ellipse', x: 3, y: -4, rx: 4, ry: 3, fill: { color: SHELL_RIM, alpha: 0.55 } },
        { kind: 'ellipse', x: 9, y: 0, rx: 4, ry: 3, fill: { color: SHELL_RIM, alpha: 0.55 } },
      ],
    },
    {
      id: 'head',
      parent: 'body',
      x: 17,
      y: -2,
      z: 4,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 8, ry: 6, fill: { color: SKIN } },
        { kind: 'circle', x: 5, y: -1.5, r: 1.6, fill: { color: 0x201c1a } },
      ],
    },
    {
      // A morsel carried home, though turtles are self-feeding (feedMode
      // 'self') — this exists only for the compile-enforced clip set, never
      // triggered in play, matching koi/frog's food part (M10 task 3).
      id: 'food',
      parent: 'head',
      x: 8,
      y: 1,
      z: 5,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 1.8, ry: 1.4, fill: { color: FLY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'swim', 'sit'],
    },
  ],
  stages: {
    baby: {
      scale: 0.45,
      partScale: { shell: { x: 1.1, y: 1.1 }, head: { x: 1.2, y: 1.2 } },
      tint: 0xa8bd80, // paler hatchling green
    },
    juvenile: { scale: 0.7, partScale: { head: { x: 1.05, y: 1.05 } } },
    adult: { scale: 1 },
    elder: { scale: 1.02, tint: 0xc4c4b0 }, // ancient, faintly silvered
  },
  clips: {
    idle: {
      // A slow blink and a settle — nothing hurries a turtle.
      durationMs: 2800,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'shell',
          py: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.6 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // A slow leg-paddle: opposite corners swing together, glacially.
      durationMs: 1100,
      tracks: [
        {
          partId: 'legFF',
          rot: [
            { t: 0, v: 0.35 },
            { t: 0.5, v: -0.35 },
            { t: 1, v: 0.35 },
          ],
        },
        {
          partId: 'legBB',
          rot: [
            { t: 0, v: 0.35 },
            { t: 0.5, v: -0.35 },
            { t: 1, v: 0.35 },
          ],
        },
        {
          partId: 'legFB',
          rot: [
            { t: 0, v: -0.35 },
            { t: 0.5, v: 0.35 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          partId: 'legBF',
          rot: [
            { t: 0, v: -0.35 },
            { t: 0.5, v: 0.35 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          partId: 'shell',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -1.5 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -1.5 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    sleep: {
      durationMs: 4000,
      tracks: [
        {
          partId: 'head',
          px: [
            { t: 0, v: -6 },
            { t: 1, v: -6 },
          ],
          rot: [
            { t: 0, v: -0.15 },
            { t: 1, v: -0.15 },
          ],
        },
        {
          partId: 'shell',
          sy: [
            { t: 0, v: 0.95 },
            { t: 0.5, v: 0.92 },
            { t: 1, v: 0.95 },
          ],
        },
      ],
    },
    eat: {
      // A slow bite at pond-edge greens.
      durationMs: 1100,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.4 },
            { t: 0.65, v: 0.4 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 3 },
            { t: 0.65, v: 3 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    social: {
      durationMs: 1400,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: -0.12 },
            { t: 0.7, v: 0.08 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    swim: {
      // Buoyant paddling — the shell rides high and level, legs sweep wide.
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
          partId: 'legFF',
          rot: [
            { t: 0, v: 0.5 },
            { t: 0.5, v: -0.5 },
            { t: 1, v: 0.5 },
          ],
        },
        {
          partId: 'legBB',
          rot: [
            { t: 0, v: -0.5 },
            { t: 0.5, v: 0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'legFB',
          rot: [
            { t: 0, v: -0.5 },
            { t: 0.5, v: 0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'legBF',
          rot: [
            { t: 0, v: 0.5 },
            { t: 0.5, v: -0.5 },
            { t: 1, v: 0.5 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a morsel home: the same slow paddle (M10 task 3).
      durationMs: 1100,
      tracks: [
        { partId: 'legFF', rot: [{ t: 0, v: 0.35 }, { t: 0.5, v: -0.35 }, { t: 1, v: 0.35 }] },
        { partId: 'legBB', rot: [{ t: 0, v: 0.35 }, { t: 0.5, v: -0.35 }, { t: 1, v: 0.35 }] },
        { partId: 'legFB', rot: [{ t: 0, v: -0.35 }, { t: 0.5, v: 0.35 }, { t: 1, v: -0.35 }] },
        { partId: 'legBF', rot: [{ t: 0, v: -0.35 }, { t: 0.5, v: 0.35 }, { t: 1, v: -0.35 }] },
        { partId: 'head', rot: [{ t: 0, v: 0.15 }, { t: 0.5, v: 0.25 }, { t: 1, v: 0.15 }] },
      ],
    },
    sit: {
      // Settled at the sand nest: a gentle squash (M10 task 3).
      durationMs: 1200,
      tracks: [
        { partId: 'shell', sy: [{ t: 0, v: 0.88 }, { t: 1, v: 0.88 }], py: [{ t: 0, v: 2 }, { t: 1, v: 2 }] },
      ],
    },
  },
};
