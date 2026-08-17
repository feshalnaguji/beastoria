# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Beastoria is

A calm, nostalgic, Ghibli-like browser game: a little living world of cute-but-realistic creatures
(animals, birds, fish, extinct, mythical) living in real family structures — pairing, nesting,
laying eggs / birthing, feeding babies, growing through life stages, peacefully aging. The player
watches, pans, zooms (whole world ↔ one family), and listens to real creature voices.

**Full design spec:** `docs/superpowers/specs/2026-08-13-beastoria-v1-design.md` — read it before
any design-affecting work. The spec is the source of truth; this file is the summary.

## Locked roadmap (user decision — do not relitigate)

1. **v1 (NOW): Pure Living Terrarium** — world runs itself; watch/zoom/listen only
2. **v2: Caretaker World** — feeding, care, unlocking families (only after v1 is polished)
3. **v3: Full Management Sim** — Hayday-style economy (only after v2)
4. Far future: Stylized 3D rebuild; real-world-slow time; player-adjustable speed

## Hard constraints (user requirements)

- **Zero cost, ever:** MIT/OSS tooling only, free hosting tiers only (GitHub Pages/Vercel free),
  CC0/CC-BY/public-domain assets only. No paid services, licenses, or subscriptions.
- **Audio licensing:** CC0/PD first, CC-BY or CC-BY-SA with credit in `public/audio/LICENSES.md`
  (per-file source URL, author, license, edits; CC-BY-SA derivatives stay CC-BY-SA). **Never**
  xeno-canto or BBC Sound Effects (non-commercial licenses). Real recordings only; dodo/phoenix
  voices are designed from real relatives per spec.
- **Gentle realism:** full life cycles incl. peaceful elder passings; NO on-screen predation ever.
- **Art:** 100% code-crafted layered vector art (rigs as TS data). No AI images, no asset packs.
- **Targets:** desktop + mobile browsers, 60fps goal, touch pan/pinch.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build (`tsc && vite build`)
- `npm test` — Vitest (sim + persist tests only; rendering is eyeballed via DevPanel)
- `npm run lint` — ESLint incl. the sim-purity boundary rule
- Single test file: `npx vitest run tests/determinism.test.ts`
- In-game dev panel: press `~` (speed 1x/8x/64x, seed, creature inspector, FPS)

## Architecture (the one rule that matters most)

**`src/sim/` is a pure, deterministic, headless module.** It must never import Pixi/DOM or use
`Math.random`/`Date.now`/`performance.now` (lint-enforced). All randomness via seeded sfc32 in
`sim/rng.ts`; all time via tick count. Fixed 10 ticks/sec; `Sim.tick(commands[])` is the only
entry point (commands empty in v1 — they exist for v2). Renderer/audio/UI are observers that
interpolate between snapshots. Offline catch-up runs the same `Sim.tick`.

Breaking this boundary breaks saves, replay determinism, offline catch-up, and the test suite.
The CI determinism test (save-mid-run replay equivalence) guards it.

Module map: `src/app/` (GameLoop fixed-step accumulator, CatchUp, DevPanel) · `src/sim/` (state,
rng, clock, grid, movement=steering-no-A*, behaviors=utility+hysteresis, lifecycle, family FSM,
population regulator, species data defs) · `src/render/` (Renderer, Camera, LOD T0/T1/T2,
ValleyPainter bake-once terrain, RigRenderer/RigBaker/Animator, effects) · `src/rigs/` (art as
TS data: archetype skeletons quadruped/songbird/waterbird/fish; stages = parametric overrides,
never new art) · `src/audio/` (Web Audio bus graph, zoom mixer, CallScheduler consuming sim
'vocalize' events) · `src/persist/` (idb-keyval, versioned SaveFile = WorldState passthrough,
migration chain) · `src/ui/` (vanilla TS HUD, WelcomeBack).

Other invariants: creatures iterated in array order (determinism); cosmetic RNG is a separate
stream (visuals must never perturb the sim); WorldState stays a serializable POJO (save =
JSON passthrough); population balance = fertility gating vs softCap + wanderer floor failsafe +
exactly-one phoenix family (rebirth on elder passing). Saves are single-tab last-write-wins in
v1 (two open tabs overwrite each other's timeline harmlessly).

## Current status (update at each milestone / handoff)

- **Done:** M0 (skeleton+deploy), M1 (sim core: needs/behaviors/clock), M2 (painterly
  valley, zones, water avoidance, day/night grading), M3 (rig pipeline: rabbit+robin,
  stages, LOD, follow-cam), M4 (families: pairing, FSM, homes, eggs/birth, brooding
  turns, feedYoung, dispersal, gentle passing + memorials, population gating), M5 (all
  eight species: deer/duck/koi/owl/dodo/phoenix rigs + defs, movement media incl.
  swimming koi + amphibious ducks, nocturnal owls, deer herd cohesion, wanderer
  arrivals, phoenix single-family rebirth, balance property suite 6 seeds × 30 days ×
  100-day soak), M6 (sound: deterministic vocalize tick-output, real CC-licensed
  voices for 6 species + designed dodo/phoenix from real relatives, 6 ambience beds,
  Web Audio bus engine + autoplay gate + persisted mute, zoom/zone-aware mixer, call
  scheduler, HUD sound chip, LICENSES.md provenance gate), M7 (persistence: versioned
  idb saves + migration chain + frozen fixture, autosave 30s/hidden/pagehide,
  quarter-speed catch-up capped 2 game-days under overlay, welcome-back card, dev
  reset), M8 (polish: de-clump steering narrowed to nest-gather ring, memorial
  lifecycle — 2-day prune + age fade, ambient effects — grass sway/water
  shimmer/dappled light/fireflies, HUD clock + sound-chip a11y + dynamic min-zoom
  world edge, label declutter, DPR/bundle verification — bundle delta +39.29 kB,
  under the 50 kB target), M9 (alive: camera clamped so off-world background can never
  show + dt-normalized damping + deltaMode-aware wheel zoom + single render loop +
  fullscreen chip; six-frame speed-true walk bakes + bird legs + T2 threshold at 0.55;
  sim 'air' movement medium — robin/owl/phoenix fly, cross the pond, never rest on
  water — plus 19 FOOD_SPOTS forage anchors; socialize/court de-clump ring restored
  with root causes fixed — phoenix grove leash + larder, hardCap enforced at laying
  and hatching; flap/swim presentation (lift, shadow detach, duck ripple); carry/sit
  clips + activity glyphs + hatch/birth/pairing sparkles + gentle-passing fades +
  berry clusters at food spots; 135 tests), M10 (v1.2 final: sim bugs fixed (no
  freezing, no water-walking), feedMode realism (nurse/carry/self), 3 new species
  (squirrel/frog/turtle = 11 total), hatch/birth staging, tap-to-inspect card,
  animation crossfade smoothness + arrival settle, labels off, pre-M10-save home
  migration + multi-touch tap guard (final-review fix wave); 161 tests), M11 (v1.3:
  parents forage at real FOOD_SPOTS locations instead of a raw random point, carry
  errand now four visible steps (seek/pickup/carry/deliver), delivery sequenced one
  hungry baby at a time instead of an instant aggregate decrement, nurse and carry
  feeding share one FEED_RANGE radius (closes a sim/render mismatch where fed babies
  could look un-fed), baby leash tightens during any active feed/nurse hold so little
  ones visibly gather in, a new kangaroo species (12 total) with a rig-art pouch/joey
  shown during her nurse hold, an amber/milk-white feed-mote effect and step-aware
  inspect-card text so every feeding is a moment you can watch; 174 tests)
- **Status: v1.3 shipped.** M11 candidate items (raw-point carry foraging, instant
  aggregate feeding, unwatched nursing, missing kangaroo) are all addressed. Next: v2
  Caretaker World (only once the user decides to proceed; feeding, care, unlocking
  families).
- **Awaiting user review:** live check on their devices — the new feeding beats (a
  parent visibly stopping at a berry cluster, one-at-a-time delivery), the nurse-hold
  animation (mother 'sit' + nursed-baby 'eat' clip + milk-droplet glyph, built in M10
  but never eyeballed until now — this is the user's own reserved check), the
  kangaroo's hop gait and pouch/joey, and perf with 12 species population.
- Live: https://feshalnaguji.github.io/beastoria/ · repo: feshalnaguji/beastoria
  (GitHub Pages auto-deploys main; CI runs tests+build)

## Working process (user-agreed)

- Build milestone by milestone (M0–M11 in spec §6); **the user reviews each milestone in the
  browser before the next begins.** Every milestone ends with `npm test` green + `npm run build`
  clean + a deployed/dev URL to look at.
- Mobile perf is tested on a real phone at M2/M3, not deferred to the end.
- New species = data (species def + rig file), not new systems.
- **Session handoff (user request):** when context grows heavy or performance degrades,
  proactively tell the user to start a fresh session and write a handoff: current milestone,
  what's done/verified, what's next, any in-flight decisions. Keep this file and the spec
  current enough that a fresh session can continue seamlessly.
