/**
 * The kangaroo rig: sandy grey-brown coat, cream belly and pouch lining,
 * a heavy ground-anchored tail. Side view facing +x; origin at ground
 * contact under the body. Built from the quadruped-hopper vocabulary
 * (M11), but the walk clip breaks from every other rig's alternating gait
 * — both hind legs tuck and swing together, a real bound, not a trot.
 */
import type { CreatureRig } from './format';

const FUR = 0x9c8468;
const FUR_DARK = 0x7c6a52;
const CREAM = 0xe9ddc4;
const POUCH = 0x6f5c46;
const POUCH_LINING = 0xd9c9a8;
const NOSE = 0x2e2620;
const BERRY = 0xcf5f52;

export const kangarooRig: CreatureRig = {
  species: 'kangaroo',
  strideLength: 40,
  parts: [
    {
      id: 'shadow',
      parent: null,
      x: 0,
      y: 30,
      z: -10,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 40, ry: 11, fill: { color: 0x3d5a2e, alpha: 0.25 } }],
    },
    {
      id: 'body',
      parent: null,
      x: 0,
      y: -20,
      z: 0,
      shapes: [
        { kind: 'roundRect', x: -28, y: -26, w: 66, h: 50, r: 24, fill: { color: FUR } },
        { kind: 'ellipse', x: 4, y: 16, rx: 22, ry: 13, fill: { color: CREAM, alpha: 0.8 } },
      ],
    },
    {
      // Always visible — part of her silhouette, not a carried item.
      // Anchor only, no shapes of its own (M12 task 5): split from one
      // drawn part into `pouchBack`/`pouchFront` below so a REAL riding
      // joey Creature — reparented here by the renderer (RigRenderer.ts's
      // `pouch` lookup) — can be z-sorted between them: the back wall
      // renders first, then the joey, then the near rim overlaps her lower
      // body, reading as genuinely tucked inside rather than floating on
      // top. Supersedes the decorative 'joey' rig part (M11), deleted.
      id: 'pouch',
      parent: 'body',
      x: 6,
      y: 20,
      z: 2,
      shapes: [],
    },
    {
      // The pouch's back wall.
      id: 'pouchBack',
      parent: 'pouch',
      x: 0,
      y: 0,
      z: 1,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 16, ry: 11, fill: { color: POUCH } }],
    },
    {
      // The near rim — drawn over whatever is riding inside (its zIndex
      // sits above the joey's, below this).
      id: 'pouchFront',
      parent: 'pouch',
      x: 0,
      y: -4,
      z: 3,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 12, ry: 6, fill: { color: POUCH_LINING, alpha: 0.75 } }],
    },
    {
      // Heavy and ground-anchored: it plants near the shadow, the third
      // leg of a kangaroo's tripod stance.
      id: 'tail',
      parent: 'body',
      x: -26,
      y: 12,
      z: -2,
      shapes: [
        { kind: 'path', d: 'M 0 0 Q -20 8 -24 32 Q -15 39 -4 34 Q 5 18 2 2 Q 1 -2 0 0 Z', fill: { color: FUR_DARK } },
        { kind: 'path', d: 'M -2 4 Q -14 12 -17 30 Q -12 32 -8 28 Q -2 16 -1 4 Z', fill: { color: CREAM, alpha: 0.4 } },
      ],
    },
    {
      // Big hind leg — the engine of the bound.
      id: 'legB',
      parent: 'body',
      x: -14,
      y: 20,
      z: -1,
      shapes: [
        { kind: 'ellipse', x: 0, y: 10, rx: 12, ry: 20, fill: { color: FUR_DARK } },
        { kind: 'ellipse', x: 8, y: 27, rx: 12, ry: 5.5, fill: { color: FUR_DARK } }, // long hind foot
      ],
    },
    {
      // Small forearm, held close to the chest.
      id: 'legF',
      parent: 'body',
      x: 15,
      y: 4,
      z: 1,
      shapes: [{ kind: 'ellipse', x: 3, y: 7, rx: 5, ry: 9, fill: { color: FUR_DARK } }],
    },
    {
      id: 'head',
      parent: 'body',
      x: 22,
      y: -20,
      z: 2,
      shapes: [
        { kind: 'ellipse', x: 0, y: 0, rx: 11, ry: 9, fill: { color: FUR } },
        { kind: 'ellipse', x: 10, y: 4, rx: 7, ry: 4, fill: { color: FUR } }, // elongated muzzle
        { kind: 'circle', x: 15, y: 5, r: 1.8, fill: { color: NOSE } },
        { kind: 'circle', x: 2, y: -3, r: 2, fill: { color: NOSE } }, // eye
      ],
    },
    {
      // A seed pod carried home to the joey (M11) — only ever visible
      // during the 'carry' clip; every other clip hides it via hideInClips.
      id: 'food',
      parent: 'head',
      x: 16,
      y: 6,
      z: 3,
      shapes: [{ kind: 'ellipse', x: 0, y: 0, rx: 2.6, ry: 2.2, fill: { color: BERRY } }],
      hideInClips: ['idle', 'walk', 'sleep', 'eat', 'social', 'sit'],
    },
    {
      id: 'earL',
      parent: 'head',
      x: -3,
      y: -8,
      z: -1,
      shapes: [
        { kind: 'ellipse', x: -3, y: -14, rx: 4, ry: 12, fill: { color: FUR } },
        { kind: 'ellipse', x: -3, y: -13, rx: 2, ry: 8, fill: { color: CREAM, alpha: 0.7 } },
      ],
    },
    {
      id: 'earR',
      parent: 'head',
      x: 3,
      y: -9,
      z: -2,
      shapes: [
        { kind: 'ellipse', x: 3, y: -15, rx: 4, ry: 13, fill: { color: FUR_DARK } },
        { kind: 'ellipse', x: 3, y: -14, rx: 2, ry: 9, fill: { color: CREAM, alpha: 0.65 } },
      ],
    },
  ],
  stages: {
    baby: {
      // A joey has no pouch of its own — the deer's spots trick.
      scale: 0.4,
      partScale: {
        head: { x: 1.35, y: 1.35 },
        earL: { x: 0.85, y: 0.7 },
        earR: { x: 0.85, y: 0.7 },
        legB: { x: 0.9, y: 0.8 },
        // Zeroing the anchor zeroes pouchBack/pouchFront with it (both are
        // its children) — a baby has no pouch of its own.
        pouch: { x: 0, y: 0 },
      },
    },
    juvenile: { scale: 0.7, partScale: { head: { x: 1.12, y: 1.12 } } },
    adult: { scale: 1 },
    elder: { scale: 0.97, tint: 0xc7c0b2 }, // gentle silvering
  },
  clips: {
    idle: {
      durationMs: 2400,
      tracks: [
        {
          partId: 'earL',
          rot: [
            { t: 0, v: 0 },
            { t: 0.4, v: 0 },
            { t: 0.48, v: 0.3 },
            { t: 0.56, v: 0 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.06 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.6, v: 0.06 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    walk: {
      // A strong single-beat bound: both hind legs tuck and swing together
      // (never alternating), the body punches up into the air, and the
      // heavy tail counter-swings against it (M11).
      durationMs: 600,
      tracks: [
        {
          partId: 'legB',
          rot: [
            { t: 0, v: 0.45 },
            { t: 0.4, v: -0.5 },
            { t: 0.55, v: -0.45 },
            { t: 1, v: 0.45 },
          ],
        },
        {
          partId: 'legF',
          rot: [
            { t: 0, v: 0.25 },
            { t: 0.4, v: -0.25 },
            { t: 0.55, v: -0.2 },
            { t: 1, v: 0.25 },
          ],
        },
        {
          partId: 'body',
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -20 },
            { t: 0.5, v: -24 },
            { t: 0.65, v: -20 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: -0.18 },
            { t: 0.5, v: 0.24 },
            { t: 1, v: -0.18 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.1 },
            { t: 1, v: -0.1 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.12 },
            { t: 1, v: -0.12 },
          ],
        },
      ],
    },
    sleep: {
      durationMs: 3600,
      tracks: [
        {
          partId: 'body',
          sy: [
            { t: 0, v: 0.92 },
            { t: 0.5, v: 0.88 },
            { t: 1, v: 0.92 },
          ],
        },
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0.4 },
            { t: 1, v: 0.4 },
          ],
          py: [
            { t: 0, v: 6 },
            { t: 1, v: 6 },
          ],
        },
        {
          partId: 'earL',
          rot: [
            { t: 0, v: -0.5 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          partId: 'earR',
          rot: [
            { t: 0, v: -0.6 },
            { t: 1, v: -0.6 },
          ],
        },
      ],
    },
    eat: {
      durationMs: 1200,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: 0.55 },
            { t: 0.65, v: 0.55 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: 4 },
            { t: 0.65, v: 4 },
            { t: 1, v: 0 },
          ],
        },
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0.15 },
            { t: 1, v: 0.15 },
          ],
        },
      ],
    },
    social: {
      durationMs: 1200,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.3, v: -0.2 },
            { t: 0.6, v: 0.12 },
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
        {
          partId: 'tail',
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
    carry: {
      // Fetching a seed pod home: the same bound, head tucked low (M11).
      durationMs: 600,
      tracks: [
        { partId: 'legB', rot: [{ t: 0, v: 0.45 }, { t: 0.4, v: -0.5 }, { t: 0.55, v: -0.45 }, { t: 1, v: 0.45 }] },
        { partId: 'legF', rot: [{ t: 0, v: 0.25 }, { t: 0.4, v: -0.25 }, { t: 0.55, v: -0.2 }, { t: 1, v: 0.25 }] },
        { partId: 'body', py: [{ t: 0, v: 0 }, { t: 0.35, v: -20 }, { t: 0.5, v: -24 }, { t: 0.65, v: -20 }, { t: 1, v: 0 }] },
        { partId: 'tail', rot: [{ t: 0, v: -0.18 }, { t: 0.5, v: 0.24 }, { t: 1, v: -0.18 }] },
        { partId: 'head', rot: [{ t: 0, v: 0.3 }, { t: 0.5, v: 0.4 }, { t: 1, v: 0.3 }] },
      ],
    },
    sit: {
      // Settled to nurse: a gentle squash. Also the clip a riding joey is
      // forced into while carried (Renderer.ts, M12 task 5) — she plays
      // this same hold either way.
      durationMs: 1100,
      tracks: [
        { partId: 'body', sy: [{ t: 0, v: 0.85 }, { t: 1, v: 0.85 }], py: [{ t: 0, v: 3 }, { t: 1, v: 3 }] },
        { partId: 'tail', rot: [{ t: 0, v: 0.2 }, { t: 1, v: 0.2 }] },
      ],
    },
    feedGive: {
      // Played by the parent during a feeding interaction: the head lowers
      // toward a ground-level meeting point — a gentle lean, well short of
      // 'eat''s 0.55 rad graze dip — and holds while the joey arrives (M12
      // task 2). Distinct from the pouch/'sit' nurse-hold gating (M11):
      // this is the real baby kangaroo, walking up to be fed at ground
      // level, not the decorative pouch joey.
      durationMs: 900,
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
    feedTake: {
      // Played by the baby kangaroo during a feeding interaction: the head
      // stretches up and forward from its resting height to meet the
      // parent partway — the mirror image of 'feedGive' (M12 task 2).
      durationMs: 850,
      tracks: [
        {
          partId: 'head',
          rot: [
            { t: 0, v: 0 },
            { t: 0.35, v: -0.35 },
            { t: 0.65, v: -0.35 },
            { t: 1, v: 0 },
          ],
          py: [
            { t: 0, v: 0 },
            { t: 0.35, v: -4 },
            { t: 0.65, v: -4 },
            { t: 1, v: 0 },
          ],
        },
      ],
    },
  },
};
