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

const OPTIONAL_FEED_CLIPS: ExtraClipName[] = ['feedGive', 'feedTake'];

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

  it('if feedGive/feedTake are defined, they follow the same clip structure rules', () => {
    const ids = new Set(rig.parts.map((p) => p.id));
    for (const name of OPTIONAL_FEED_CLIPS) {
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
