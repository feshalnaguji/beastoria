# Beastoria — Growth & Distribution Track Design

**Date:** 2026-08-22
**Status:** Approved by the user (brainstorming session, 2026-08-22). G1 designed in full;
G2–G4 scoped but not designed.
**Relationship to the sim roadmap:** This is a separate track from v1/v2/v3 (Pure Living
Terrarium → Caretaker World → Management Sim). It changes how Beastoria is found, shared,
and experienced around the edges — it does not change the sim. The v1 spec
(`2026-08-13-beastoria-v1-design.md`) remains the source of truth for the game itself.

## Why this track exists

The user wants Beastoria to be findable via search, naturally shareable, appealing to
children specifically, and eventually monetizable via ads — planned deliberately so ads
never feel intrusive. As of M13 the deployed site had effectively zero discovery surface:
a bare `<title>`, one meta description, an inline-SVG emoji favicon, and nothing else — no
Open Graph/Twitter tags, no PWA manifest, no robots.txt/sitemap, no icon set, no privacy
policy. This is a from-scratch foundation, not a tune-up.

## Binding user decisions (made 2026-08-22 — do not relitigate)

1. **Beastoria is child-directed** for privacy-law and ad-policy purposes (COPPA, GDPR-K/
   AADC posture). Accepted consequences: contextual-only ads ever (no behavioral/tracking
   ads), zero tracking, no personal-data analytics, no third-party trackers. This matches
   the game's calm design ethos and is honest about the intended audience.
2. **Return hooks — all four approved**, to be built across this track's milestones:
   - *The world grew while away* — amplify the existing offline catch-up + welcome-back
     card into THE return story ("come see what happened").
   - *Ownership & naming* — kids can name creatures/families (stored locally, no server).
   - *Shareable moments* — seed-based "share this world" links; easy capture/share.
   - *Daily-rhythm events* — gentle time-of-day happenings worth checking in for.
   Plus a fifth, user-added requirement:
   - **Child mode** — a fullscreen mode in which accidental clicks/keys cannot close or
     leave the game; exit requires a deliberate parental gesture (e.g. hold-to-exit).
     Must be honest about browser limits: a web page cannot block OS-level actions
     (Alt+Tab etc.); desktop Chromium's Keyboard Lock API can capture Esc/Ctrl+W in
     fullscreen; on tablets the real mechanism is iOS Guided Access / Android Screen
     Pinning, which child mode should surface instructions for.
3. **Ads: foundations only in this track.** No ad-network integration now. Build the
   privacy policy and the placement concept; integrate AdSense (child-directed mode)
   later, once real traffic and a custom domain exist.
4. **SEO scope: game page + creature guide pages** — full head/meta/structured data on the
   game page plus a small static site: landing/about content and one page per species.
5. **Domain: stay on `https://feshalnaguji.github.io/beastoria/` for now.** The user will
   buy a custom domain soon and "publish properly". Everything must therefore be
   **domain-portable**: one canonical-URL config, relative asset URLs, sitemap/OG URLs
   derived from config, so the move is a one-line change plus rebuild.
6. **Milestone decomposition and order: G1 → G2 → G3 → G4** (below), each ending
   reviewable in the browser, same discipline as M0–M13.

## Track decomposition

- **G1 — Findable** (designed in full below): SEO/PWA/content foundation.
- **G2 — Shareable** (scoped only): seed-based "share this world" links + creature/family
  naming (local, no server). Needs its own brainstorm; key open question is what a share
  link encodes (seed alone regenerates the same destiny-world cheaply; seed + elapsed
  ticks would require replaying ticks on the receiving end, which has real time cost).
- **G3 — Child mode** (scoped only): fullscreen guard, parental-gate exit, Keyboard Lock
  where available, Guided Access / Screen Pinning guidance, likely paired with the
  service-worker/offline decision deferred out of G1. Needs its own brainstorm.
- **G4 — Return rhythm** (scoped only): welcome-back amplification + gentle daily events.
  Sim-adjacent; may fold into the v2 Caretaker World roadmap instead of standing alone.

## Monetization architecture (decided now, built later)

- Child-directed contextual-only ads (e.g. AdSense with child-directed tagging). No
  behavioral targeting, no remarketing, no tracking of any kind, ever.
- Ad surfaces: **never on or over the play canvas.** The guide pages (G1) are the only
  candidate surface. The play experience stays ad-free.
- Prerequisites before integration: custom domain, meaningful traffic, an approved
  AdSense account, and the already-built privacy policy. Revisit at custom-domain time.
- No analytics platform in the meantime. If aggregate insight is ever wanted, it must be
  a cookieless, non-personal, child-safe solution chosen deliberately — not adopted by
  default.

---

# G1 "Findable" — full design

**Goal:** when someone searches for a calm animal game for kids, shares a Beastoria link,
or adds it to a phone home screen, everything looks and works like a real, cared-for site
— at zero cost, with no sim code changes at all.

## 1. Site identity config — `src/content/site.ts` (new)

Single source of truth: canonical base URL, site name, tagline, long description, social
description. All meta tags, the sitemap, OG URLs, and the manifest derive from it, so the
future domain move is a one-line edit plus rebuild. Lives outside `src/sim/` (content, not
sim); importable by app code and build scripts alike.

## 2. Game-page head tags — `index.html` + `package.json`

- Keyword-aware but honest `<title>` and meta description ("calm animal world game for
  kids / creature families / free in your browser" territory — no keyword stuffing).
- `<link rel="canonical">`, full Open Graph set (title/description/image/url/type),
  Twitter Card (`summary_large_image`), `theme-color`, icon links (§3), manifest link (§5).
- JSON-LD structured data: `VideoGame` schema — free, browser-playable, audience suited
  to children, author.
- `<noscript>` fallback paragraph describing the game, linking to `/guide/`.
- `package.json` gains a `homepage` field.
- The canonical URL must be stamped from `site.ts` at build time (via the §4 generator
  templating the head, or a tiny Vite HTML transform plugin) — never hand-duplicated in
  more than one committed place.

## 3. Icons & OG share image — code-crafted, committed outputs

- One master SVG icon evolving the current rabbit-emoji favicon into a proper drawn
  vector mark consistent with the game's art; one 1200×630 OG share-image SVG (a small
  code-crafted valley-scene poster: title, creatures, tagline). No AI images, no assets.
- A one-time script (`scripts/generate-icons.mts`, `sharp` as a devDependency — MIT,
  free) rasterizes them into `favicon.ico`, 16/32 PNGs, `apple-touch-icon.png` (180px),
  PWA icons 192/512 + maskable variants, and `og-image.png`.
- Outputs are **committed** to `public/` so `npm run build` and CI never depend on sharp.
  The master SVGs are committed too, as the source of truth for future edits.

## 4. Guide pages — the real SEO surface

- New content data file `src/content/guide.ts`: one entry per species (all 12: rabbit,
  robin, deer, duck, koi, owl, dodo, phoenix, squirrel, frog, turtle, kangaroo) with
  kid-friendly facts, real-animal notes, in-game family-life notes, and voice credits
  sourced from `public/audio/LICENSES.md` (CC-BY attribution respected on-page), plus
  the landing/about copy.
- A prebuild script `scripts/generate-pages.mts` (wired into `npm run build`) emits pure
  static HTML/CSS — no JS — into the build output: `/guide/` (landing/about + species
  index), `/guide/<species>/` ×12, and `/privacy/` (§6). One shared calm, Ghibli-ish
  stylesheet; every page links to the game and back. Species portraits are modest
  code-crafted inline SVG vignettes; a rig-to-SVG exporter is explicitly out of scope.
- `sitemap.xml` is generated from the same species list plus static pages, with absolute
  URLs from `site.ts`. `robots.txt` is static in `public/` (allow all, point at sitemap).
- New species later = one new `guide.ts` entry; pages and sitemap follow automatically —
  the same "new species = data, not new systems" ethos as the sim.
- Generated pages are build artifacts, not committed source (generate into `dist/` after
  vite build, or into a gitignored path).

## 5. PWA manifest — installable, deliberately no service worker

- `manifest.webmanifest`: name/short_name, description, `display: standalone`,
  `start_url`, theme/background colors matching the valley palette, icons 192/512 +
  maskable.
- Installable on Android/desktop Chrome (manifest alone suffices since 2023); iOS gets a
  proper home-screen icon via the apple-touch-icon.
- **No service worker in G1.** Offline caching risks serving stale builds and deserves
  its own design; it pairs naturally with G3 child mode instead.

## 6. Privacy policy page + ad-placement concept (paper only)

- `/privacy/` static page from the same generator, in plain language: child-directed
  posture — no accounts, no data collection, no tracking, no ads (yet); saves live only
  in the player's own browser (IndexedDB); pointer to audio credits. Honest and short.
- The ad concept lives in this spec only (see "Monetization architecture" above); nothing
  ad-related is built in G1.

## Constraints binding G1

- Zero cost ever: MIT/OSS tooling only; GitHub Pages free tier; no paid services.
- 100% code-crafted vector art; no AI images, no asset packs.
- **No sim code changes:** everything under `src/sim/`, `src/render/`, `src/rigs/`,
  `src/audio/`, `src/persist/` and the existing test suite stays untouched; the 238
  tests must pass unmodified.
- Guide-page copy is kid-facing: warm, short, factual; CC-BY audio attributions honored.

## G1 verification

1. `npm test` — all 238 tests pass, unmodified.
2. `npm run build` — clean; `dist/` contains the 12 species pages + landing + privacy,
   `sitemap.xml`, `robots.txt`, manifest, icons, `og-image.png`.
3. `npm run lint` clean.
4. `npm run preview`: game loads exactly as before; `/guide/`, `/guide/rabbit/`,
   `/privacy/` render; view-source on `/` shows the full head + JSON-LD.
5. After deploy: Lighthouse SEO ≥ 95 and installability pass; OG card checked with a
   social-card debugger; indexing observed over the following weeks.
6. CLAUDE.md status updated (G1 done; G2–G4 pending their own brainstorms).
