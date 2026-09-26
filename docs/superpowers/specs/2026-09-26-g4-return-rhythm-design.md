# G4 "Return Rhythm" — Design

**Date:** 2026-09-26 · **Status:** design approved by the user ("continue all sections") ·
**Track:** growth & distribution, milestone 4 of 4 (binding track decisions in
`2026-08-22-growth-distribution-design.md`).

## Goal

Give a child a gentle, pressure-free reason to come back: the valley genuinely looks different
with the real seasons and on real full-moon nights, and a family storybook quietly fills itself
with what happened. No streaks, no notifications, no "don't miss out", nothing leaves the device.

## Binding decisions (user, 2026-09-26)

1. **Return hooks: real seasons & moons + a valley keepsake journal.** (Game-clock "special
   nights" and "morning/evening visits differ" were offered and not chosen.)
2. **The journal is a family storybook** — one page per family, named families first.
3. **Approach A:** everything outside the simulation. Seasons are visual only (the sim never sees
   the real date — that would break offline catch-up and replay determinism); the journal is an
   app-layer observer. `src/sim/` is untouched.

## Design

### 1. Seasons & moons (visual only)
- Pure `src/app/season.ts`: `seasonFor(date, hemisphere)` using meteorological seasons
  (north: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter; south shifted six
  months); `hemisphereFor(timeZone)` guesses the hemisphere from the device's IANA timezone
  (e.g. `Australia/*`, `America/Argentina/*` → south) — no location permission, no data leaves;
  `moonPhase(date)` from the mean synodic month; `isFullMoon(date)` = within 1.25 days of full.
- The valley is painted at boot with the season's palette (the current look is **summer**):
  spring — fresher greens, pinker flowers, full blossom; autumn — gold/russet trees, warm
  meadow; winter — frosty sage meadow, muted evergreens with pale snowy tops, pale blossom.
  Only colours change; the painter's RNG draws are identical, so the layout never moves.
- Ambient drift per season: spring petals, autumn leaves, winter snowflakes (slow, sparse,
  world-space); summer instead lets fireflies come out earlier and brighter.
- Full-moon nights (real date): night is softer and silvery (lighter night wash) and a glowing
  moon sits in the sky corner at dusk/night.
- The clock pill shows the season: "Day 7 · ☀️ · 🍂".
- On a visit where the season changed since the last visit, a card says so
  ("Autumn has come to the valley 🍂 — the trees are turning gold and russet"), folded into the
  welcome-back card when there is one. Last-seen season lives in `localStorage['beastoria.season']`.
- Testing overrides (unlisted, harmless): `?season=spring|summer|autumn|winter`, `?moon=full`.

### 2. Journal recorder (app layer)
- `JournalRecorder.observe(state)` runs after every live tick and once after each catch-up drain
  (primed before). It turns sim events with a `familyId` into entries — a pair formed, a home
  found, eggs laid, little ones hatched/born, the phoenix rising again — and diffs creatures
  between observations for what the sim doesn't report per family: a creature growing up
  (juvenile / adult / elder), a young one setting off on its own (was a child, family link
  cleared), and an elder passing peacefully (a creature disappearing — the sim only removes
  creatures when they pass).
- Entries are structured (`{ tick, kind, count?, creatureId?, name?, names? }`); display text is
  built when shown, preferring the creature's *current* custom name, so renames read correctly.
- Not recorded in visit mode. Very long offline catch-ups can outrun the sim's 500-event log;
  those early events are simply not journaled (accepted).

### 3. Storage
- The journal lives in the save: `SAVE_VERSION` 3, `SaveFile.journal`. v2 saves migrate with an
  empty journal; malformed journals are sanitised. The G2 forward-compat guard already stops an
  older build from overwriting a v3 save.
- Caps: 60 family pages (least recently updated dropped first), 40 entries per page (oldest
  dropped). "Reset valley" clears it with the save.

### 4. Storybook UI
- A **📖 journal** pill in the left pill column (visible in child mode — reading is harmless;
  hidden in visit mode) opens a card: family list (named families first, then most recent), each
  with the species emoji and "3 little ones · 2 grown"; tapping opens that family's page
  ("Day 4 — 3 little ones were born"), oldest first, with "← all families" and ✕. Empty state:
  "The journal fills itself as the valley's families grow."

### 5. Testing
- Vitest: season boundaries both hemispheres; hemisphere guesses; full moon at known real full
  moons and not at known new moons; journal entry per event kind, growing-up / set-off / passed
  attribution, caps, text with current names, sanitise; save v2→v3 migration and journal
  round-trip.
- Browser: each season's palette via `?season=`, a full-moon night via `?moon=full`, the season
  card, and the storybook filling in at 64× speed.

## Constraints

Zero cost; no new dependencies; nothing under `src/sim/`; child-directed posture unchanged (no
location, no network, local-only); existing saves migrate losslessly.

## Out of scope

Seasonal behaviour in the sim; weather; real-time-of-day visits; game-clock special nights;
notifications or streaks of any kind.
