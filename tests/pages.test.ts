import { describe, expect, it } from 'vitest';
import { SITE } from '../src/content/site';
import { GUIDE } from '../src/content/guide';
import { PORTRAITS } from '../src/content/portraits';
import {
  headInjectionTags, renderGuideIndex, renderRobotsTxt,
  renderSitemapXml, renderSpeciesPage, sitePaths,
} from '../src/content/pageTemplates';

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

describe('page templates', () => {
  it('sitePaths lists every canonical path exactly once', () => {
    const paths = sitePaths();
    expect(paths.length).toBe(15); // game + guide index + 12 species + privacy
    expect(new Set(paths).size).toBe(15);
    expect(paths).toContain('guide/rabbit/');
    expect(paths).toContain('privacy/');
  });

  it('sitemap lists every page exactly once, absolute, from SITE.baseUrl', () => {
    const xml = renderSitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBe(15); // game + guide index + 12 species + privacy
    expect(new Set(locs).size).toBe(15);
    for (const loc of locs) expect(loc!.startsWith(SITE.baseUrl)).toBe(true);
    expect(locs).toContain(`${SITE.baseUrl}guide/rabbit/`);
  });

  it('robots.txt allows all and points at the sitemap', () => {
    const txt = renderRobotsTxt();
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain(`Sitemap: ${SITE.baseUrl}sitemap.xml`);
  });

  it('species pages carry canonical URL, portrait, copy, and credits', () => {
    const robin = GUIDE.find((e) => e.id === 'robin')!;
    const html = renderSpeciesPage(robin);
    expect(html).toContain(`<link rel="canonical" href="${SITE.baseUrl}guide/robin/"`);
    expect(html).toContain('viewBox="0 0 240 180"');
    expect(html).toContain(robin.tagline);
    if (robin.voice.kind !== 'silent') {
      for (const c of robin.voice.credits) expect(html).toContain(c.url);
    }
    expect(html).not.toContain('<script'); // pages are zero-JS
  });

  it('guide index links every species page and the game', () => {
    const html = renderGuideIndex();
    for (const e of GUIDE) expect(html).toContain(`href="./${e.id}/"`);
    expect(html).toContain('href="../"');
  });

  it('head injection carries canonical, og:url, og:image, and VideoGame JSON-LD', () => {
    const tags = headInjectionTags();
    const canonical = tags.find((t) => t.tag === 'link');
    expect(canonical?.attrs?.href).toBe(SITE.baseUrl);
    const jsonLd = tags.find((t) => t.tag === 'script');
    const parsed = JSON.parse(jsonLd!.children!);
    expect(parsed['@type']).toBe('VideoGame');
    expect(parsed.isFamilyFriendly).toBe(true);
    expect(parsed.image).toBe(`${SITE.baseUrl}og-image.png`);
    const ogUrl = tags.find((t) => t.attrs?.property === 'og:url');
    expect(ogUrl?.attrs?.content).toBe(SITE.baseUrl);
  });
});
