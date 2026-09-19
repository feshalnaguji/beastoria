# P1 "First Impressions" — Design

**Date:** 2026-09-05 · **Status:** approved by the user (scope: Tier 1 + Tier 2; night treatment:
render-only brighter night + morning start) · **Track:** polish milestone between G1 and G2;
touches presentation, first-run, and guide content only — **no sim changes**.

## Problem statement (from the 2026-09-05 end-user review)

Played as a first-time visitor, a returning visitor, a phone user, a keyboard user, and a parent
reading the guide (live site, Playwright fresh profile + Chrome). The core — rigs, animation,
calm — is excellent up close. The wrapper undersells it:

1. **First screen is the murkiest moment.** New worlds start at tick 0 = dawn (grey-green tint);
   within ~2 min it's night. Dusk+night = 45% of every 4-minute day, rendered as a desaturated
   grey-purple wash; dusk goes khaki. A child's first impression is a gloomy field.
2. **Returning load = blank cream screen.** "A new day drifts in…" with no progress for 10–30 s;
   the rAF-driven drain stalls indefinitely in a hidden/occluded tab.
3. **Welcome-back card leads with boilerplate.** First five events chronologically = "X family
   settled into a new home" ×5; births/hatchings hidden behind "…and 47 other".
4. **Guide portraits unrecognizable** (deer→giraffe, kangaroo→bird, dodo→blob) next to gorgeous
   in-game rigs.
5. **No door from the game** to guide/privacy/about — for kids, parents, or crawlers.
6. **Zero onboarding** — no hint that you can drag, zoom, or tap a creature.
7. **~2.9 MB of audio downloads on load** before sound is even enabled.
8. **Hidden tabs**: sim throttles to a fraction of real time and nothing catches up on return;
   no welcome-back for the most common kind of "away".
9. **Silent boot failure**: `void start()` uncaught → plain green page.
10. **No keyboard camera control**; no reduced-motion handling.
11. **Species pages can't play the creature's voice** despite shipping the recordings.
12. Wording: "kid 1" in the inspect card.

Not addressed here (out of scope / other tracks): mobile frame rate (unmeasurable in automation;
user's device check), "nothing to do" retention (G2/G4), reduced-motion (deferred), label/creature
overlap at homes (deferred).

## Decisions

- **Night/dusk are render-only changes.** `TINT_RAMP` night tint lifts to a luminous moonlit blue,
  dusk softens from khaki to a warm rose; the screen-space night wash alpha drops. Clock phase
  fractions, nocturnal logic, voice timing, and every sim constant stay untouched.
- **New worlds open mid-morning**: `state.tick` is set to `MORNING_START_TICK` (≈ 20% of a day)
  immediately after `createWorld()` for a fresh save only. Sim code unchanged; determinism/replay
  unaffected (a save carries its own tick).
- **Catch-up drain must work while hidden**: schedule slices with `setTimeout(0)` when
  `document.hidden`, rAF otherwise; overlay shows progress ("Catching up with the valley… Day 7 →
  Day 9" + thin bar).
- **Visibility catch-up**: on `visibilitychange → visible`, owed = `owedTicks(hiddenMs)` minus the
  ticks the throttled loop already ran while hidden; if > 0 pause the loop, drain under the same
  overlay, then resume and show the welcome-back card for events since hiding. Reuses
  `owedTicks`/`runCatchUp`/`summarizeEvents`.
- **Welcome-back ranking**: group fresh events by (kind, species); rank groups by interest
  (reborn > born/hatched > passed > paired > eggLaid > wandererArrived > nested); count-bearing
  kinds sum their counts into one line, others pluralize ("3 rabbit families settled into new
  homes"). Show all lines when ≤ 6; otherwise 5 + "…and N other little happenings" where N counts
  the events not shown. Existing catch-up tests keep passing.
- **Guide door**: a real `<a href="./guide/">` HUD pill ("🐾 creatures") — a genuine internal link.
- **First-run hint**: when no save exists, a one-time card (same style as welcome-back): header
  "Welcome to Beastoria", three lines (what it is · drag/pinch-or-scroll · tap a creature),
  tap/auto-dismiss.
- **Audio preload moves behind the first unlock gesture** (`AudioEngine.unlock()` starts preload
  once). Ambience fades in as buffers arrive — no download until the user opts in.
- **Boot failure**: `start()` wrapped; on error, render a plain-HTML apology card with a link to
  the guide, and `console.error` the cause.
- **Keyboard**: arrow keys pan, `+`/`=`/`-` zoom (Camera `keydown` on `window`, ignored when the
  target is an input/button).
- **Species-page audio**: native `<audio controls preload="none">` with `.webm` + `.m4a` sources
  for every recorded/designed species (call1); silent species unchanged. Still zero JS.
- **Inspect card**: "kid N" → "little one of the <Family> family".
- **Real-rig portraits (Tier 2)**: a dev-only `?portrait=<species>` route renders one adult rig
  (idle pose, soft backdrop) in a fixed-size Pixi canvas; the controller captures 12 PNGs with
  Playwright into `public/guide/portraits/<id>.png` (committed; `.gitignore` gains
  `!public/**/*.png`). Guide pages switch to `<img>` with alt text; `src/content/portraits.ts` and
  its tests are deleted (the PNGs are the portraits now).

## Constraints

Zero cost (no new dependencies — the portrait capture uses the controller's Playwright, not a
repo dep); 100% code-crafted art (the rig renders *are* the art); nothing under `src/sim/`
changes; all existing tests pass; guide pages stay zero-JS, zero external requests.

## Verification

`npm test` green (existing + updated pages tests), `npm run lint`, `npm run build`; Playwright
pass on `npm run preview`: fresh profile opens in daylight with the hint card; wheel/keys move the
camera; a simulated 3-hour-old save shows a progress overlay then a ranked welcome card; species
pages have an `<audio>` element and a PNG portrait; the game HUD links to `/guide/`; forcing a boot
error shows the apology card. Deployed for the user's live review.
