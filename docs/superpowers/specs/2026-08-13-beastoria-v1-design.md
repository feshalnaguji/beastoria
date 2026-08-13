# Beastoria — v1 "Pure Living Terrarium" Design Spec

Date: 2026-08-13 · Status: Approved by user · Supersedes: nothing (first spec)

## 1. Vision

Beastoria is a calm, nostalgic, Ghibli-like browser game: a little living world of cute-but-realistic
creatures — animals, birds, fish, extinct species, and mythical beings — living in genuine family
structures. They pair up, build nests/burrows/dens, lay eggs or give birth, feed their babies, grow
through life stages, and peacefully age. The player watches, pans, zooms (whole world ↔ one family),
and listens to their real voices. Soothing for everyone, kids to adults. Web-first.

## 2. Product roadmap (locked)

| Stage | Content | Status |
|---|---|---|
| **v1** | Pure Living Terrarium — world runs itself; watch/zoom/listen only | **BUILD NOW** |
| v2 | Caretaker World — feeding, care, unlocking new families | after v1 is polished |
| v3 | Full Management Sim — Hayday-style economy | after v2 |
| Future | Stylized 3D rebuild; real-world-slow time; player-adjustable speed | far future |

## 3. Locked v1 decisions

- **Core loop:** pure observation — no feeding/economy/interaction beyond camera in v1
- **Art:** 2D painterly top-down (Hayday-style camera); 100% code-crafted layered vector art
  (no AI images, no asset packs)
- **Time:** accelerated ambient — full lifecycle visible in ~one sitting (~40–48 real minutes);
  1 in-game day = 4 real minutes
- **Realism line:** "gentle realism" — full life cycle incl. elders peacefully passing (soft, warm
  moment: family gathers, fade to light motes, memorial flowers); NO on-screen predation ever;
  eating is realistic foraging
- **Roster (8 families, deep):** robin (tree nest, eggs), duck (pond), rabbit (burrow, live birth),
  deer (meadow), koi (pond), owl (tree hollow, nocturnal), dodo (extinct, ground nest, wanderer
  story), phoenix (mythical, mountain grove, rebirth cycle)
- **Audio:** real free-license recordings (CC0/PD/CC-BY only — commercial-safe); dodo and phoenix
  get research-based designed voices layered from real relatives
- **Persistence:** local-only IndexedDB, versioned save, offline catch-up; no accounts/backend
- **Engine:** PixiJS v8 + TypeScript (strict) + Vite; vanilla TS UI; Vitest for sim tests
- **Deploy:** free static hosting (GitHub Pages or Vercel free tier)
- **Zero-cost constraint:** everything free and open source — MIT/OSS tooling, free hosting tiers,
  CC0/CC-BY/PD assets, no paid services/licenses/subscriptions at any stage
- **Targets:** desktop + mobile browsers (touch pan / pinch zoom), 60fps goal

## 4. Architecture

### 4.1 Core stance

The simulation is a pure, deterministic, headless TypeScript module — no Pixi/DOM/`Date`/
`Math.random` imports (lint-enforced via `no-restricted-imports` + banned globals in `src/sim`).
It advances in fixed ticks (10/sec at 1x), consumes only its own state + seeded RNG, and emits
events per tick. Rendering, audio, and UI are observers that interpolate between sim snapshots
(fixed timestep + accumulator; render at rAF with alpha interpolation).

This single boundary buys: offline catch-up (run ticks fast, rendering detached), reproducible
Vitest tests, future speed controls (v-future), and v2 interactions — `Sim.tick(commands: Command[])`
exists from day one with an always-empty command array.

Tab-hidden and days-away both use the same catch-up code path.

### 4.2 Module structure

```
src/
├── app/        GameLoop (fixed-step accumulator), CatchUp, DevPanel (~ key: speed 1x/8x/64x,
│               seed readout, creature inspector, FPS/drawcalls)
├── sim/        PURE: Sim.ts (tick pipeline), state.ts, rng.ts (sfc32), clock.ts, grid.ts,
│               movement.ts (steering, no A*), behaviors/ (utility scoring + hysteresis),
│               lifecycle.ts, family.ts (FSM), population.ts, events.ts, species/ (8 data defs)
├── render/     Renderer, Camera (pan/pinch/wheel, damped, family-follow), Lod (T0/T1/T2),
│               terrain/ValleyPainter (bakes zones to RenderTextures once) + valleyData,
│               creatures/ (RigRenderer, RigBaker, Animator), effects/ (DayNightGrade, GrassSway,
│               WaterShimmer, Fireflies, DappledLight, Memorials), labels.ts
├── rigs/       ART AS DATA: format.ts, archetypes.ts (quadruped/songbird/waterbird/fish shared
│               skeletons + default clips), 8 species rig files, palettes.ts
├── audio/      AudioEngine (custom Web Audio bus graph, ~150 lines), Mixer (zoom/position→gains),
│               CallScheduler (consumes sim 'vocalize' events), manifest.ts
├── persist/    store.ts (idb-keyval), schema.ts (versioned SaveFile), migrations.ts
└── ui/         Hud.ts (clock, mute, sound-on chip), WelcomeBack.ts
tests/          determinism, lifecycle, population, family, catchup, migrations (sim+persist only)
public/audio/   LICENSES.md (per-file provenance — shipping gate), ambience/, families/
```

### 4.3 Simulation

- **Entity model:** plain serializable POJO records + free-function systems (no classes, no full
  ECS). `WorldState` = `{ tick, rng: [u32×4], nextId, creatures[], families[], homes[],
  memorials[], eventLog }`. Save = JSON of WorldState. Creatures iterated in array order; removals
  compacted end-of-tick; single RNG stream in fixed pipeline order ⇒ exact replay.
- **Creature:** id, species, familyId, sex, stage (egg|baby|juvenile|adult|elder|passing),
  ageTicks, lifespanTicks (rolled ±15% at birth), pos/vel/heading, needs {hunger, rest, social},
  activity {id, ticks, target}, genes {size, hueShift, markings} (cosmetic only).
- **Tick pipeline (fixed order):** clock → needs decay → behavior selection → movement → activity
  effects → family FSM → lifecycle/aging → population regulator → collect events.
- **Behavior:** utility scores over ~14 activities (idle, wander, forage, drink, sleepHome, napSpot,
  socialize, preen, court, buildNest, brood, feedYoung, returnHome, pass) with +0.15 hysteresis
  bonus and min-durations to prevent flicker. Owls' day-curve inverted. Brooding parents alternate
  (one broods, one forages). Babies never forage; parents carry food to them; juveniles forage
  near home.
- **Family FSM:** single → courting → nesting → expecting → rearing → emptyNest → (cooldown) →
  nesting. Pair formation needs two unpaired opposite-sex adults with high social need +
  population regulator permission.
- **Movement:** steering only (seek/arrive/wander + soft obstacle repulsion + walkability mask:
  koi water-only, ducks amphibious, deer avoid deep water). No pathfinding — zones are authored
  open/convex-ish.
- **Gentle passing:** elder exceeding lifespan walks to home or a clearing; family members
  approach and settle ~20s; `passed` event; renderer fades creature to drifting light motes;
  memorial flower cluster blooms (fireflies visit at night). Never a collapse.
- **Population balance (3 layers):**
  1. Fertility gating: nesting allowed only below softCap; clutch size scales down near cap;
     hard stop at hardCap (negative-feedback controller → converges to band around softCap)
  2. Wanderer arrivals: below floor (or missing a sex), a new adult wanders in from map edge —
     extinction failsafe and canonically the dodo's story
  3. Phoenix: exactly one family ever; elder's passing IS the rebirth (settles in grove, glows,
     leaves one egg in soft embers)
- **RNG:** sfc32 (4×uint32, serializable). Separate cosmetic RNG for presentation so visuals can
  never perturb the sim. Same-engine replay determinism is a hard CI-tested requirement;
  cross-device float determinism is a non-goal.

### 4.4 Rendering

- **Valley:** one hand-authored map ~4096×3072 world units; zones: meadow (center), pond (SE),
  forest (NW), mountain grove (N, phoenix's ancient tree); seeded scatter (trees/rocks/flowers/
  reeds). `ValleyPainter` bakes terrain once into 2–3 RenderTextures (gradient washes, feathered
  zone blobs, vector detail stamps) → static sprites, near-zero per-frame cost.
- **Camera:** pointer-events (mouse+touch unified), wheel+pinch zoom clamped [0.15 whole-valley …
  3.0 one-family], exponential damping, momentum flicks, double-tap to frame nearest family,
  soft-clamped to valley bounds.
- **LOD per creature by screen size:** T0 world view = single baked sprite frame + bob;
  T1 mid = baked 2-frame flipbook per activity; T2 close (≤~8 on screen) = live rig transform
  tree, full clips, secondary motion, family label, blob shadow.
- **Rig format (art as data):** per-species TS file: draw-ordered parented parts, each with
  painterly `VectorShape[]` (path/ellipse/capsule + solid/linear/radial gradient fills, rendered
  via Pixi v8 FillGradient); 4 shared archetype skeletons (quadruped, songbird, waterbird, fish)
  provide default clips; species override only distinctive clips; life stages are parametric
  overrides (scale, per-part scale — baby big-head/stubby-legs, elder silvered palette shift,
  egg renders species egg shape) — never new art.
- **Animator:** clip playback + procedural sweetening (ear/tail follow-through lag, breathing
  scale, blink timer). `RigBaker` renders rig × stage × poses to runtime spritesheet at load
  for T0/T1.
- **Painterly look, mobile-safe:** gradients everywhere, live filters almost nowhere; soft edges
  baked at load. Day/night = tint ramp per layer from clock phase + one additive warm-light
  overlay at dawn/dusk. Grass sway = per-sprite sine skew; water shimmer = two counter-scrolling
  soft-noise textures; dappled light = 3–4 drifting soft-alpha additive blobs; fireflies =
  single ParticleContainer, night only.

### 4.5 Audio

- **Assets:** CC0/PD-first, CC-BY with credit. Per family: call, chatter, baby (2–3 variants);
  5 ambience beds (dawn chorus, day meadow, night crickets, water, wind).
  `public/audio/LICENSES.md` records per-file source URL, author, license, edits — shipping gate.
- **Engine:** custom Web Audio wrapper (not howler): per-family GainNode buses → ambience bus →
  master; buffer loading; fades. AudioContext starts suspended; first pointerdown resumes +
  2s ambience fade-in; "🔈 sound on" HUD chip until then; mute persisted.
- **Mixing:** per-frame audibility from family-centroid distance + zoom. World view: beds
  prominent, sparse distant lowpassed calls. Close view: framed family +6dB, others −9dB,
  zone bed (water lap near pond). Beds crossfade on day-phase changes.
- **Truthful soundscape:** sim emits deterministic `vocalize` events (owls at night, robins at
  dawn); `CallScheduler` gates by audibility, throttles per family, picks variants via cosmetic
  RNG. A family with no clips stays silent — the game never depends on one asset.
- **Voice design:** Dodo (giant pigeon; Nicobar pigeon closest relative; endocast studies → low
  resonant coos): Victoria crowned pigeon boom + wood-pigeon coos −3–7 st + sub-100Hz body,
  slow two-note phrases. Phoenix: common crane bugle + trumpeter swan warmth + loon wail +
  mourning-dove purr idle; low-passed fire-crackle bed −12dB under voice, ember-shimmer swells
  on calls. Deer (free recordings scarce): pitch-shifted lamb bleat (film-standard technique)
  or softened red-deer grunt; Pixabay fallback. Rabbits realistically near-silent: thumps,
  sniffs, rare soft honk.
- **Never use:** xeno-canto (NC licenses), BBC Sound Effects (RemArc non-commercial), any paid
  source.
- **Delivery:** Opus (.webm) + AAC (.m4a) fallback; beds 64–96kbps stereo, one-shots 48–64kbps
  mono; loudness −16 LUFS/−1.5 dBTP one-shots, beds 4–6 LU quieter; ffmpeg
  `highpass=f=90,afftdn,loudnorm` (prefer 200–400Hz highpass over aggressive denoise for birds).

### 4.6 Persistence & offline catch-up

- `idb-keyval` under `beastoria.save` + `beastoria.settings`. SaveFile = `{ version, savedAtEpochMs,
  worldSeed, sim: WorldState }` (POJO passthrough). `migrations.ts` = ordered v(n)→v(n+1) chain;
  frozen fixtures per version tested.
- Autosave every 30s on tick boundary + on `visibilitychange→hidden` + `pagehide`.
- Catch-up: owed ticks = elapsed × 0.25× live rate (valley "drowses" while away), capped at
  2 in-game days; full-fidelity (same `Sim.tick`, POJO math runs in <1s); budgeted 8ms chunks
  under dawn-fade overlay; then "While you were away…" card from sim eventLog.

## 5. Testing

**Unit (Vitest, sim+persist only):** determinism (same seed 20k ticks → identical hash; and
tick 20k straight ≡ tick 10k → save → load → tick 10k), lifecycle boundaries, population
property tests (100 game-days × 10 seeds: every species within [floor, hardCap], no extinction,
wanderer fires when forced, phoenix count === 1), family FSM ordering, migration fixtures.

**Eyeballed with tooling:** rendering, animation feel, grading, audio mix, touch feel —
via DevPanel speed slider (1x/8x/64x), skip-to-dusk, inspector.

## 6. Milestones (each browser-reviewable, user reviews before next)

| # | Milestone | Reviewable demo |
|---|---|---|
| M0 | Walking skeleton: scaffold, strict TS, ESLint sim-boundary, GameLoop, one rabbit shape roaming, camera, live static deploy | Rabbit-ish shape roams; pan/zoom on phone at real URL |
| M1 | Sim core: tick pipeline, sfc32, clock/day-night, needs+utility behaviors, Vitest+determinism green (debug circles) | Circles forage/nap/cluster; night falls; 64x dev speed |
| M2 | The valley: zone bake, camera clamps, day/night grading, LOD scaffolding | Painterly valley; warm sunset |
| M3 | Rig pipeline (go/no-go hinge): rabbit+robin full rigs all stages, T0/T1/T2 | Zoom dots → animated rabbit; baby next to elder |
| M4 | Family life: FSM end-to-end rabbit (burrow/live birth) + robin (nest/eggs), gentle passing + memorials | Robin pair builds nest, broods, feeds hatchlings in one sitting |
| M5 | All 8 species: swim, nocturnal owl, deer herd cohesion, dodo wanderers, phoenix rebirth, balance test suite | Whole valley lives; owls wake as robins roost |
| M6 | Sound: engine, autoplay gate, beds, per-family calls, zoom mixing, LICENSES.md complete | Dawn chorus; zoom to pond hears ducks over crickets |
| M7 | Persistence: schema/migrations/autosave, catch-up, welcome-back card, catch-up determinism test | Return next day: ducklings hatched while away |
| M8 | Polish: grass/water/fireflies/dappled light, HUD, DPR cap, real-device perf pass, final deploy | v1: watch the valley breathe on your phone |

## 7. Risks

1. **Mobile fill-rate** → bake everything static, zero live mobile filters, ParticleContainer,
   DPR≤2, real mid-tier Android test at M2/M3
2. **Vector-art scope (8 species × 5 stages × ~8 clips)** → shared archetypes, parametric stages,
   M3 explicit go/no-go with 2 species before committing 6 more
3. **Determinism leaks** → lint-enforced sim boundary, fixed pipeline order, cosmetic RNG split,
   save-mid-run replay CI test
4. **Population degeneracy over long runs** → negative-feedback fertility controller + wanderer
   floor + property tests + 2-game-day catch-up cap bounds unobserved drift
5. **Audio licensing** → CC0/PD-only policy, per-file provenance manifest audited before M6,
   graceful silence degradation

## 8. Future-proofing (v1 boundaries that make v2 cheap)

- `Sim.tick(commands[])` from M1 (empty) → v2 feeding/care = new command types, replayable/testable
- Food as tagged world nodes → v2 player treat = another node with higher utility weight
- Time scale lives only in GameLoop → speed controls are a one-line presentation change
- eventLog (welcome-back) → natural substrate for v2 family journal
- Camera family hit-testing → tap-to-interact reuses the same path
- Versioned migrations from day one → v2 never strands a v1 valley
