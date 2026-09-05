# P1 "First Impressions" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the twelve first-impression problems from the 2026-09-05 end-user review — sunny first screen, progress-bearing catch-up that works in hidden tabs, a ranked welcome-back card, onboarding hint, guide link, lazy audio, keyboard camera, boot-failure card, playable creature voices on species pages, and real-rig guide portraits.

**Architecture:** Presentation/UI/content only. Render tint constants and a start-tick offset in `main.ts` handle "first light"; `CatchUp.ts` gains ranking/grouping and a reusable drain used at boot and on tab-visible; `Hud.ts` gains a guide link; `Camera.ts` gains keyboard input; `AudioEngine.unlock()` triggers preload; page templates gain `<audio>` and `<img>` portraits; a dev-only `?portrait=` route renders a single rig for the controller's Playwright capture.

**Tech Stack:** TypeScript, Pixi 8, Vite 6, Vitest (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-05-p1-first-impressions-design.md` — read it first.

## Global Constraints

- **No sim changes:** nothing under `src/sim/` is touched (clock phase fractions included). Existing tests pass unmodified except `tests/pages.test.ts` (portrait tests replaced) and `tests/catchup.test.ts` (new tests appended only — existing assertions stay).
- **Zero cost / no new dependencies.** Portrait PNG capture is done by the controller with Playwright, not by a repo script.
- **Guide pages stay zero-JS, zero external requests.** `<audio>`/`<img>` are native elements pointing at same-origin files.
- **Code-crafted art only:** portraits are renders of the existing rigs.
- **Strict tsconfig + lint clean**; `npm run build` clean.
- Kid-facing copy: warm, short, honest.

## File Structure

- Modify: `src/main.ts` (morning start, boot guard, catch-up drain reuse, visibility catch-up, first-run hint, portrait route dispatch)
- Modify: `src/render/Renderer.ts` (tint ramp + night wash; export `rigFor`)
- Modify: `src/app/CatchUp.ts` (ranked/grouped summary; `drainCatchUp` with progress callback)
- Modify: `src/ui/WelcomeBack.ts` (generalize to `showCard(header, lines)`)
- Modify: `src/ui/Hud.ts` (guide link pill), `src/ui/InspectCard.ts` (wording)
- Modify: `src/render/Camera.ts` (keyboard), `src/audio/AudioEngine.ts` (preload on unlock)
- Create: `src/app/PortraitStudio.ts` (dev-only single-rig render route)
- Modify: `src/content/guide.ts` (voice sample paths), `src/content/pageTemplates.ts` (audio + img portraits)
- Delete: `src/content/portraits.ts`; Create (controller): `public/guide/portraits/<id>.png` ×12
- Modify: `.gitignore` (`!public/**/*.png`), `tests/pages.test.ts`, `tests/catchup.test.ts`, `CLAUDE.md`

---

### Task 1: First light — morning start, brighter night, boot guard, wording

**Files:**
- Modify: `src/main.ts`, `src/render/Renderer.ts:439-450, 1949-1952`, `src/ui/InspectCard.ts:55-56`

**Interfaces:**
- Produces: `MORNING_START_TICK` const in `main.ts` (local); `start()` wrapped by `boot()` — Task 2/3 add to `start()` later, keep its shape.

- [ ] **Step 1: Morning start** — in `src/main.ts` after `const state = save ? save.sim : createWorld(1234);` add:

```ts
/** A fresh valley opens mid-morning, not at grey dawn — first screens should be sunny. */
const MORNING_START_TICK = Math.round(0.2 * TICKS_PER_DAY);
if (!save) state.tick = MORNING_START_TICK;
```
(import `TICKS_PER_DAY` from `./sim/clock`). `sinceTick` must be read AFTER this line.

- [ ] **Step 2: Brighter night, softer dusk** — `src/render/Renderer.ts`: `const NIGHT = 0x7580b0` → `0x98a4d8`; the `[0.615, 0xc79a8f]` dusk stop → `[0.615, 0xd8b3a4]`; night wash `alpha: (1 - this.clock.light) * 0.3` → `* 0.18`. Run `npm run dev`, open the DevPanel (`` ` ``), press `64x`, and eyeball a full day: night must read as luminous moonlit blue with creatures clearly visible; dusk warm rose, not khaki. Adjust ±10% if needed and record final values in the report.

- [ ] **Step 3: Boot guard** — rename the existing `async function start()` body untouched, and replace `void start();` at the bottom with:

```ts
function showBootFailure(err: unknown): void {
  console.error('[boot] Beastoria could not start:', err);
  const card = document.createElement('div');
  card.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'background:#f6f2e7;color:#3a4a33;font-family:Georgia,serif;text-align:center;z-index:30';
  card.innerHTML =
    '<div style="max-width:28rem"><h1 style="font-size:1.5rem;margin:0 0 .5rem">The valley couldn’t wake up</h1>' +
    '<p>Beastoria needs a browser with WebGL to draw its creatures. Try another browser or device — ' +
    'or <a href="./guide/" style="color:#4a6b3a">meet the creatures in the guide</a> meanwhile.</p></div>';
  document.body.appendChild(card);
}

start().catch(showBootFailure);
```

- [ ] **Step 4: Inspect wording** — `src/ui/InspectCard.ts` `creatureRole`: replace `` return `kid ${kidIdx + 1}`; `` with `` return `little one of the ${familyName(fam.id)} family`; ``.

- [ ] **Step 5: Verify + commit** — `npm test` (250 pass), `npm run lint`, `npm run build`. Manually: fresh profile (`indexedDB.deleteDatabase` for the store's DB name via DevTools, or DevPanel "reset valley") opens in daylight, `Day 0 · ☀️`. Commit: `feat: sunny first screen, luminous night, boot-failure card, kinder inspect wording (P1 Task 1)`.

---

### Task 2: Catch-up overhaul — progress overlay, hidden-safe drain, tab-visible catch-up, ranked welcome card

**Files:**
- Modify: `src/app/CatchUp.ts`, `src/ui/WelcomeBack.ts`, `src/main.ts`
- Test: `tests/catchup.test.ts` (append only)

**Interfaces:**
- Produces: `summarizeEvents(events, sinceTick): string[]` (same signature, ranked/grouped output); `drainCatchUp(state, ticksOwed, onProgress?: (done: number, total: number) => void): Promise<void>` in `CatchUp.ts`; `showCard(header: string, lines: string[]): void` in `WelcomeBack.ts` with `showWelcomeBack(lines)` kept as a thin wrapper.

- [ ] **Step 1: Failing tests** — append to `tests/catchup.test.ts`:

```ts
describe('summarizeEvents ranking', () => {
  it('puts births before house-moves and groups repeats', () => {
    const events: SimEvent[] = [
      { kind: 'nested', tick: 100, species: 'rabbit' },
      { kind: 'nested', tick: 101, species: 'deer' },
      { kind: 'nested', tick: 102, species: 'rabbit' },
      { kind: 'nested', tick: 103, species: 'rabbit' },
      { kind: 'nested', tick: 104, species: 'duck' },
      { kind: 'nested', tick: 105, species: 'owl' },
      { kind: 'born', tick: 900, species: 'rabbit', count: 3 },
      { kind: 'born', tick: 950, species: 'rabbit', count: 2 },
    ];
    const lines = summarizeEvents(events, 60);
    expect(lines[0]).toBe('5 little rabbits were born');
    expect(lines).toContain('3 rabbit families settled into new homes');
    expect(lines.length).toBeLessThanOrEqual(6);
  });
  it('tail counts hidden events, not hidden lines', () => {
    const events: SimEvent[] = Array.from({ length: 9 }, (_, i) => ({
      kind: 'nested' as const, tick: 100 + i, species: (['rabbit','deer','duck','owl','koi','frog','robin','dodo','turtle'] as const)[i]!,
    }));
    const lines = summarizeEvents(events, 60);
    expect(lines.length).toBe(6);
    expect(lines[5]).toBe('…and 4 other little happenings.');
  });
});
```
Run `npx vitest run tests/catchup.test.ts` → the new tests FAIL, old ones pass.

- [ ] **Step 2: Rank + group in `CatchUp.ts`** — replace `KIND_PHRASES`/`summarizeEvents` with:

```ts
const INTEREST: Record<SimEvent['kind'], number> = {
  reborn: 7, born: 6, hatched: 6, passed: 5, paired: 4, eggLaid: 3, wandererArrived: 2, nested: 1,
};
const plural = (s: string, n: number): string => (n === 1 ? s : `${s}s`);
/** One warm line per (kind, species) group; `n` = events in the group, `count` = summed babies/eggs. */
const PHRASES: Record<SimEvent['kind'], (s: string, n: number, count: number) => string> = {
  born: (s, _n, c) => `${c} little ${plural(s, c)} ${c > 1 ? 'were' : 'was'} born`,
  hatched: (s, _n, c) => `${c} ${s} ${plural('egg', c)} hatched`,
  eggLaid: (s, n, c) => n > 1 ? `${n} ${s} families laid eggs` : `a ${s} family laid ${c} ${plural('egg', c)}`,
  paired: (s, n) => n > 1 ? `${n} new ${s} pairs formed` : `two ${s}s became a pair`,
  nested: (s, n) => n > 1 ? `${n} ${s} families settled into new homes` : `a ${s} family settled into a new home`,
  passed: (s, n) => n > 1 ? `${n} elder ${s}s passed peacefully` : `an elder ${s} passed peacefully`,
  wandererArrived: (s, n) => n > 1 ? `${n} wandering ${s}s found the valley` : `a wandering ${s} found the valley`,
  reborn: () => `the phoenix rose again from soft embers`,
};

export function summarizeEvents(events: SimEvent[], sinceTick: number): string[] {
  const groups = new Map<string, { kind: SimEvent['kind']; species: string; n: number; count: number }>();
  for (const e of events) {
    if (e.tick <= sinceTick) continue;
    if (!(e.kind in PHRASES)) continue; // unknown kind from a tampered/future save — skip, don't crash
    const key = `${e.kind}|${e.species}`;
    const g = groups.get(key) ?? { kind: e.kind, species: e.species, n: 0, count: 0 };
    g.n++;
    g.count += e.count ?? 1;
    groups.set(key, g);
  }
  const ranked = [...groups.values()].sort((a, b) => INTEREST[b.kind] - INTEREST[a.kind]);
  if (ranked.length === 0) return ['The valley dozed quietly in your absence.'];
  const lines = ranked.map((g) => PHRASES[g.kind](g.species, g.n, g.count));
  if (lines.length <= 6) return lines;
  const hiddenEvents = ranked.slice(5).reduce((sum, g) => sum + g.n, 0);
  return [...lines.slice(0, 5), `…and ${hiddenEvents} other little happenings.`];
}
```
(Sort is stable, so equal-interest groups keep first-occurrence order.) Run the catch-up tests → all pass, including the pre-existing five.

- [ ] **Step 3: Reusable drain with progress** — add to `CatchUp.ts`:

```ts
/** Drain `ticksOwed` in 8 ms slices. Uses setTimeout while the tab is hidden (rAF never fires
 * there — a hidden tab used to stall the overlay forever). Never throws: a sim error logs and
 * resolves with whatever valid state was reached. */
export function drainCatchUp(
  state: WorldState,
  ticksOwed: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let owed = ticksOwed;
    const total = ticksOwed;
    const step = (): void => {
      try {
        const res = runCatchUp(state, owed, 8, () => performance.now());
        owed -= res.ticksRun;
        onProgress?.(total - owed, total);
        if (!res.done && owed > 0) {
          if (document.hidden) setTimeout(step, 0);
          else requestAnimationFrame(step);
          return;
        }
      } catch (err) {
        console.warn('[catchup] aborted:', err);
      }
      resolve();
    };
    step();
  });
}
```

- [ ] **Step 4: Overlay with progress + generalized card** — in `WelcomeBack.ts` rename the body of `showWelcomeBack` into `export function showCard(header: string, lines: string[]): void` (header text parameterized) and keep `export function showWelcomeBack(lines: string[]): void { showCard('While you were away…', lines); }`. In `main.ts` replace `showDawnOverlay()` with one that returns `{ el, setProgress(done, total, fromDay, toDay) }`: text line `Catching up with the valley… Day ${fromDay} → Day ${toDay}` and a 240px-wide, 4px-tall bar (`#87a96b` on `rgba(58,74,51,.15)`) whose inner width = `done/total`. Boot path becomes:

```ts
if (owed > 0) {
  const overlay = showDawnOverlay();
  const fromDay = getClock(state.tick).day;
  const toDay = getClock(state.tick + owed).day;
  await drainCatchUp(state, owed, (d, t) => overlay.setProgress(d, t, fromDay, toDay));
  overlay.el.remove();
  renderer.sync(state);
  showWelcomeBack(summarizeEvents(state.eventLog, sinceTick));
}
```

- [ ] **Step 5: Tab-visible catch-up** — in `main.ts` replace the existing `visibilitychange` listener with:

```ts
let hiddenAt: { epochMs: number; tick: number } | null = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = { epochMs: Date.now(), tick: state.tick };
    void saveWorld(state, Date.now());
    return;
  }
  if (!hiddenAt) return;
  const { epochMs, tick } = hiddenAt;
  hiddenAt = null;
  // The throttled loop already ran some ticks while hidden; only the shortfall is owed.
  const owedNow = Math.max(0, owedTicks(Date.now() - epochMs) - (state.tick - tick));
  if (owedNow < 50) return; // a quick tab-flip — nothing worth a ceremony
  loop.stop();
  const overlay = showDawnOverlay();
  const fromDay = getClock(state.tick).day;
  const toDay = getClock(state.tick + owedNow).day;
  void drainCatchUp(state, owedNow, (d, t) => overlay.setProgress(d, t, fromDay, toDay)).then(() => {
    overlay.el.remove();
    renderer.sync(state);
    showWelcomeBack(summarizeEvents(state.eventLog, tick));
    loop.start();
  });
});
```
(`loop` is declared before this listener already; `owedTicks`/`getClock` are imported.)

- [ ] **Step 6: Verify + commit** — `npm test`, lint, build. Manual: in DevTools set the save's `savedAtEpochMs` 3 h back (Application → IndexedDB) or temporarily edit, reload: progress text + bar visible, then a welcome card whose first line is a birth/hatch if any occurred. Switch to another tab for ~2 min and back: overlay flashes briefly, welcome card appears. Commit: `feat: catch-up progress overlay, hidden-tab-safe drain, tab-visible catch-up, ranked welcome card (P1 Task 2)`.

---

### Task 3: Guide link, first-run hint, keyboard camera, lazy audio

**Files:**
- Modify: `src/ui/Hud.ts`, `src/main.ts`, `src/render/Camera.ts`, `src/audio/AudioEngine.ts:74-81, 84`

**Interfaces:**
- Consumes: `showCard(header, lines)` from Task 2.

- [ ] **Step 1: Guide pill** — in `Hud` constructor add, after the fullscreen chip:

```ts
const guide = document.createElement('a');
guide.href = './guide/';
guide.textContent = '🐾 creatures';
guide.setAttribute('aria-label', 'creature guide');
guide.title = 'Meet the creatures';
guide.style.cssText = [...PILL_CSS, 'top:54px', 'left:12px', 'text-decoration:none', 'font-size:14px'].join(';');
document.body.appendChild(guide);
```

- [ ] **Step 2: First-run hint** — in `main.ts`, after the loop starts, when `!save`:

```ts
if (!save) {
  showCard('Welcome to Beastoria', [
    'A calm little valley where creature families live their lives.',
    'Drag to look around · pinch or scroll to zoom in close.',
    'Tap any creature to meet them.',
  ]);
}
```

- [ ] **Step 3: Keyboard camera** — in `Camera` constructor add `window.addEventListener('keydown', this.onKey);` and:

```ts
private onKey = (e: KeyboardEvent): void => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
  const pan = 120 / this.targetZoom;
  switch (e.key) {
    case 'ArrowLeft': this.targetX -= pan; break;
    case 'ArrowRight': this.targetX += pan; break;
    case 'ArrowUp': this.targetY -= pan; break;
    case 'ArrowDown': this.targetY += pan; break;
    case '+': case '=': this.targetZoom = clamp(this.targetZoom * 1.25, this.minZoom(), MAX_ZOOM); break;
    case '-': case '_': this.targetZoom = clamp(this.targetZoom / 1.25, this.minZoom(), MAX_ZOOM); break;
    default: return;
  }
  e.preventDefault();
};
```

- [ ] **Step 4: Lazy audio** — `AudioEngine.unlock()`: add `void this.preload();` after `this.unlocked = true;` (guard `preload` with a `private preloaded = false` flag so a second call is a no-op). In `main.ts` delete the `void audio.preload();` line. Beds start when buffers land (existing `startBeds()` at the end of preload) — the ambience fades in a moment after the first tap, which is fine.

- [ ] **Step 5: Verify + commit** — `npm test`, lint, build. Manual: Network tab shows no `/audio/` requests until the first click; arrows/`+`/`-` move the camera; the 🐾 pill navigates to `/guide/`; a fresh profile shows the welcome card. Commit: `feat: guide link pill, first-run hint, keyboard camera, audio preload after unlock (P1 Task 3)`.

---

### Task 4: Species pages — hear the creature

**Files:**
- Modify: `src/content/guide.ts` (add `sample` to recorded/designed voices), `src/content/pageTemplates.ts`
- Test: `tests/pages.test.ts` (append)

**Interfaces:**
- Produces: `VoiceInfo` recorded/designed variants gain `sample: string` (path under `public/audio/`, no extension, e.g. `'families/robin/call1'`).

- [ ] **Step 1: Failing test** — append to `tests/pages.test.ts`:

```ts
it('voiced species pages carry a native audio player; silent ones do not', () => {
  for (const e of GUIDE) {
    const html = renderSpeciesPage(e);
    if (e.voice.kind === 'silent') expect(html, e.id).not.toContain('<audio');
    else {
      expect(html, e.id).toContain('<audio controls preload="none"');
      expect(html, e.id).toContain(`../../audio/${e.voice.sample}.webm`);
      expect(html, e.id).toContain(`../../audio/${e.voice.sample}.m4a`);
    }
    expect(html, e.id).not.toContain('<script');
  }
});
```

- [ ] **Step 2: Data + template** — `guide.ts`: `VoiceInfo` recorded/designed variant gets `sample: string`; set `sample: 'families/<id>/call1'` for rabbit, robin, deer, duck, koi, owl, squirrel, frog, dodo, phoenix (all exist in `public/audio/families/`). `pageTemplates.ts` `renderSpeciesPage`: before the credits block, for non-silent voices:

```ts
`<h2>${entry.voice.kind === 'designed' ? `Hear the ${entry.name.toLowerCase()}’s voice` : `Hear a real ${entry.name.toLowerCase()}`}</h2>
<audio controls preload="none" aria-label="${entry.name} call">
  <source src="../../audio/${entry.voice.sample}.webm" type="audio/webm" />
  <source src="../../audio/${entry.voice.sample}.m4a" type="audio/mp4" />
</audio>`
```
Style: `audio { width: 100%; max-width: 22rem; display:block; margin: .5rem 0 1rem; }` in the shared CSS.

- [ ] **Step 3: Verify + commit** — tests pass; `npm run build`; `npm run preview` → `/guide/robin/` plays the call. Commit: `feat: species pages play the creature's real recording (P1 Task 4)`.

---

### Task 5: Real-rig portraits — dev route, PNG wiring, SVG retirement

**Files:**
- Create: `src/app/PortraitStudio.ts`
- Modify: `src/main.ts` (route dispatch), `src/render/Renderer.ts:45` (export `rigFor`), `src/content/pageTemplates.ts`, `.gitignore`
- Delete: `src/content/portraits.ts`
- Test: `tests/pages.test.ts` (replace the `portraits` describe block)
- Controller step (between implementer and review): capture `public/guide/portraits/<id>.png` ×12 with Playwright.

**Interfaces:**
- Produces: `renderPortraitStudio(mount: HTMLElement, species: SpeciesId): Promise<void>` — renders one adult rig, idle pose, into a 600×600 canvas; sets `document.title = 'portrait:<species>'` and `(window as unknown as { __portraitReady?: boolean }).__portraitReady = true` when the first frame is drawn. Page templates reference `./portraits/<id>.png` (index) and `../portraits/<id>.png` (species page) with `alt="${name} in Beastoria"`.

- [ ] **Step 1: Export `rigFor`** — `Renderer.ts`: `export function rigFor(...)`.

- [ ] **Step 2: PortraitStudio** — `src/app/PortraitStudio.ts`:

```ts
/** Dev-only: `?portrait=<species>` renders one adult rig for the guide's PNG portraits. */
import { Application, Container, Graphics } from 'pixi.js';
import { rigFor } from '../render/Renderer';
import { buildRig } from '../render/creatures/RigRenderer';
import type { SpeciesId } from '../sim/state';

const SIZE = 600;
const SKY: Partial<Record<SpeciesId, number>> = { owl: 0x4a5568, phoenix: 0x3f3a4a, koi: 0x9fbfb9 };

export async function renderPortraitStudio(mount: HTMLElement, species: SpeciesId): Promise<void> {
  const app = new Application();
  await app.init({ width: SIZE, height: SIZE, background: SKY[species] ?? 0xdce9d5, antialias: true, resolution: 2, autoDensity: true, autoStart: false });
  mount.appendChild(app.canvas);
  const scene = new Container();
  if (species !== 'koi') {
    scene.addChild(new Graphics().ellipse(SIZE / 2, SIZE * 0.78, SIZE * 0.7, SIZE * 0.22).fill(0x9ab77e));
    scene.addChild(new Graphics().ellipse(SIZE / 2, SIZE * 0.86, SIZE * 0.8, SIZE * 0.2).fill(0x87a96b));
  }
  const rig = buildRig(rigFor(species), 'adult');
  rig.animator.play('idle');
  rig.animator.update(0);
  scene.addChild(rig.root);
  app.stage.addChild(scene);
  // Fit the rig into ~70% of the canvas, feet near the ground line.
  const b = rig.root.getLocalBounds();
  const s = (SIZE * 0.7) / Math.max(b.width, b.height);
  rig.root.scale.set(rig.root.scale.x * s);
  const bb = rig.root.getBounds();
  rig.root.position.set(SIZE / 2 - (bb.x + bb.width / 2), SIZE * 0.78 - (bb.y + bb.height));
  app.render();
  document.title = `portrait:${species}`;
  (window as unknown as { __portraitReady?: boolean }).__portraitReady = true;
}
```
Adjust the ground-line/scale math after eyeballing one species in `npm run dev` at `/?portrait=deer` — the creature must be centered, fully inside the canvas, standing on the hill. Check `Animator.play` accepts `'idle'` (see `src/render/creatures/Animator.ts`); if the idle clip uses the settle-dip, `update(0)` is fine.

- [ ] **Step 3: Route dispatch** — top of `start()` in `main.ts`:

```ts
const portrait = new URLSearchParams(location.search).get('portrait');
if (portrait) {
  await renderPortraitStudio(mount, portrait as SpeciesId);
  return; // dev-only: no sim, no HUD, no save
}
```
(Place before `loadSave()`.) Validate: if `portrait` is not a key of `SPECIES`, fall through to the normal game.

- [ ] **Step 4: Page wiring + tests** — `pageTemplates.ts`: replace `PORTRAITS[e.id]` in the index cards with `<img src="./portraits/${e.id}.png" alt="${e.name} in Beastoria" width="600" height="600" loading="lazy">` and in the species page with `<img src="../portraits/${entry.id}.png" alt="${entry.name} in Beastoria" width="600" height="600">`; keep the `.cards img`/`.portrait img` sizing rules (`width:100%;height:auto;border-radius…`). Delete `src/content/portraits.ts` and the `portraits` describe block + import in `tests/pages.test.ts`; update the species-page test that asserted `viewBox="0 0 240 180"` to assert `<img src="../portraits/robin.png"` and `alt="Robin in Beastoria"`. `.gitignore`: change `!public/*.png` → `!public/**/*.png`.

- [ ] **Step 5: Verify + commit (implementer)** — `npm test`, lint, build clean. `npm run preview` → `/?portrait=kangaroo` shows a centered kangaroo. Commit: `feat: dev portrait route + PNG portrait wiring on guide pages (P1 Task 5)`. The PNGs themselves are added by the controller in a follow-up commit before review.

- [ ] **Step 6 (controller): capture the 12 PNGs** — run `npm run preview`, then with Playwright for each species id: goto `http://localhost:4173/?portrait=<id>`, wait for `window.__portraitReady`, `page.locator('canvas').screenshot({ path: 'public/guide/portraits/<id>.png' })`, downscale not needed (600×600 CSS, resolution 2 → 1200px; that's fine, ~60–120 kB each — if any exceeds 200 kB, use `resolution: 1.5`). Commit: `feat: real-rig guide portraits ×12 (P1 Task 5 assets)`. Eyeball every PNG.

---

### Task 6: Verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1** — `npm test`, `npm run lint`, `npm run build`; `git diff --stat main...HEAD -- src/sim` is empty; `dist/guide/portraits/` has 12 PNGs; `dist/guide/robin/index.html` contains `<audio` and `<img`.
- [ ] **Step 2** — CLAUDE.md: add a compact **P1** Done entry (list the twelve fixes in one sentence group; test count); Status: P1 built on branch, awaiting merge/deploy (controller flips to deployed at merge); add `?portrait=<species>` dev route to Commands ("dev-only; PNGs captured by hand into `public/guide/portraits/`"); note the deferred items (reduced-motion, label/creature overlap, mobile perf still needs the user's device). Commit: `docs: P1 First Impressions status (P1 Task 6)`.

## Self-Review Notes

- Spec coverage: §1 first light → T1; §2 catch-up progress/hidden → T2; §3 ranking → T2; §4 portraits → T5; §5 guide door → T3; §6 hint → T3; §7 lazy audio → T3; §8 tab-visible catch-up → T2; §9 boot guard → T1; §10 keyboard → T3; §11 species audio → T4; §12 wording → T1. Deferred items listed in T6 docs.
- Existing catch-up tests: verified compatible with the ranking rules (5-event case shows all; 6-line case shows all; 8-event case → 5 + "…and 3 other").
- Types: `showCard` defined in T2, consumed T3; `rigFor` exported T5; `VoiceInfo.sample` T4 only.
