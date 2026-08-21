/**
 * Rig data integrity: parts form a valid parent-ordered tree, clips and
 * stage overrides reference real parts, keyframes are well-formed.
 * (How rigs LOOK is eyeballed in the browser; this guards structure only.)
 */
import { describe, expect, it } from 'vitest';
import { ALL_RIGS } from '../src/rigs/allRigs';
import type { AnimClip, CoreClipName, ExtraClipName } from '../src/rigs/format';
import { SPECIES } from '../src/sim/species';

/** The structural rules a clip's tracks/keyframes must satisfy, shared by
 * the required CORE_CLIPS loop below and by the optional feedGive/feedTake
 * clips (M12 task 2) — a rig that defines them must follow the same rules,
 * even though TypeScript doesn't force every rig to define them. */
function expectValidClip(clip: AnimClip, ids: Set<string>) {
  expect(clip.durationMs).toBeGreaterThan(0);
  for (const track of clip.tracks) {
    expect(ids.has(track.partId)).toBe(true);
    for (const channel of [track.rot, track.px, track.py, track.sx, track.sy]) {
      if (!channel) continue;
      expect(channel.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < channel.length; i++) {
        const prev = channel[i - 1];
        const curr = channel[i];
        if (prev && curr) expect(curr.t).toBeGreaterThanOrEqual(prev.t);
      }
      expect(channel[0]?.t).toBe(0);
      expect(channel[channel.length - 1]?.t).toBe(1);
    }
  }
}

const OPTIONAL_CLIPS: ExtraClipName[] = ['feedGive', 'feedTake', 'mount'];

/**
 * The full CoreClipName set, kept in sync with format.ts by construction: if
 * a clip name is ever added to or removed from CoreClipName, this object
 * literal fails to satisfy Record<CoreClipName, true> and the build breaks
 * here rather than the loop below silently going stale again (review fix —
 * M10 task 3 — this used to hardcode just the original five).
 */
const CORE_CLIPS = { idle: true, walk: true, sleep: true, eat: true, social: true, carry: true, sit: true } satisfies Record<
  CoreClipName,
  true
>;

describe.each(ALL_RIGS.map((r) => [r.species, r] as const))('%s rig', (_species, rig) => {
  it('parts have unique ids and parents defined before children', () => {
    const seen = new Set<string>();
    for (const part of rig.parts) {
      expect(seen.has(part.id)).toBe(false);
      if (part.parent !== null) expect(seen.has(part.parent)).toBe(true);
      seen.add(part.id);
    }
  });

  it('all four life stages are styled and reference real parts', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const stage of ['baby', 'juvenile', 'adult', 'elder'] as const) {
      const style = rig.stages[stage];
      expect(style.scale).toBeGreaterThan(0);
      for (const partId of Object.keys(style.partScale ?? {})) {
        expect(ids.has(partId)).toBe(true);
      }
    }
  });

  it('all seven core clips exist, tracks target real parts, keyframes span 0..1 ascending', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const name of Object.keys(CORE_CLIPS) as CoreClipName[]) {
      expectValidClip(rig.clips[name], ids);
    }
  });

  it('if feedGive/feedTake/mount are defined, they follow the same clip structure rules', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const name of OPTIONAL_CLIPS) {
      const clip = rig.clips[name];
      if (!clip) continue;
      expectValidClip(clip, ids);
    }
  });
});

describe('rig coverage', () => {
  it('every species has a rig', () => {
    const rigged = new Set(ALL_RIGS.map((r) => r.species));
    for (const id of Object.keys(SPECIES)) expect(rigged.has(id as never)).toBe(true);
  });
});

/**
 * The recipe's feedGive/feedTake and food-prop rules
 * (docs/superpowers/specs/2026-08-21-rig-art-recipe.md:314-338), encoded as
 * data assertions rather than left to eyeballing. RED as of M13 task 11:
 * squirrel is a `feedMode: 'nurse'` species (src/sim/species.ts) that never
 * got the M12-task-2 feedGive/feedTake treatment its nurse-mode siblings
 * (rabbit, deer, kangaroo) did — squirrelRig.ts:84 defines neither clip nor
 * lists them in the `food` part's hideInClips. Fixing the rig is a separate,
 * later task (M13 task 12); these two tests only prove the gap exists.
 */
describe('recipe rule: feedGive/feedTake per feedMode', () => {
  it('11a: every feedMode "nurse" species defines both feedGive and feedTake clips', () => {
    for (const rig of ALL_RIGS) {
      if (SPECIES[rig.species].reproduction.feedMode !== 'nurse') continue;
      expect(rig.clips.feedGive, `${rig.species}.clips.feedGive`).toBeDefined();
      expect(rig.clips.feedTake, `${rig.species}.clips.feedTake`).toBeDefined();
    }
  });

  it("11b: the food prop's hideInClips follows the feedMode table (nurse hides both feed clips; carry hides feedTake but shows feedGive)", () => {
    for (const rig of ALL_RIGS) {
      const feedMode = SPECIES[rig.species].reproduction.feedMode;
      if (feedMode === 'self') continue; // n/a per the recipe table
      const food = rig.parts.find((p) => p.id === 'food');
      if (!food) continue; // e.g. self-mode species need not author a food prop
      const hidden = new Set(food.hideInClips ?? []);
      if (feedMode === 'nurse') {
        expect(hidden.has('feedGive'), `${rig.species} food hidden in feedGive`).toBe(true);
        expect(hidden.has('feedTake'), `${rig.species} food hidden in feedTake`).toBe(true);
      } else if (feedMode === 'carry' && rig.clips.feedGive) {
        // Opt-in: a carry-mode rig need not define feedGive at all, but if
        // it does, the morsel is the feeding beat and must stay visible.
        expect(hidden.has('feedTake'), `${rig.species} food hidden in feedTake`).toBe(true);
        expect(hidden.has('feedGive'), `${rig.species} food visible in feedGive`).toBe(false);
      }
    }
  });
});

/**
 * The pouch render contract (M12 task 5/7): `Renderer.ts` reparents a riding
 * joey's whole view into the kangaroo rig's `pouch` part, between drawn
 * `pouchBack`/`pouchFront` walls, by id — with nothing in the type system
 * connecting the two files. Pinned numeric contract (same convention as
 * tests/feeding.test.ts and tests/pouch.test.ts): the literals below are
 * copies of Renderer.ts's module-private POUCH_RIDER_Z/POUCH_WORLD_OFFSET_*
 * constants, not imports of them, so an accidental change on either side of
 * the contract fails a test here instead of silently breaking the pouch.
 */
describe('kangaroo rig: the pouch render contract', () => {
  const POUCH_RIDER_Z = 2;
  const POUCH_WORLD_OFFSET_X = 6;
  const POUCH_WORLD_OFFSET_Y = 0;
  const rig = ALL_RIGS.find((r) => r.species === 'kangaroo');
  if (!rig) throw new Error('no kangaroo rig');

  it('pouch is a pure empty-shapes anchor', () => {
    const pouch = rig.parts.find((p) => p.id === 'pouch');
    expect(pouch).toBeDefined();
    expect(pouch?.shapes.length).toBe(0);
  });

  it('pouchBack is a child of pouch, drawn strictly below the rider', () => {
    const pouchBack = rig.parts.find((p) => p.id === 'pouchBack');
    expect(pouchBack?.parent).toBe('pouch');
    expect(pouchBack?.z).toBeLessThan(POUCH_RIDER_Z);
  });

  it('pouchFront is a child of pouch, drawn strictly above the rider', () => {
    const pouchFront = rig.parts.find((p) => p.id === 'pouchFront');
    expect(pouchFront?.parent).toBe('pouch');
    expect(pouchFront?.z).toBeGreaterThan(POUCH_RIDER_Z);
  });

  it("body + pouch offsets sum to Renderer.ts's POUCH_WORLD_OFFSET", () => {
    const body = rig.parts.find((p) => p.id === 'body');
    const pouch = rig.parts.find((p) => p.id === 'pouch');
    expect((body?.x ?? 0) + (pouch?.x ?? 0)).toBe(POUCH_WORLD_OFFSET_X);
    expect((body?.y ?? 0) + (pouch?.y ?? 0)).toBe(POUCH_WORLD_OFFSET_Y);
  });
});
