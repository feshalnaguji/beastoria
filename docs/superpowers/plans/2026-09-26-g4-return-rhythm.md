# G4 "Return Rhythm" Implementation Plan

> Executed natively (controller implements; one independent whole-branch review at the end), per
> the 2026-09-26 execution note in project memory.

**Goal:** Real-calendar seasons and full moons (visual only) plus a self-filling family storybook journal.

**Architecture:** Pure `season.ts` → palette + ambient drift + full-moon grade in the render layer; pure-ish `journal.ts`
(types, caps, text, `JournalRecorder` observer) → persisted as save v3 → `JournalCard` UI behind a HUD pill.

**Spec:** `docs/superpowers/specs/2026-09-26-g4-return-rhythm-design.md`

## Global Constraints
- Nothing under `src/sim/`; no new deps; strict TS, lint, build clean; vitest node env (pure modules only in tests).
- Painter RNG draw sequence unchanged across seasons (colours only).
- Journal caps: 60 pages, 40 entries/page. Save v3 migration + sanitise; `SaveMeta.journal` optional (keeps existing tests).
- Suite: `npx vitest run --minWorkers=1 --maxWorkers=2`, foreground only.

## Review Focus
1. A renamed creature's older journal lines show the new name (text built at display time).
2. A creature that passes is attributed to the family it belonged to, even though the sim's `passed` event has no family id.
3. Parents losing their family link when a family dissolves must NOT read as "set off on their own" (children only).
4. A malformed/tampered journal in a save must sanitise to something valid, never crash boot.
5. Timezone strings that are empty or unknown default to the northern hemisphere.

## Tasks
1. **season.ts + tests** — `Season`, `Hemisphere`, `seasonFor`, `hemisphereFor`, `moonPhase`, `isFullMoon`, `SEASON_ICON`,
   `SEASON_WELCOME`, `seasonOverrides(search)`; `tests/season.test.ts`.
2. **Seasonal valley** — `ValleyPalette` + `SEASON_PALETTES` threaded through `buildValley(palette)`; `AmbientEffects.setSeason`
   (drift particles, summer fireflies); `Renderer.init(mount, { season, fullMoon })`, full-moon grade + sky moon;
   `Hud.setSeason`; season-changed card in `main.ts`.
3. **journal.ts + tests** — `Journal`, `FamilyPage`, `JournalEntry`, `emptyJournal`, `addEntry` (caps), `sanitizeJournal`,
   `entryText`, `pageSummary`, `JournalRecorder { prime, observe }`; `tests/journal.test.ts`.
4. **Save v3** — schema `journal`, `STEPS[2]`, sanitise default, `SaveMeta.journal?`, `saveWorld` clones it,
   `tests/fixtures/save-v3.json`, persist tests appended.
5. **Journal UI + wiring** — `JournalCard.showJournal`, `Hud.onJournal` + `setJournalAvailable`, recorder prime/observe in
   `main.ts` (live tick, boot catch-up, tab-visible catch-up), not in visit mode.
6. **Verify + docs + deploy** — full suite, lint, build, browser pass, CLAUDE.md, one opus review, merge, deploy.
