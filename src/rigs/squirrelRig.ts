/**
 * The squirrel rig: russet fur, cream belly, a big plume tail held high.
 * Side view facing +x; origin at ground contact under the body. Built from
 * the rabbit's quadruped structure (M10 task 3), but leaner and perkier.
 */
import type { CreatureRig } from './format';

const FUR = 0xb87a4a;
const FUR_DARK = 0xa1653a;
const CREAM = 0xf2e6d0;
const NUT = 0x8a6f4d;

export const squirrelRig: CreatureRig = {
  species: 'squirrel',
  strideLength: 20,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 20,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 22, ry: 7, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: 0,
      z: 0,
      shapes: [
        { kind: 'roundRect', x: -22, y: -12, w: 42, h: 28, r: 14, fill: { color: FUR } },
        { kind: 'ellipse', x: 3, y: 8, rx: 15, ry: 8, fill: { color: CREAM, alpha: 0.85 } },
      ],
    },
    {
      id: 'tail',
      parent: 'body',
      x: -20,
      y: -4,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M 0 4 Q -20 -8 -10 -34 Q 4 -30 6 -10 Q 8 0 0 4 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -2 0 Q -14 -10 -8 -28 Q -1 -25 -1 -8 Z', fill: { color: CREAM, alpha: 0.6 } },
      ],
    },
    {
      id: 'legB',
      parent: 'body',
      x: -11,
      y: 15,
      z: -1,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 6, ry: 8, fill: { color: FUR_DARK } }],
    },
    {
      id: 'legF',
      parent: 'body',
      x: 10,
      y: 15,
      z: 1,
      shapes: [{ kind: 'ellipse', x: 0, y: 3, rx: 5, ry: 7, fill: { color: FUR_DARK } }],
    },
    {
      id: 'head',
      parent: 'body',
      x: 19,
      y: -10,
      z: 2,
      shapes: [
        { kind: 'circle', x: 0, y: 0, r: 12, fill: { color: FUR } },
        { kind: 'circle', x: 6, y: -1, r: 2.2, fill: { color: 0x2a2220 } },
        { kind: 'ellipse', x: 10, y: 3, rx: 3, ry: 2, fill: { color: 0x5a3f2a } }, // nose
      ],
    },
    {
      // An acorn carried home to the kits (M10 task 3) — only ever visible
      // during the 'carry' clip; every other clip hides it via hideInClips.
      id: 'food',
      parent: 'head',
      x: 11,
      y: 4,
      z: 3,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 3, fill: { color: NUT } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit', 'feedGive', 'feedTake'],
    },
    {
      id: 'earL',
      parent: 'head',
      x: -3,
      y: -9,
      z: -1,
      shapes: [{ kind: 'path', d: 'M 0 0 L -3 -8 L 4 -5 Z', fill: { color: FUR_DARK } }],
    },
    {
      id: 'earR',
      parent: 'head',
      x: 4,
      y: -10,
      z: -2,
      shapes: [{ kind: 'path', d: 'M 0 0 L -2 -9 L 5 -5 Z', fill: { color: FUR_DARK } }],
    },
  ],
  stages: {
    baby: {
      scale: 0.5,
      partScale: {
        head: { x: 1.3, y: 1.3 },
        tail: { x: 0.6, y: 0.6 }, // kits don't have the full plume yet
        earL: { x: 0.8, y: 0.8 },
        earR: { x: 0.8, y: 0.8 },
      },
    },
    juvenile: { scale: 0.72, partScale: { head: { x: 1.1, y: 1.1 }, tail: { x: 0.85, y: 0.85 } } },
    adult: { scale: 1 },
    elder: { scale: 0.94, tint: 0xc9bdae },
  },
  clips: {
    idle: {
      // Quick, alert little pauses — a look-around, not a settle.
      durationMs: 1100,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.2 },
            { t: 0.55, v: 0.15 },
            { t: 0.8, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.12 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // A darting bound, not a stride.
      durationMs: 340,
      tracks: [
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.6 },
            { t: 0.5, v: -0.6 },
            { t: 1, v: 0.6 },
          ],
        },
        {
          partId: 'legB',
          rot: [
            { t: 0, v: -0.6 },
            { t: 0.5, v: 0.6 },
            { t: 1, v: -0.6 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.25, v: -6 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -6 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.15 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: -0.15 },
          ],
        },
      ],
    },
    sleep: {
      durationMs: 3000,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.9 },
            { t: 0.5, v: 0.86 },
            { t: 1, v: 0.9 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.5 },
            { t: 1, v: 0.5 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.3 },
            { t: 1, v: 0.3 },
          ],
          py: [
            { t: 0, v: 5 },
            { t: 1, v: 5 },
          ],
        },
      ],
    },
    eat: {
      // Nibbling an acorn held in both paws.
      durationMs: 700,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.5 },
            { t: 0.6, v: 0.5 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.3, v: 3 },
            { t: 0.6, v: 3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.2 },
            { t: 1, v: 0.2 },
          ],
        },
      ],
    },
    social: {
      durationMs: 800,
      tracks: [
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.25, v: 0.3 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: 0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: -0.15 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: -0.15 },
          ],
        },
      ],
    },
    carry: {
      // Fetching an acorn home: the same bound, head tucked low (M10 task 3).
      durationMs: 340,
      tracks: [
        { partId: 'legF', rot: [{ t: 0, v: 0.6 }, { t: 0.5, v: -0.6 }, { t: 1, v: 0.6 }] },
        { partId: 'legB', rot: [{ t: 0, v: -0.6 }, { t: 0.5, v: 0.6 }, { t: 1, v: -0.6 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.25, v: -6 }, { t: 0.5, v: 0 }, { t: 0.75, v: -6 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.15 }, { t: 0.5, v: 0.15 }, { t: 1, v: -0.15 }] },
        { partId: 'head', rot: [{ t: 0, v: 0.35 }, { t: 0.5, v: 0.45 }, { t: 1, v: 0.35 }] },
      ],
    },
    sit: {
      // Settled to nurse: a gentle squash (M10 task 3).
      durationMs: 1000,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0.3 }, { t: 1, v: 0.3 }] },
      ],
    },
    feedGive: {
      // Played by the mother during a feeding interaction: a gentle downward
      // lean of the head toward the kits — shallower than 'eat's graze dip
      // (rot 0.5/py 3) and held, not bouncy, since this is nursing rather
      // than nibbling (M13 task 12, modelled on rabbitRig.ts feedGive). The
      // squirrel has no `muzzle` part, so the secondary flourish the rabbit
      // gives its nose goes to `tail` instead — the plume settles into a
      // raised, held curl while she nurses.
      durationMs: 900,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.3 },
            { t: 0.65, v: 0.3 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 2 },
            { t: 0.65, v: 2 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.3 },
            { t: 0.35, v: 0.55 },
            { t: 0.65, v: 0.55 },
            { t: 1, v: 0.3 },
          ],
        },
      ],
    },
    feedTake: {
      // Played by the kit during a feeding interaction: the head stretches
      // up from its (stage-scaled) resting height to meet the mother partway
      // — the mirror of 'feedGive' (M13 task 12, modelled on rabbitRig.ts
      // feedTake). The tail carries the kit's eagerness instead of a
      // muzzle-nibble: a quick, low double-flick rather than the mother's
      // held curl.
      durationMs: 850,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.3 },
            { t: 0.65, v: -0.3 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -3 },
            { t: 0.65, v: -3 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.3 },
            { t: 0.38, v: 0 },
            { t: 0.46, v: -0.3 },
            { t: 0.54, v: 0 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
