import { SITE } from './site';
import { ABOUT_HTML, GUIDE, PRIVACY_SECTIONS, type GuideEntry } from './guide';
import { PORTRAITS } from './portraits';

const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f2e7; color: #3a4a33;
         font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; }
  main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  a { color: #4a6b3a; }
  h1 { font-size: 2rem; margin: 0.5rem 0 0.25rem; }
  h2 { font-size: 1.3rem; margin-top: 2rem; }
  .tagline { font-style: italic; color: #6b7a5e; margin-top: 0; }
  .play { display: inline-block; background: #87a96b; color: #fffdf6; padding: 0.6rem 1.4rem;
          border-radius: 999px; text-decoration: none; font-size: 1.05rem; margin: 0.75rem 0; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
           gap: 1rem; padding: 0; list-style: none; }
  .cards a { display: block; background: #fffdf6; border-radius: 0.75rem; padding: 0.75rem;
             text-decoration: none; box-shadow: 0 1px 3px rgba(58, 74, 51, 0.15); }
  .cards svg { width: 100%; height: auto; border-radius: 0.5rem; display: block; }
  .portrait svg { width: 100%; max-width: 22rem; height: auto; border-radius: 0.75rem; display: block; }
  .facts li { margin-bottom: 0.5rem; }
  .credits { font-size: 0.85rem; color: #6b7a5e; border-top: 1px solid #d8d2bd;
             margin-top: 2.5rem; padding-top: 1rem; }
  footer { font-size: 0.85rem; color: #6b7a5e; border-top: 1px solid #d8d2bd;
           margin-top: 3rem; padding-top: 1rem; }
  .breadcrumb { font-size: 0.9rem; }
`;

/** '../' segments to reach site root from a canonical path like 'guide/rabbit/'. */
function relRoot(canonicalPath: string): string {
  const depth = canonicalPath.split('/').filter(Boolean).length;
  return '../'.repeat(depth);
}

/** Wrap a page body in the shared shell. canonicalPath is relative to baseUrl, e.g. 'guide/rabbit/'. */
function shell(opts: { title: string; description: string; canonicalPath: string; body: string }): string {
  const canonical = `${SITE.baseUrl}${opts.canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.title}</title>
<meta name="description" content="${opts.description}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="${relRoot(opts.canonicalPath)}favicon.svg" type="image/svg+xml" />
<meta property="og:title" content="${opts.title}" />
<meta property="og:description" content="${opts.description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE.baseUrl}og-image.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE.name}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="${SITE.themeColor}" />
<style>${CSS}</style>
</head>
<body><main>${opts.body}</main></body>
</html>`;
}

export function renderGuideIndex(): string {
  const cards = GUIDE.map(
    (e) =>
      `<li><a href="./${e.id}/">${PORTRAITS[e.id]}<strong>${e.emoji} ${e.name}</strong><br><span>${e.tagline}</span></a></li>`,
  ).join('');
  const body = `
<p class="breadcrumb"><a href="../">← back to the valley</a></p>
<h1>Creature Guide</h1>
${ABOUT_HTML}
<a class="play" href="../">Open the valley</a>
<h2>Meet the creatures</h2>
<ul class="cards">${cards}</ul>
<footer><a href="../privacy/">Privacy</a> · <a href="${SITE.repoUrl}" rel="external">Source on GitHub</a></footer>`;
  return shell({
    title: `Creature Guide — ${SITE.name}`,
    description: SITE.socialDescription,
    canonicalPath: 'guide/',
    body,
  });
}

export function renderSpeciesPage(entry: GuideEntry): string {
  const facts = entry.facts.map((f) => `<li>${f}</li>`).join('');
  const description = `${entry.tagline}. ${entry.facts[0]}`;
  const creditsHtml =
    entry.voice.kind === 'silent'
      ? `<p>${entry.voice.note}</p>`
      : `<p>${entry.voice.note}</p>` +
        entry.voice.credits
          .map((c) => `<p>${c.label}: ${c.author}, <a href="${c.url}" rel="external">${c.license}</a></p>`)
          .join('');
  const body = `
<p class="breadcrumb"><a href="../">← all creatures</a></p>
<h1>${entry.emoji} ${entry.name}</h1>
<p class="tagline">${entry.tagline}</p>
<div class="portrait">${PORTRAITS[entry.id]}</div>
<h2>Did you know?</h2>
<ul class="facts">${facts}</ul>
<h2>In Beastoria</h2>
<p>${entry.inBeastoria}</p>
<a class="play" href="../../">Open the valley</a>
<div class="credits">${creditsHtml}</div>
<footer><a href="../../privacy/">Privacy</a> · <a href="${SITE.repoUrl}" rel="external">Source on GitHub</a></footer>`;
  return shell({
    title: `${entry.name} — ${SITE.name} Creature Guide`,
    description,
    canonicalPath: `guide/${entry.id}/`,
    body,
  });
}

export function renderPrivacyPage(): string {
  const sections = PRIVACY_SECTIONS.map((s) => `<h2>${s.heading}</h2>${s.bodyHtml}`).join('');
  const body = `
<h1>Privacy</h1>
${sections}
<p>Last updated: 2026-08-22</p>
<footer><a href="../">← back to the valley</a> · <a href="../guide/">Creature guide</a></footer>`;
  return shell({
    title: `Privacy — ${SITE.name}`,
    description:
      'How Beastoria protects children and families: no accounts, no data collection, no tracking — your valley is saved only on your own device.',
    canonicalPath: 'privacy/',
    body,
  });
}

export function sitePaths(): string[] {
  return ['', 'guide/', ...GUIDE.map((e) => `guide/${e.id}/`), 'privacy/'];
}

export function renderSitemapXml(): string {
  const urls = sitePaths()
    .map((p) => `<url><loc>${SITE.baseUrl}${p}</loc></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function renderRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE.baseUrl}sitemap.xml\n`;
}

export interface HeadTagDescriptor {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
  injectTo: 'head';
}

export function headInjectionTags(): HeadTagDescriptor[] {
  return [
    { tag: 'link', attrs: { rel: 'canonical', href: SITE.baseUrl }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:url', content: SITE.baseUrl }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:image', content: `${SITE.baseUrl}og-image.png` }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE.baseUrl}og-image.png` }, injectTo: 'head' },
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: SITE.name,
        url: SITE.baseUrl,
        description: SITE.description,
        genre: ['Simulation', 'Casual'],
        gamePlatform: 'Web browser',
        playMode: 'SinglePlayer',
        isFamilyFriendly: true,
        audience: { '@type': 'PeopleAudience', suggestedMinAge: 4 },
        author: { '@type': 'Person', name: SITE.author },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        image: `${SITE.baseUrl}og-image.png`,
      }),
      injectTo: 'head',
    },
  ];
}
