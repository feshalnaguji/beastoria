import { describe, expect, it } from 'vitest';
import { SITE } from '../src/content/site';
import { GUIDE } from '../src/content/guide';
import { PORTRAITS } from '../src/content/portraits';

const EXPECTED_IDS = [
  'rabbit', 'robin', 'deer', 'duck', 'koi', 'owl',
  'squirrel', 'frog', 'turtle', 'kangaroo', 'dodo', 'phoenix',
];

describe('site config', () => {
  it('has a trailing-slash absolute base URL', () => {
    expect(SITE.baseUrl).toMatch(/^https:\/\/.+\/$/);
  });
});

describe('guide content', () => {
  it('covers all 12 species exactly once', () => {
    expect(GUIDE.map((e) => e.id).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('every entry has complete kid-facing copy', () => {
    for (const e of GUIDE) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.tagline.length, e.id).toBeGreaterThan(10);
      expect(e.facts.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.inBeastoria.length, e.id).toBeGreaterThan(40);
    }
  });

  it('voiced species carry attribution; silent species carry a note', () => {
    for (const e of GUIDE) {
      if (e.voice.kind === 'silent') {
        expect(e.voice.note.length, e.id).toBeGreaterThan(20);
      } else {
        expect(e.voice.credits.length, e.id).toBeGreaterThanOrEqual(1);
        for (const c of e.voice.credits) {
          expect(c.url, e.id).toMatch(/^https:\/\//);
          expect(c.license.length, e.id).toBeGreaterThan(1);
          expect(c.author.length, e.id).toBeGreaterThan(1);
        }
      }
    }
  });

  it('share-alike sources are labeled CC BY-SA on-page', () => {
    // These species' shipped calls derive from CC BY-SA recordings (LICENSES.md).
    // Controller ruling: deer's entry is correctly `kind: 'designed'` (adapted lamb
    // bleat), so assert non-silent rather than strictly 'recorded'.
    for (const id of ['robin', 'duck', 'deer', 'squirrel', 'frog']) {
      const e = GUIDE.find((g) => g.id === id)!;
      expect(e.voice.kind, id).not.toBe('silent');
      if (e.voice.kind !== 'silent') {
        expect(e.voice.credits.some((c) => c.license.includes('CC BY-SA')), id).toBe(true);
      }
    }
  });
});

describe('portraits', () => {
  it('every species has an accessible inline-SVG portrait', () => {
    for (const e of GUIDE) {
      const svg = PORTRAITS[e.id];
      expect(svg, e.id).toMatch(/^<svg /);
      expect(svg, e.id).toContain('viewBox="0 0 240 180"');
      expect(svg, e.id).toContain('role="img"');
      expect(svg, e.id).toContain('aria-label=');
      expect(svg, e.id).not.toMatch(/<image|href="http/); // self-contained, no external refs
    }
  });
});
