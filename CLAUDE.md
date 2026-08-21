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
  inspect-card text so every feeding is a moment you can watch; 174 tests), M12
  (v1.4: feeding legibility via feedContactRing (mother and baby < 40 units) +
  turnToward facing + four-beat pacing (30/90/40 ticks settle/nurse/linger) +
  longer head-anchored mote bursts (3-mote staggered, 900ms) + beat-aware
  inspect-card text; real kangaroo pouch-carry sim system (`Creature.carriedBy`,
  zero-draw mount/dismount/graze-window transitions, position-derived rendering
  via Pixi reparenting into pouch rig part, decorative joey deleted); written
  reviewed rig-art recipe (silhouette/markings/shading/motion as four checkable
  dimensions, proved on rabbit/deer/robin/kangaroo); 213 tests)
- **Status: v1.4 shipped and live-reviewed (2026-08-21).** M12 closed three
  threads (feeding contact/facing/pacing, real kangaroo pouch-carry, a reviewed
  rig-art recipe on four species) and deployed. The live review on the deployed
  site found four issues — see below. v2 Caretaker World stays next (only once
  user decides; feeding, care, unlocking families).
- **M13 candidate (from the 2026-08-21 live review — see
  docs/superpowers/reviews/2026-08-21-v1.4-user-review.md for full root-cause
  detail; not yet planned/branched, needs superpowers:brainstorming first):**
  (1) mammal parents (rabbit/deer/squirrel/kangaroo — all live-birth) are shown
  "keeping the eggs warm" during gestation — `InspectCard.ts:124-125`'s
  `'brood'` case is a blanket string with no branch on `reproduction.mode`, and
  `family.ts:424-429` confirms the sim itself reuses the same `'brood'` activity
  id for both egg-sitting and live-birth gestation, so there's no sim-level
  distinction to hang the UI fix on yet either; (2) user wants confirmation that
  mammals genuinely nurse per real-world behavior, not just that the wrong word
  is removed — `feedMode: 'nurse'` already exists and drives real milk-feeding
  behavior for exactly these four species (built M10-M12), but it's unverified
  whether this reads clearly to a live viewer or whether item 1's wrong label
  was itself causing the "mammals aren't behaving like mammals" impression —
  needs a fresh look once item 1 is fixed, not an assumed redesign; (3) kangaroo
  joey mounting reads as "magic" — confirmed exact: `family.ts:171-172`'s mount
  condition is a hard binary flip (`joey.carriedBy = mother.id` the instant
  distance `<= MOUNT_RANGE`) with the render-side reparenting (`Renderer.ts`,
  M12 Task 5) an equally instant snap — the underlying pouch-carry mechanism is
  sound (M12's own review confirmed this), only the *transition* between
  walking and riding is unanimated; (4) feeding still reads as one mechanism
  tuned per species rather than each species' real behavior — not yet
  root-caused, needs the next session to actually watch multiple species feed
  side by side and identify specifically what reads as same-y before scoping a
  fix, the way M12's brainstorm broke "recognizable" into four checkable
  dimensions rather than guessing. **Also candidate, from before this review:**
  apply the reviewed rig-art recipe
  (docs/superpowers/specs/2026-08-21-rig-art-recipe.md) to the remaining eight
  species (squirrel, frog, turtle, duck, owl, dodo, phoenix, koi). **Priority
  item (pre-existing, confirmed unchanged by M12 — measured identically present
  on both the pre-M12 base and this branch, NOT a new defect, but a real
  correctness bug rather than a cosmetic one):** babies of any species can get
  permanently parked in the `'gather'` activity by the nest leash — there is no
  exit condition anywhere in the code. The final whole-branch review measured
  this empirically (30,000 ticks × 3 seeds): 17-26 creatures, roughly 25% of a
  70-77 population, permanently frozen in `'gather'` by the end of a run, with
  freeze streaks up to ~28,000 ticks, in 3/3 seeds tested. **Backlog item
  (pre-existing, out of M12 scope, not blocking):** kangaroo population hardCap
  (8) and SHADE_SCRAPES home-site count (3) are mismatched (predates M12, noted
  during planning, explicitly ruled out of scope per pouch-carry being
  independent of home-site balance) — consider for M13 or later when touching
  kangaroo balance. The next session should decide, during its own brainstorm,
  how many of these become one milestone vs. several — this is a wider set of
  items than a single-thread fix.
- **Open items awaiting user verification:** (1) mobile perf with the
  richer/heavier rig art has NOT yet been confirmed on a real device — this is
  reserved for the user's own physical-device check (same policy as M2/M3
  testing per CLAUDE.md); (2) a carried kangaroo joey is only visible at close
  zoom (T2) — at T0/T1 it renders invisibly inside its mother. This is a real,
  understood, and accepted regression from the old decorative-joey approach
  (which baked into the mother's T1 frame directly), not a bug in the new
  pouch-carry mechanism, which is itself correct. A full fix is M13-sized —
  either give `creatureLayer` a real z-sort or bake a joey-variant T1 frame.
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
