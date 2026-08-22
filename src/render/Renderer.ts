/**
 * Renderer: observes WorldState snapshots and draws interpolated frames.
 * M3: the rig pipeline — live skeletal rigs at close zoom (T2), baked sprite
 * frames at mid/world zoom (T1/T0), life-stage proportions, day/night grading.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { getClock, TICKS_PER_DAY, type Clock } from '../sim/clock';
import type { SimEvent } from '../sim/events';
import { SPECIES, speedFor } from '../sim/species';
import {
  isCarried,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Creature,
  type Home,
  type HomeKind,
  type LifeStage,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../sim/state';
import { isWater } from '../sim/valley';
import { FEED_CONTACT_RANGE, FEED_RANGE, type Feeding } from '../sim/behaviors';
import type { ClipName, CreatureRig } from '../rigs/format';
import { ALL_RIGS } from '../rigs/allRigs';
import { Camera } from './Camera';
import { lodTier } from './Lod';
import { bakedFrame, type BakedFrame } from './creatures/RigBaker';
import { buildRig, multiplyTints, type RigInstance } from './creatures/RigRenderer';
import { buildValley } from './terrain/ValleyPainter';
import { AmbientEffects } from './effects/Ambient';
import { Rectangle } from 'pixi.js';

/** Cosmetic-only seed for ambient effect placement — never the sim's RNG. */
const AMBIENT_SEED = 20260815;

const RIGS: Partial<Record<SpeciesId, CreatureRig>> = Object.fromEntries(
  ALL_RIGS.map((r) => [r.species, r]),
);

const FALLBACK_RIG = ALL_RIGS[0] as CreatureRig;
/** Matches src/sim/family.ts MEMORIAL_TICKS — memorials linger two game-days. */
const MEMORIAL_TICKS = 2 * TICKS_PER_DAY;

function rigFor(species: SpeciesId): CreatureRig {
  return RIGS[species] ?? FALLBACK_RIG;
}

interface CreatureView {
  id: number;
  node: Container; // world-positioned, flip container
  rig: RigInstance;
  spriteWrap: Container;
  sprite: Sprite;
  frames: {
    idle: BakedFrame;
    walk: BakedFrame[];
    flap?: BakedFrame[];
    swim?: BakedFrame[];
    eat: BakedFrame;
    sleep: BakedFrame;
    carry: BakedFrame;
    sit: BakedFrame;
    /** M12 task 3: single mid-pose bakes, present only for the four
     * Thread-C rigs (rabbit/deer/robin/kangaroo) that define these clips —
     * mirrors the flap/swim existence guard above. */
    feedGive?: BakedFrame;
    feedTake?: BakedFrame;
    /** M13 Task 10: single mid-pose bake for the pouch mount/dismount
     * errand's own pose — present only for rigs that author a 'mount' clip
     * (today, only kangaroo). Same existence-guard pattern as feedGive/
     * feedTake above. */
    mount?: BakedFrame;
  };
  label: Text;
  species: SpeciesId;
  stage: LifeStage;
  prev: Vec2;
  curr: Vec2;
  heading: number;
  activityId: string;
  /** Copied from `c.activity.step` each sync (M9 task 5) — distinguishes
   * feedYoung's carry-mode legs (0 seek, 1 pickup pause, 2 carry home, 3
   * delivery hold — M11 renumbering) for clipFor. */
  step: number | undefined;
  /** Copied from `c.activity.minTicks` each sync — the only render-visible
   * signal that separates the mourning 'gather' from its two other reuses
   * (see MOURNING_GATHER_MIN_TICKS). */
  minTicks: number;
  /** World-px nudge applied while brooding at a treeNest home, so the
   * sitter renders in the drawn bowl rather than at the tree's own point
   * (0,0 for every other home kind / non-brooding creature). */
  broodOffsetX: number;
  broodOffsetY: number;
  /** The activity glyph currently showing (or fading out), and its eased
   * alpha — see GLYPH_FADE_MS and glyphKindFor(). */
  glyphKind: GlyphKind | undefined;
  glyphAlpha: number;
  /** Ground distance traveled (world px), wrapped at the rig's strideLength —
   * drives T1 flipbook frame selection off actual displacement, not the
   * wall clock (M9 task 2: cadence must track speed, not glide at a fixed
   * blink rate). */
  odometer: number;
  /** Last frame's rendered (interpolated) position, for computing per-frame
   * displacement into the odometer above. */
  lastX: number;
  lastY: number;
  /** Eased 0 (grounded) .. 1 (airborne) progress toward the flight-lift pose
   * (M9 task 4). Stays at 0 for every non-air-medium species — only
   * mutated when this view's species can fly. */
  liftT: number;
  /** The rig's 'shadow' part's authored local y-offset (constant across
   * stages), cached once so the lift illusion doesn't re-scan rig.parts
   * every frame. */
  shadowBaseY: number;
  /** Duck-only: a baked ripple sprite nested in the rig's shadow container,
   * shown instead of the shadow ellipse while swimming. Undefined for every
   * other species. */
  rippleSprite?: Sprite | undefined;
  /** Amphibious-only hysteresis (M10 task 4): the last STABLE swim/land
   * decision, only flipped once `swimAgreeCount` below reaches 3 consecutive
   * frames of the raw isWater reading disagreeing with it — kills the
   * shoreline clip flicker a single hard boundary test used to produce.
   * Always false for non-amphibious species (never read for them). */
  swimmingState: boolean;
  /** Consecutive frames the raw isWater reading has disagreed with
   * `swimmingState` — reset to 0 the instant it agrees again. */
  swimAgreeCount: number;
  /** M10 task 4: true this sync while this creature is the nurse-hold
   * mother (feedMode 'nurse', activity 'feedYoung' step 1) — reads as
   * settled ('sit' clip, milk-droplet glyph) instead of 'eat'. */
  nursing: boolean;
  /** M10 task 4: true this sync while this baby sits within
   * FEED_RANGE of its family's nursing mother — reads as snuggled in
   * ('eat' clip) regardless of its own activity. */
  nursed: boolean;
  /** M12 task 3: true this sync while this baby is within
   * FEED_CONTACT_RANGE of its family's parent currently in the "actual
   * feeding is happening" step (nurse step 2 or carry step 3) — tighter
   * and mode-agnostic compared to `nursed` above, which is nurse-only and
   * uses the wider FEED_RANGE. Drives feedTake clip selection. */
  feedContact: boolean;
  /** M11: ms remaining on a "just got fed" hold, set to FED_HOLD_MS by
   * onFeedings() the instant this baby is named in a Feeding, then decayed
   * every rendered frame. While > 0 the baby reads 'eat' and shows the
   * carry/nurse-tinted fed glyph (see fedGlyphFor) regardless of its own
   * activity — a per-view float, nothing persisted. */
  fedMs: number;
  /** M10 task 4: which emergence is currently easing in — 'hatch' (pure
   * scale 0→1 at the nest point) or 'birth' (scale 0.3→1 + a small outward
   * slide from the home mouth) — or undefined once settled/for every
   * ordinary creature. */
  emergeKind: 'hatch' | 'birth' | undefined;
  /** Ms elapsed since this emergence started; the view reverts to normal
   * rendering (emergeKind cleared) once it passes EMERGE_MS. */
  emergeMs: number;
  /** Birth-only: unit vector from the home mouth toward this baby's actual
   * spawn point, computed once when the emergence starts — drives the
   * outward slide (see EMERGE_SLIDE_PX). Unused (0,0) for hatches. */
  emergeDirX: number;
  emergeDirY: number;
  /** Ms accumulated toward this sleeper's next drifting 'z' — only advances
   * while actually napping; resets to 0 the moment it stops (so waking mid-
   * cycle doesn't leave a z queued to fire the instant it dozes off again). */
  zzzTimerMs: number;
  /** This view's own jittered cadence around ZZZ_INTERVAL_MS, fixed at
   * creation off the creature's id — pure cosmetic variety, no RNG draw. */
  zzzIntervalMs: number;
  /** Ms since this glyph started showing — drives the gentle sine bob
   * (period 2.4s, amplitude ±1.5px) and is reset when glyphKind changes
   * (M10 task 4 fix). Never allocated; a per-view float only. */
  glyphBornMs: number;
  /** M10 task 5: this frame's airborne read (mirrors the local `airborneNow`
   * computed in render()) — mirrored onto the view so InspectCard's "doing"
   * text (via presentationFor()) can agree with what's on screen without
   * recomputing the speed/medium inference itself. */
  airborneNow: boolean;
  /** M12 task 5: mirrors `Creature.carriedBy` (null when on its own feet) —
   * kept on the view (rather than re-read from state each frame) so sync()
   * can detect the mount/dismount transition edge (compare against the
   * previous value) and render() can force this view's clip to 'sit'
   * while carried, regardless of its own activity. */
  carriedBy: number | null;
  /** True only once `carriedBy` has actually been resolved into a live
   * reparenting — the carrier has a view AND that view's rig defines a
   * `pouch` container (only the kangaroo's does today). False whenever
   * `carriedBy` is null, and also (defensive fallback) when it is non-null
   * but no pouch could be found — such a view renders at its own
   * interpolated position exactly like an uncarried creature, rather than
   * crashing or vanishing. */
  pouchAttached: boolean;
  /** M13 task 9 — mount ease only: the joey's own position at the instant
   * of reparenting (still in its old parent's local space at that moment),
   * converted into the mother's pouch-local space via `pouch.toLocal`.
   * While defined, render()'s `pouchAttached` branch lerps `view.node`'s
   * local position from here toward the fixed `POUCH_RIDER_OFFSET` (an
   * ease-out-cubic of `pouchEaseMs / POUCH_EASE_MS`) instead of snapping
   * straight to it. Cleared (`undefined`) the instant that ease completes,
   * so the steady-state render path afterward is byte-identical to M12's —
   * the whole point of a self-clearing offset (EMERGE_MS's own precedent),
   * not just tidiness. */
  pouchEaseFrom: Vec2 | undefined;
  /** M13 task 9 — dismount ease only: the world-space (creatureLayer-local)
   * gap between the pouch anchor point and the joey's own actual new
   * position, captured at the instant of release. Eased down to (0, 0)
   * over POUCH_EASE_MS and added on top of the normal interpolated
   * `(x, y)` in render()'s NOT-attached branch — the same composition slot
   * `broodOffsetX/Y`, `emergeOffX/Y`, and `liftPx` already share. Cleared
   * once the ease completes; undefined for every creature that has never
   * dismounted. */
  pouchEaseDelta: Vec2 | undefined;
  /** M13 task 9: ms elapsed into whichever of the two eases above is
   * currently active. Shared by both fields since they're never active at
   * once — `pouchAttached` flips exactly once between a mount and its
   * eventual dismount — and reset to 0 the instant either one starts. */
  pouchEaseMs: number;
}

/** Baked walk frames per species (Step 1: symmetric 3-key clips sample
 * identically at t=0.25/0.75, so two "alternating" frames were pixel-twins
 * for 7 of 8 species — sampling off the symmetry points fixes it). */
const N_WALK_FRAMES = 6;
/** T1 flap frames baked at poseT 0 and 0.5 (Step 1 of the brief). */
const N_FLAP_FRAMES = 2;
/** Fallback world px per walk cycle when a rig omits strideLength. */
const DEFAULT_STRIDE_LENGTH = 30;

/** Render-only inference (no sim field): an air-medium species reads as
 * "airborne" once it's covering ground at a real clip — this fraction of
 * its own top speed — filtering out the tiny idle/breathing sway so a
 * standing robin never flickers into a wing-beat. */
const AIRBORNE_SPEED_FRACTION = 0.6;
/** Takeoff/landing ease: the body lift and shadow scale/offset ramp over
 * this many ms in both directions, so neither ever pops. */
const LIFT_EASE_MS = 400;
const LIFT_MAX_PX = 12;
const SHADOW_AIRBORNE_OFFSET_PX = 8;
const SHADOW_AIRBORNE_SCALE = 0.6;
/** Duck swim ripple: gentle scale pulse period. */
const RIPPLE_PULSE_MS = 2400;
const RIPPLE_PULSE_AMPLITUDE = 0.15;

/** M9 task 5: a passing elder's view lingers this long, easing out instead
 * of vanishing on the same frame it leaves state.creatures. */
const PASSING_FADE_MS = 1200;
/** How long a glyph takes to fade in or out when its activity starts/ends. */
const GLYPH_FADE_MS = 300;
/** Glyph radius is screen-compensated (constant apparent size at any zoom),
 * clamped to a sane range of world px. */
const GLYPH_RADIUS_K = 3.5;
const GLYPH_RADIUS_MIN = 4;
const GLYPH_RADIUS_MAX = 14;
/** World-px slack around the viewport a glyph may sit in before it's culled
 * as off-screen — generous enough that a glyph never pops in/out at the edge. */
const GLYPH_CULL_MARGIN = 60;
/**
 * Matches src/sim/family.ts PASS_GATHER_TICKS. The 'gather' activity is
 * reused for three different family moments (mourning a passing elder,
 * settling onto a new nest, herding a wandering baby home) that the sim
 * doesn't otherwise distinguish; mourning is the only one with this long a
 * minTicks (30 for the other two), so it cleanly separates the "mourning
 * circle" glyph without any sim change.
 */
const MOURNING_GATHER_MIN_TICKS = 200;
/** Matches the treeNest bowl's draw offset from home.pos (syncHomes, the
 * 'treeNest' case below) — a brooding sitter renders here instead of at the
 * home's own point, so it visibly sits IN the bowl. */
const TREE_NEST_BOWL_OFFSET: Vec2 = { x: 38, y: 26 };
/** Event kinds that spawn the generic moment sparkle (M9 task 5). 'hatched'
 * and 'born' were removed in M10 task 4 — they now get their own staged
 * moments (the shell-crack overlay, the emergence scale/slide) instead of
 * the generic sparkle, which would look redundant on top of them. */
const SPARKLE_EVENT_KINDS = new Set<SimEvent['kind']>(['paired', 'reborn']);

/** Egg-mode home kinds (every species whose `reproduction.mode` is 'egg') —
 * these are the only homes whose `syncHomes` egg draw is replaced by the
 * hatch crack overlay when phase leaves 'expecting' (M10 task 4). The three
 * live-birth homes (burrow/glade/drey) never draw eggs at all — nothing was
 * visible during 'expecting', so nothing needs replacing when it ends. */
export const EGG_HOME_KINDS: ReadonlySet<HomeKind> = new Set([
  'treeNest',
  'reedNest',
  'lilyPatch',
  'treeHollow',
  'groundNest',
  'groveNest',
  'spawnClump',
  'sandNest',
]);

/** Approximates each egg-mode home's own nest-bowl point (mirroring
 * `syncHomes`' own egg-cluster offsets from `home.pos`), so the hatch crack
 * overlay lands where the eggs it replaces were actually drawn. */
const NEST_VISUAL_OFFSET: Partial<Record<HomeKind, Vec2>> = {
  treeNest: { x: 38, y: 22 },
  reedNest: { x: 0, y: -3 },
  lilyPatch: { x: -6, y: 10 },
  treeHollow: { x: 0, y: -6 },
  groundNest: { x: 0, y: -2 },
  groveNest: { x: 0, y: -3 },
  spawnClump: { x: 0, y: -1 },
  sandNest: { x: 0, y: -1 },
};

function nestVisualPoint(home: Home): Vec2 {
  const off = NEST_VISUAL_OFFSET[home.kind];
  return off ? { x: home.pos.x + off.x, y: home.pos.y + off.y } : { ...home.pos };
}

/** Small, gentle activity glyphs floating above a creature's crown — the
 * valley's readable vocabulary for its richest loops (M9 task 5). 'nurse'
 * joined in M10 task 4 — a soft milk-white droplet, replacing the amber
 * 'carry' dot specifically for nurse-feedMode mothers mid-hold. */
type GlyphKind = 'forage' | 'nap' | 'court' | 'carry' | 'brood' | 'mourning' | 'nurse' | 'gestate';

/** M11: how long a just-fed baby keeps reading as fed (clip 'eat', a
 * carry/nurse-tinted glyph — see fedGlyphFor) before decaying back to
 * normal — long enough to read as "this one just got fed" without lingering. */
const FED_HOLD_MS = 1200;
/** Feed mote tints (M11) — the same two colours the carry/nurse glyphs
 * already use, so the mote and the glyph it leads into read as one
 * vocabulary: amber for a carried mouthful, milk-white for a suckle. */
const FEED_MOTE_TINT_CARRY = 0xe8a53c;
const FEED_MOTE_TINT_NURSE = 0xf7f3e8;
/** M12 task 3: a Feeding now spawns a small burst rather than one mote, so
 * the moment reads as a flourish instead of a single blink — staggered by
 * FEED_MOTE_BURST_STAGGER_MS apiece (see Ambient's FeedMote.delayMs) so the
 * 3 trail rather than overlap. */
const FEED_MOTE_BURST_COUNT = 3;
const FEED_MOTE_BURST_STAGGER_MS = 90;
/** Hatch/birth emergence: scale (and, for births, a small outward slide)
 * eases in over this long, then the view settles into normal rendering. */
const EMERGE_MS = 900;
/** Birth-only: the newborn visually recedes from the home mouth by this
 * many px, easing to 0 extra offset by EMERGE_MS — independent of how far
 * family.ts's own spawn jitter actually placed it. */
const EMERGE_SLIDE_PX = 12;
/** A sleeping creature's average gap between drifting 'z's — jittered per
 * view (see CreatureView.zzzIntervalMs) so a napping cluster doesn't emit in
 * lockstep. */
const ZZZ_INTERVAL_MS = 2500;

/** M12 task 5: a carried joey's view, once reparented into its carrier's
 * rig `pouch` container, sits at this fixed LOCAL offset within it —
 * (0,0) is exactly the anchor point kangarooRig.ts's `pouch` part occupies,
 * which already centers a rider's own head (root-relative, post baby-stage
 * 0.4 scale) just above `pouchFront`'s top edge, so no extra nudge is
 * needed. Not derived from the sim's `joey.pos` (which the sim sets equal
 * to the mother's own position every tick — see sim/movement.ts) — that
 * would double-count "where the pouch is" (the parent chain already
 * handles it) with "where the joey sits inside it". */
const POUCH_RIDER_OFFSET: Vec2 = { x: 0, y: 0 };
/** zIndex a reparented rider is given inside the pouch container — between
 * kangarooRig.ts's `pouchBack` (z 1) and `pouchFront` (z 3), so the near
 * rim genuinely draws over her lower body while the back wall stays behind
 * her, the illusion the M11 decorative pouch/joey art never achieved. */
const POUCH_RIDER_Z = 2;
/** M12 task 5 (Task 4 review follow-up): a riding joey's own `curr`
 * position is literally its mother's (sim/movement.ts's carried-position
 * derivation) — using it to place a feed mote would land the mote at her
 * center, not near the pouch where the feeding is actually happening. This
 * is the pouch's approximate WORLD-space offset from the mother's own root
 * instead, derived from kangarooRig.ts's authored numbers: `body` sits at
 * (0,-20) off her root, and `pouch` sits at (6,20) off `body`, summing to
 * (6,0) — mirrored across x for a mother facing left, exactly as her whole
 * rig already flips (see the facingLeft scale.x logic in render()). */
const POUCH_WORLD_OFFSET_X = 6;
const POUCH_WORLD_OFFSET_Y = 0;

/** M13 task 9: the pouch mount/dismount errand (Task 8's sim-side `'mount'`
 * activity) now eases visually instead of snapping — this is that ease's
 * wall-clock duration. Modeled directly on EMERGE_MS's shape (self-
 * clearing, one-way, ease-out-cubic offset composed onto the interpolated
 * position) rather than LIFT_EASE_MS's reversible smoothstep: mounting and
 * dismounting are each a one-way transition with a definite end, never
 * reversed mid-flight the way lift can flicker takeoff/landing. */
const POUCH_EASE_MS = 600;

/** A view mid-fade after leaving state.creatures (M9 task 5's gentle
 * passing) — drained in the render loop rather than destroyed same-frame. */
interface FadingView {
  view: CreatureView;
  remainingMs: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** M10 task 4: true while this baby sits within FEED_RANGE of its
 * family's currently-nursing mother (nursingMotherPos, built once per sync
 * in sync() above). M11: this now shares the sim's own feed radius
 * (src/sim/behaviors.ts's FEED_RANGE) instead of a narrower render-only
 * constant, so every baby the sim actually feeds reads as fed on screen. */
function isNursed(c: Creature, nursingMotherPos: Map<number, Vec2>): boolean {
  if (c.stage !== 'baby' || c.familyId === null) return false;
  const m = nursingMotherPos.get(c.familyId);
  if (!m) return false;
  return Math.hypot(c.pos.x - m.x, c.pos.y - m.y) <= FEED_RANGE;
}

/** M12 task 3: true while this baby sits within FEED_CONTACT_RANGE of its
 * family's parent currently in the "actual feeding is happening" step —
 * nurse mode's step 2 (the nursing hold itself) or carry mode's step 3
 * (the delivery hold) — built from `feedGivingPos`, a per-family map of
 * that parent's position (both modes, unlike `nursingMotherPos` above
 * which is nurse-only), computed once per sync in sync(). Tighter than
 * `isNursed`'s FEED_RANGE on purpose: this gates the feedTake reaching-up
 * pose, which should only show when the two are actually close enough to
 * be touching, not merely "nearby". */
function inFeedContact(c: Creature, feedGivingPos: Map<number, Vec2>): boolean {
  if (c.stage !== 'baby' || c.familyId === null) return false;
  const p = feedGivingPos.get(c.familyId);
  if (!p) return false;
  return Math.hypot(c.pos.x - p.x, c.pos.y - p.y) <= FEED_CONTACT_RANGE;
}

/** Activity labels this close to a home carrying a family label are hidden
 * (at zoom < 1.5) — the family label wins, per M5 declutter carry-forward. */
const HOME_LABEL_HIDE_RADIUS = 55;
const HOME_LABEL_HIDE_ZOOM = 1.5;

/** Roughly the crown of each species' rig, for label placement. */
const LABEL_HEIGHT: Record<SpeciesId, number> = {
  rabbit: -70,
  robin: -46,
  deer: -120,
  duck: -52,
  koi: -34,
  owl: -70,
  dodo: -70,
  phoenix: -110,
  squirrel: -46,
  frog: -30,
  turtle: -22,
  kangaroo: -100,
};

/** Day/night multiply-tint ramp, keyed by fraction of day. */
const NIGHT = 0x7580b0;
const TINT_RAMP: [number, number][] = [
  [0.0, NIGHT],
  [0.05, 0xffd9b0], // dawn gold
  [0.1, 0xffffff],
  [0.53, 0xffffff],
  [0.575, 0xffbe8f], // dusk gold
  [0.615, 0xc79a8f],
  [0.66, NIGHT],
  [1.0, NIGHT],
];

export class Renderer {
  private app!: Application;
  private world!: Container;
  private camera!: Camera;
  private groundSprite!: Sprite;
  private detailLayer!: Container;
  private creatureLayer!: Container;
  /** One Graphics redrawn every frame with the small activity glyphs — leaf
   * dot, crescent, rose arcs, etc (M9 task 5). */
  private glyphLayer!: Graphics;
  private homeLayer!: Graphics;
  private memorialLayer!: Graphics;
  private homeLabelLayer!: Container;
  private homeLabels = new Map<number, Text>();
  /** Home positions (not label positions) for homes with an active family
   * label, kept alongside homeLabels for the activity-label declutter check. */
  private homeLabelPos = new Map<number, Vec2>();
  private nightOverlay!: Graphics;
  private glowOverlay!: Graphics;
  private ambient!: AmbientEffects;
  private views = new Map<number, CreatureView>();
  /** Views that have left state.creatures but are still easing out
   * (M9 task 5's gentle passing) — drained each rendered frame. */
  private fading: FadingView[] = [];
  /** eventLog is a tick-stamped ring buffer, not an index-stable one (it
   * shifts once past its cap) — tracking the last-seen TICK, not an index,
   * is what makes moment-sparkle consumption exactly-once and safe across
   * both live play (one sync per tick) and offline catch-up (one sync after
   * many ticks). -1 until the first sync, which seeds it from state.tick
   * without spawning anything for a save's entire history (M9 task 5). */
  private lastSeenEventTick = -1;
  private eventsInitialized = false;
  private clock: Clock = getClock(0);
  private lastFrameTime = 0;
  /** Baked once (Ambient's bake-once pattern): a duck's swim ripple. */
  private rippleTexture!: Texture;
  /** Baked once (M10 task 5): the tap-selected creature's subtle ring. */
  private selectionRingTexture!: Texture;
  /** Single reused sprite (only one creature can be selected at a time) —
   * repositioned onto the selected view each frame, hidden otherwise. */
  private selectionRingSprite!: Sprite;
  /** Reused every frame's swimming check — avoids allocating a Vec2 literal
   * per creature per frame just to call isWater(). */
  private readonly scratchPos: Vec2 = { x: 0, y: 0 };
  /** Reused by onFeedings() (M12 task 3) to compute each feeding's parent/
   * baby head points without allocating a Vec2 literal per event — mutated
   * in place, then read immediately by spawnFeedMote (which copies the
   * values out), so it's safe to reuse across both creatures in one feeding
   * and across every feeding in the same call. */
  private readonly scratchHeadA: Vec2 = { x: 0, y: 0 };
  private readonly scratchHeadB: Vec2 = { x: 0, y: 0 };

  /** Show per-creature activity labels (toggled from the DevPanel). Off by
   * default (M10 task 4) — the glyph/pose vocabulary reads without text. */
  debugLabels = false;

  /** Creature id the camera should track (tap-to-inspect / DevPanel click). */
  followId: number | null = null;
  /** Creature id shown in the InspectCard and ringed on screen (M10 task 5).
   * Single source of truth for "who's selected" — main.ts sets it on tap,
   * DevPanel's own inspector reads it too instead of keeping its own copy. */
  selectedId: number | null = null;

  async init(mount: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: 0x87a96b,
      resizeTo: mount,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      // Single render loop: GameLoop drives one requestAnimationFrame and
      // calls renderFrame() explicitly after camera/ambient updates. Without
      // this, Pixi's own ticker renders on its own rAF registration — which
      // (registered during init(), before GameLoop.start()) fires BEFORE
      // GameLoop's callback each frame, drawing the camera's *previous*
      // frame position and adding a full frame of input latency.
      autoStart: false,
    });
    mount.appendChild(this.app.canvas);

    this.world = new Container();
    this.app.stage.addChild(this.world);

    // Valley: bake the soft ground washes once; keep detail as crisp vectors.
    const { ground, detail } = buildValley();
    const groundTexture = this.app.renderer.generateTexture({
      target: ground,
      resolution: 0.5, // soft painterly bake — half res is a feature here
      frame: new Rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT),
    });
    ground.destroy(true);
    this.groundSprite = new Sprite(groundTexture);
    this.detailLayer = detail;
    this.homeLayer = new Graphics();
    this.memorialLayer = new Graphics();
    this.homeLabelLayer = new Container();
    this.creatureLayer = new Container();
    this.glyphLayer = new Graphics();
    this.ambient = new AmbientEffects(this.world, AMBIENT_SEED);
    this.selectionRingTexture = this.bakeSelectionRingTexture();
    this.selectionRingSprite = new Sprite(this.selectionRingTexture);
    this.selectionRingSprite.anchor.set(0.5);
    this.selectionRingSprite.visible = false;
    this.world.addChild(
      this.groundSprite,
      this.ambient.shimmerLayer, // above ground, below memorials
      this.memorialLayer,
      this.homeLayer,
      this.ambient.hatchLayer, // hatch crack overlay, drawn over the nest
      this.detailLayer,
      this.ambient.grassLayer, // above terrain detail
      this.ambient.dappleLayer,
      this.selectionRingSprite, // tap-selection ring, under the creature it rings
      this.creatureLayer,
      this.glyphLayer, // activity glyphs, above creature bodies
      this.ambient.feedMoteLayer, // feed motes, above activity glyphs (M11)
      this.ambient.sparkleLayer, // moment sparkles
      this.ambient.zzzLayer, // drifting sleep 'z's
      this.ambient.fireflyLayer, // above creatures
      this.homeLabelLayer,
    );
    this.ambient.build(this.app.renderer);
    this.rippleTexture = this.bakeRippleTexture();

    // Screen-space ambience: warm additive glow (dawn/dusk) + night wash.
    this.glowOverlay = new Graphics();
    this.glowOverlay.blendMode = 'add';
    this.nightOverlay = new Graphics();
    this.app.stage.addChild(this.glowOverlay, this.nightOverlay);

    this.camera = new Camera(this.world, this.app.canvas);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  centerOn(x: number, y: number, zoom?: number): void {
    this.camera.centerOn(x, y, zoom);
  }

  /**
   * World-space view center + zoom, for the audio mixer. `Camera.toWorld`
   * expects CSS-pixel screen coordinates (it works from `getBoundingClientRect()`,
   * which is CSS pixels, same space as pointer events' clientX/clientY — see
   * `pickCreature` below, which forwards raw client coords unmodified).
   * `this.app.renderer.width/height` are DEVICE pixels (the drawing-buffer size;
   * with `autoDensity: true` the canvas's CSS size is that divided by
   * `resolution`), so we divide by `this.app.renderer.resolution` first to get
   * back to CSS pixels before asking for the canvas center. The #app canvas
   * fills the full viewport at (0,0) (see index.html), so this canvas-center
   * point resolves to exactly the camera's own (x, y) target.
   */
  viewInfo(): { x: number; y: number; zoom: number } {
    const c = this.camera.toWorld(
      this.app.renderer.width / this.app.renderer.resolution / 2,
      this.app.renderer.height / this.app.renderer.resolution / 2,
    );
    return { x: c.x, y: c.y, zoom: this.camera.getZoom() };
  }

  /** Nearest creature to a screen point, within a world-space radius. A
   * carried creature is skipped (M12 task 5): its raw `pos` is literally
   * its carrier's, so leaving it in this hit test would let it steal taps
   * meant for its carrier (or vice versa) at that exact point — it's
   * reached instead through the carrier's own InspectCard ("carrying a
   * joey"). */
  pickCreature(state: WorldState, screenX: number, screenY: number): Creature | undefined {
    const w = this.camera.toWorld(screenX, screenY);
    const radius = 80 / Math.max(0.2, this.camera.getZoom());
    let best: Creature | undefined;
    let bestDist = radius;
    for (const c of state.creatures) {
      if (isCarried(c)) continue;
      const d = Math.hypot(c.pos.x - w.x, c.pos.y - w.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  /** Render-only presentation state for a creature (M10 task 5) — mirrors
   * clipFor's airborne/swimming inference so InspectCard's "doing" text
   * never disagrees with what's on screen. Undefined once the creature no
   * longer has a view (e.g. it passed between the tap and the next read). */
  presentationFor(id: number): { airborne: boolean; swimming: boolean } | undefined {
    const view = this.views.get(id);
    if (!view) return undefined;
    return { airborne: view.airborneNow, swimming: view.swimmingState };
  }

  /** M12 task 3: this view's approximate head point (world px), reusing the
   * same per-species crown offset (LABEL_HEIGHT) already used for label/
   * glyph placement — see positionLabel() and render()'s crownX/crownY —
   * rather than inventing a new head anchor. Writes into `out` and returns
   * it (no allocation); `out` must not be retained past the call, since
   * onFeedings() below reuses the same scratch Vec2 for every feeding in
   * one call. */
  private headPos(view: CreatureView, out: Vec2): Vec2 {
    const scale = rigFor(view.species).stages[view.stage].scale;
    out.x = view.curr.x + view.broodOffsetX;
    out.y = view.curr.y + view.broodOffsetY + LABEL_HEIGHT[view.species] * scale;
    return out;
  }

  /** M12 task 5 (Task 4 review follow-up): the world point a feed mote
   * should arc TO for a given baby. Ordinarily that's the baby's own head
   * (headPos above) — but a baby currently riding in a pouch has no
   * meaningful head point of its own (its `curr` is literally its
   * carrier's `curr`, copied every tick by sim/movement.ts), so headPos
   * would place the mote at the CARRIER's head, not near the pouch where
   * the feeding is actually happening. Falls back to the carrier's
   * approximate pouch world point (POUCH_WORLD_OFFSET_*) whenever the baby
   * is actually pouch-attached; ordinary headPos otherwise (every other
   * feeding — carry deliveries, nurse-fed babies on their own feet). */
  private feedToPoint(babyView: CreatureView, parentView: CreatureView, out: Vec2): Vec2 {
    if (!babyView.pouchAttached) return this.headPos(babyView, out);
    const scale = rigFor(parentView.species).stages[parentView.stage].scale;
    const facingLeft = Math.cos(parentView.heading) < 0;
    out.x = parentView.curr.x + (facingLeft ? -POUCH_WORLD_OFFSET_X : POUCH_WORLD_OFFSET_X) * scale;
    out.y = parentView.curr.y + POUCH_WORLD_OFFSET_Y * scale;
    return out;
  }

  /**
   * M11: main.ts calls this once per tick, right after sync(state), with
   * that tick's TickOutput.feedings — the transient "this baby just got
   * fed" beats (one per sequenced carry delivery, one per staggered nurse
   * suckle beat). For each, spawns a burst of FEED_MOTE_BURST_COUNT motes
   * (M12 task 3, up from one) arcing from the parent's head to the baby's
   * head (up from body-centre to body-centre — see headPos()), staggered by
   * FEED_MOTE_BURST_STAGGER_MS apiece so the burst trails rather than
   * overlaps, tinted by the PARENT's feedMode (so a carry delivery always
   * arcs amber and a nurse suckle always arcs milk-white), and starts the
   * baby's FED_HOLD_MS "just fed" hold (see CreatureView.fedMs). Missing
   * views (a feeding whose parent or baby left state.creatures between the
   * tick and this call) are skipped — transient like vocalizations, an
   * unwatched feed leaves no trace.
   */
  onFeedings(feedings: readonly Feeding[]): void {
    for (const f of feedings) {
      const parentView = this.views.get(f.parentId);
      const babyView = this.views.get(f.babyId);
      if (!parentView || !babyView) continue;
      const tint =
        SPECIES[parentView.species].reproduction.feedMode === 'nurse'
          ? FEED_MOTE_TINT_NURSE
          : FEED_MOTE_TINT_CARRY;
      const from = this.headPos(parentView, this.scratchHeadA);
      const to = this.feedToPoint(babyView, parentView, this.scratchHeadB);
      for (let i = 0; i < FEED_MOTE_BURST_COUNT; i++) {
        this.ambient.spawnFeedMote(from, to, tint, i * FEED_MOTE_BURST_STAGGER_MS);
      }
      babyView.fedMs = FED_HOLD_MS;
    }
  }

  /** Snapshot creature state after each sim tick (curr → prev, sim → curr). */
  sync(state: WorldState): void {
    this.clock = getClock(state.tick);
    const alive = new Set<number>();
    const newlyCreatedIds: number[] = [];

    // Nurse holds (M10 task 4): a first pass so every baby's per-creature
    // check below can look its own family's currently-nursing mother up in
    // O(1) rather than re-scanning state.creatures per baby. M12 task 1
    // renumbered feedYoung's nurse-mode steps (0 travel, 1 settle, 2
    // nursing, 3 linger) — step 2 is the actual 90-tick nursing hold now,
    // not step 1 (a review-flagged bug: left at step 1, the mother would
    // read as "nursing" during the settle beat instead, and stand up out of
    // the pose right when real nursing began).
    const nursingMotherPos = new Map<number, Vec2>();
    const nursingIds = new Set<number>();
    // M12 task 3: a per-family map of whichever parent is currently in the
    // "actual feeding is happening" step, both feed modes (nurse step 2,
    // carry step 3) — feeds inFeedContact() below, which gates feedTake.
    const feedGivingPos = new Map<number, Vec2>();
    for (const c of state.creatures) {
      if (c.familyId === null || c.activity.id !== 'feedYoung') continue;
      const feedMode = SPECIES[c.species].reproduction.feedMode;
      if (feedMode === 'nurse' && c.activity.step === 2) {
        nursingMotherPos.set(c.familyId, c.pos);
        nursingIds.add(c.id);
        feedGivingPos.set(c.familyId, c.pos);
      } else if (feedMode === 'carry' && c.activity.step === 3) {
        feedGivingPos.set(c.familyId, c.pos);
      }
    }

    for (const c of state.creatures) {
      alive.add(c.id);
      let view = this.views.get(c.id);
      if (!view) {
        view = this.createView(c);
        this.views.set(c.id, view);
        this.creatureLayer.addChild(view.node);
        newlyCreatedIds.push(c.id);
      } else if (view.stage !== c.stage) {
        this.applyStage(view, c.stage); // creatures grow up
      }
      view.prev.x = view.curr.x;
      view.prev.y = view.curr.y;
      view.curr.x = c.pos.x;
      view.curr.y = c.pos.y;
      view.heading = c.heading;
      view.activityId = c.activity.id;
      view.step = c.activity.step;
      view.minTicks = c.activity.minTicks;
      const offset = c.activity.id === 'brood' ? this.broodOffsetFor(state, c) : undefined;
      view.broodOffsetX = offset?.x ?? 0;
      view.broodOffsetY = offset?.y ?? 0;
      view.nursing = nursingIds.has(c.id);
      view.nursed = isNursed(c, nursingMotherPos);
      view.feedContact = inFeedContact(c, feedGivingPos);
      // M12 task 5: only touch the display tree on the actual mount/dismount
      // edge (compare against the view's own last-seen value), not every
      // sync — reparenting is cheap but there is no reason to repeat it
      // every tick a joey simply keeps riding. Safe to look the carrier's
      // view up here: state.creatures (and so this very loop) walks in
      // ascending id order, and a carrier is always born before its rider
      // (sim/movement.ts's own carried-position derivation depends on the
      // same fact), so by the time we reach the rider its carrier's view
      // has already been created/updated earlier in this same loop.
      const carriedBy = c.carriedBy ?? null;
      if (carriedBy !== view.carriedBy) {
        this.updatePouchAttachment(view, carriedBy);
        view.carriedBy = carriedBy;
      }
    }
    // Creatures who have passed ease out instead of vanishing same-frame —
    // see this.fading, drained in render() (M9 task 5).
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        this.views.delete(id);
        if (this.followId === id) this.followId = null;
        if (this.selectedId === id) this.selectedId = null;
        this.fading.push({ view, remainingMs: PASSING_FADE_MS });
      }
    }
    this.syncHomes(state);
    this.syncMemorials(state);
    this.ambient.setMemorialAnchors(state.memorials.map((m) => m.pos));
    this.consumeNewEvents(state, newlyCreatedIds);
  }

  /**
   * M12 task 5: moves `view.node` between `creatureLayer` (walking on its
   * own) and a carrier's rig `pouch` container (riding), on the actual
   * mount/dismount transition only. Reparenting — not a `broodOffset`-style
   * world-space nudge — is the only way a joey can ever paint genuinely
   * INSIDE its mother's silhouette: `creatureLayer` has no z-sort of its
   * own (views paint in creation order, Renderer.ts's own `sync`/
   * `createView`), but a rig's own part containers do (`part.z` → Pixi
   * `zIndex`, `sortableChildren: true` — RigRenderer.ts), so putting the
   * joey's whole view inside the mother's rig tree, between her
   * `pouchBack` and `pouchFront`, is what lets the near rim actually draw
   * over it.
   */
  private updatePouchAttachment(view: CreatureView, carrierId: number | null): void {
    if (view.pouchAttached) {
      // Dismount: capture the world-space (creatureLayer-local) gap between
      // the pouch anchor point and the joey's own actual new position
      // (`view.curr`, already advanced to this tick's real `c.pos` by
      // sync() before this call runs — see the caller) BEFORE detaching —
      // once removeChild runs below, the pouch's transform is no longer
      // reachable from view.node's old parent chain. render()'s NOT-
      // attached branch eases this delta down to (0, 0) over POUCH_EASE_MS
      // (see pouchEaseDelta) so the joey visibly climbs down rather than
      // teleporting to her feet.
      const oldPouch = view.node.parent;
      if (oldPouch) {
        const anchorWorld = this.creatureLayer.toLocal(POUCH_RIDER_OFFSET, oldPouch);
        view.pouchEaseDelta = { x: anchorWorld.x - view.curr.x, y: anchorWorld.y - view.curr.y };
        view.pouchEaseMs = 0;
      }
      view.node.parent?.removeChild(view.node);
      view.pouchAttached = false;
    }
    const pouch = carrierId === null ? undefined : this.views.get(carrierId)?.rig.pouch;
    if (pouch) {
      // Mount: capture the joey's current position — still expressed in its
      // OLD parent's local space at this instant (creatureLayer, unless a
      // carrier swap somehow chained straight from one pouch to another,
      // which family.ts never does) — converted into the mother's pouch-
      // local space, BEFORE reparenting. render()'s pouchAttached branch
      // eases `view.node`'s local position from here toward the fixed
      // POUCH_RIDER_OFFSET (see pouchEaseFrom) instead of snapping there.
      const fromContainer = view.node.parent ?? this.creatureLayer;
      const localStart = pouch.toLocal(view.node.position, fromContainer);
      view.pouchEaseFrom = { x: localStart.x, y: localStart.y };
      view.pouchEaseMs = 0;
      this.attachToPouch(view, pouch);
    } else {
      // No carrier (dismounted), or a defensive fallback — the carrier's
      // view is missing, or its rig doesn't define a `pouch` (shouldn't
      // happen given family.ts's own pouchCarry species gate, but this
      // must never throw): render at its own interpolated position exactly
      // like an ordinary uncarried creature.
      this.creatureLayer.addChild(view.node);
      view.node.zIndex = 0;
    }
  }

  /** Parents `view.node` into `pouch` at the fixed rider offset/zIndex —
   * shared by the mount transition above and by applyStage's rebuild-time
   * reattachment below (the `rippleSprite` detach/reattach precedent). */
  private attachToPouch(view: CreatureView, pouch: Container): void {
    pouch.addChild(view.node);
    view.node.position.set(POUCH_RIDER_OFFSET.x, POUCH_RIDER_OFFSET.y);
    view.node.zIndex = POUCH_RIDER_Z;
    view.node.scale.set(1);
    view.node.alpha = 1;
    view.pouchAttached = true;
  }

  /** A brooding sitter at a treeNest home renders offset into the drawn
   * nest bowl (Renderer's own +38,+26 in syncHomes' 'treeNest' case) rather
   * than at the home's own point — every other home kind draws its nest
   * right at home.pos, so no offset applies.
   *
   * Deliberately 'brood'-only (M13): the caller only invokes this for
   * `activity.id === 'brood'`, never 'gestate'. A gestating creature is
   * always a live-birth mammal at a burrow/glade/drey/shadeScrape home —
   * never a treeNest — so there is no twig bowl to nudge her into. Leaving
   * 'gestate' out of this function is correct by design, not an oversight;
   * do not extend the gate to cover it. */
  private broodOffsetFor(state: WorldState, c: Creature): Vec2 | undefined {
    if (c.familyId === null) return undefined;
    const fam = state.families.find((f) => f.id === c.familyId);
    if (!fam || fam.homeId === null) return undefined;
    const home = state.homes.find((h) => h.id === fam.homeId);
    return home?.kind === 'treeNest' ? TREE_NEST_BOWL_OFFSET : undefined;
  }

  /**
   * Spawns a moment sparkle for every hatch/birth/pairing event since the
   * last sync. eventLog is tick-stamped, so filtering by
   * `tick > lastSeenEventTick` (rather than tracking an array index) stays
   * correct even though the log is a ring buffer that shifts once past its
   * cap, and consumes each event exactly once whether sync runs once per
   * tick (live play) or once after a whole offline catch-up drain (many
   * ticks, one call) — see main.ts / CatchUp.ts.
   */
  private consumeNewEvents(state: WorldState, newlyCreatedIds: number[]): void {
    if (!this.eventsInitialized) {
      // First sync ever (boot, before any tick has run): a loaded save's
      // entire event history is already "seen" — nothing sparkles retroactively.
      this.eventsInitialized = true;
      this.lastSeenEventTick = state.tick;
      return;
    }
    const log = state.eventLog;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (!e || e.tick <= this.lastSeenEventTick) break;
      this.handleEvent(state, e, newlyCreatedIds);
    }
    this.lastSeenEventTick = state.tick;
  }

  /**
   * Dispatches one new sim event to its render-side moment. 'hatched'/'born'
   * get their own staged moments (M10 task 4: the shell-crack overlay, the
   * emergence scale/slide) instead of the generic sparkle — spawning both
   * would be redundant on top of a dedicated staged moment. Every other
   * sparkle-worthy kind ('paired'/'reborn') is unchanged from M9 task 5.
   */
  private handleEvent(state: WorldState, e: SimEvent, newlyCreatedIds: number[]): void {
    if (e.kind === 'hatched' || e.kind === 'born') {
      this.startEmergence(state, e, newlyCreatedIds);
      if (e.kind === 'hatched') this.spawnHatchOverlay(state, e);
      return;
    }
    if (!SPARKLE_EVENT_KINDS.has(e.kind)) return;
    // 'paired' carries no pos (the pair hasn't claimed a home yet) — fall
    // back to either member's current position, looked up by familyId.
    const pos = e.pos ?? state.creatures.find((c) => c.familyId === e.familyId)?.pos;
    if (!pos) return;
    this.ambient.spawnSparkle(pos);
  }

  /**
   * Starts the hatch scale-in or birth scale+slide-out on every view this
   * event's babies got THIS sync — matched by "created in this very sync()
   * call" (newlyCreatedIds) rather than by position, since family.ts adds
   * exactly this event's babies to state.creatures in the same tick the
   * event is emitted, so id membership + familyId is exact, no fuzzy
   * distance matching needed. Runs once per event, so exactly-once even
   * across a catch-up drain that buffers many hatches into one sync() call.
   */
  private startEmergence(state: WorldState, e: SimEvent, newlyCreatedIds: number[]): void {
    if (e.familyId === undefined) return;
    const home = e.pos; // 'hatched'/'born' always carry pos (= home.pos)
    for (const id of newlyCreatedIds) {
      const c = state.creatures.find((cr) => cr.id === id);
      if (!c || c.familyId !== e.familyId) continue;
      const view = this.views.get(id);
      if (!view) continue;
      view.emergeMs = 0;
      if (e.kind === 'hatched') {
        view.emergeKind = 'hatch';
        view.emergeDirX = 0;
        view.emergeDirY = 0;
      } else {
        view.emergeKind = 'birth';
        const dx = c.pos.x - (home?.x ?? c.pos.x);
        const dy = c.pos.y - (home?.y ?? c.pos.y);
        const len = Math.hypot(dx, dy);
        view.emergeDirX = len > 0.01 ? dx / len : 0;
        view.emergeDirY = len > 0.01 ? dy / len : -1;
      }
    }
  }

  /** Starts a shell-crack overlay at the hatching family's nest bowl. */
  private spawnHatchOverlay(state: WorldState, e: SimEvent): void {
    if (e.familyId === undefined) return;
    const fam = state.families.find((f) => f.id === e.familyId);
    const home =
      fam === undefined || fam.homeId === null ? undefined : state.homes.find((h) => h.id === fam.homeId);
    const pos = home && EGG_HOME_KINDS.has(home.kind) ? nestVisualPoint(home) : e.pos;
    if (!pos) return;
    // Per-home-kind scale to fit different egg sizes (M10 task 4 fix).
    let scale = 1.0;
    let tint = 0xffffff;
    if (home) {
      if (home.kind === 'sandNest') {
        scale = 0.55;
      } else if (home.kind === 'spawnClump') {
        scale = 0.4;
        tint = 0xa8c890; // Soft green tint for frog jelly-dot eggs.
      }
    }
    this.ambient.spawnHatch(pos, scale, tint);
  }

  /** Burrows, nests (with eggs while expecting), and family name labels. */
  private syncHomes(state: WorldState): void {
    const g = this.homeLayer.clear();
    const famById = new Map(state.families.map((f) => [f.id, f]));

    for (const home of state.homes) {
      const fam = home.familyId === null ? undefined : famById.get(home.familyId);
      switch (home.kind) {
        case 'burrow': {
          // Earth mound with a cozy dark entrance.
          g.ellipse(home.pos.x, home.pos.y + 8, 42, 16).fill({ color: 0x9b7e5e, alpha: 0.9 });
          g.ellipse(home.pos.x, home.pos.y - 2, 34, 18).fill({ color: 0xaa8d6a, alpha: 0.95 });
          g.ellipse(home.pos.x, home.pos.y + 4, 15, 10).fill(0x4a3826);
          g.ellipse(home.pos.x - 26, home.pos.y + 10, 8, 3).fill({ color: 0x7da861, alpha: 0.8 });
          g.ellipse(home.pos.x + 28, home.pos.y + 12, 9, 3).fill({ color: 0x7da861, alpha: 0.8 });
          break;
        }
        case 'treeNest': {
          // Twig nest bowl at the tree's foot.
          const nx = home.pos.x + 38;
          const ny = home.pos.y + 26;
          g.ellipse(nx, ny, 20, 9).fill(0x8a6f4d);
          g.ellipse(nx, ny - 2, 15, 6).fill(0x6d563a);
          if (fam?.phase === 'expecting') {
            // Speckled eggs peeking out of the bowl.
            g.ellipse(nx - 5, ny - 4, 4, 5).fill(0xcfe4e8);
            g.ellipse(nx + 3, ny - 5, 4, 5).fill(0xd8ebee);
            g.ellipse(nx + 0.5, ny - 2, 4, 5).fill(0xc8dfe4);
          }
          break;
        }
        case 'reedNest': { // grassy bowl tucked in the reeds
          g.ellipse(home.pos.x, home.pos.y, 22, 10).fill(0xb5a068);
          g.ellipse(home.pos.x, home.pos.y - 2, 16, 7).fill(0x8f7c4e);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 4, home.pos.y - 3, 4.5, 5.5).fill(0xe8e2ce);
            g.ellipse(home.pos.x + 4, home.pos.y - 4, 4.5, 5.5).fill(0xefe9d6);
          }
          break;
        }
        case 'lilyPatch': { // koi spawning bed among the pads
          g.circle(home.pos.x - 10, home.pos.y, 16).fill({ color: 0x5f9451, alpha: 0.95 });
          g.circle(home.pos.x + 14, home.pos.y + 8, 12).fill({ color: 0x6da05a, alpha: 0.9 });
          g.circle(home.pos.x + 4, home.pos.y - 10, 5).fill({ color: 0xf2d8e4 }); // blossom
          if (fam?.phase === 'expecting') {
            for (let i = 0; i < 5; i++) { // roe: tiny amber beads
              g.circle(home.pos.x - 14 + i * 6, home.pos.y + 12, 2).fill({ color: 0xf0c060, alpha: 0.9 });
            }
          }
          break;
        }
        case 'treeHollow': { // a cozy dark hollow in an old trunk
          g.roundRect(home.pos.x - 12, home.pos.y - 30, 24, 46, 10).fill(0x6b4e38);
          g.ellipse(home.pos.x, home.pos.y - 10, 8, 11).fill(0x2e2018);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 2, home.pos.y - 5, 3.5, 4.5).fill(0xf3efe4);
            g.ellipse(home.pos.x + 3, home.pos.y - 6, 3.5, 4.5).fill(0xeae5d8);
          }
          break;
        }
        case 'glade': { // flattened-grass deer bed
          g.ellipse(home.pos.x, home.pos.y, 46, 22).fill({ color: 0xa8bd7e, alpha: 0.7 });
          g.ellipse(home.pos.x, home.pos.y, 32, 14).fill({ color: 0xc0cf94, alpha: 0.8 });
          break;
        }
        case 'groundNest': { // dodo's ring of twigs on the forest floor
          g.ellipse(home.pos.x, home.pos.y, 24, 12).fill(0x8a6f4d);
          g.ellipse(home.pos.x, home.pos.y, 16, 8).fill(0xa89066);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x, home.pos.y - 2, 6, 7).fill(0xf1ead6); // one grand egg
          }
          break;
        }
        case 'groveNest': { // the phoenix nest: warm stones, faint glow
          g.ellipse(home.pos.x, home.pos.y + 4, 30, 12).fill({ color: 0xffdda6, alpha: 0.35 });
          g.ellipse(home.pos.x, home.pos.y, 20, 9).fill(0xb59a72);
          g.ellipse(home.pos.x, home.pos.y - 2, 13, 6).fill(0x8f7752);
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x, home.pos.y - 3, 5, 6.5).fill(0xf4d03f); // the golden egg
            g.ellipse(home.pos.x, home.pos.y - 3, 8, 9).fill({ color: 0xffb36b, alpha: 0.3 });
          }
          break;
        }
        case 'drey': { // a twiggy ball nest woven onto a trunk, high in the canopy
          const dx = home.pos.x;
          const ballY = home.pos.y - 18;
          // Trunk stub beneath the ball (bark brown, echoing treeHollow's
          // trunk below) — review fix: the ball no longer floats with
          // nothing under it (M10 task 3 justification table row 2).
          g.roundRect(dx - 4, home.pos.y - 8, 8, 14, 3).fill(0x6b4e38);
          // The ball's own topmost extent is capped at home.pos.y - 30 —
          // exactly treeHollow's ceiling below — so it clears the family
          // label's fixed anchor at home.pos.y - 34 with the same 4px
          // clearance every other home kind already keeps (review fix).
          g.circle(dx, ballY + 4, 13).fill(0x6d563a);
          g.circle(dx, ballY, 12).fill(0x8a6f4d);
          g.circle(dx - 3, ballY - 4, 5).fill({ color: 0xa89066, alpha: 0.85 });
          // Squirrels give live birth (reproduction.mode: 'live') — unlike
          // every other home kind above, a drey never shows eggs during
          // 'expecting' (M10 task 4 fix: this block used to draw two anyway,
          // a Task 3 copy-paste leftover with nothing to hatch into).
          break;
        }
        case 'spawnClump': { // frog spawn: a jelly clump among the reeds
          g.ellipse(home.pos.x, home.pos.y + 4, 20, 8).fill({ color: 0x5f9451, alpha: 0.5 });
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            g.circle(home.pos.x + Math.cos(ang) * 7, home.pos.y + Math.sin(ang) * 5, 3.2).fill({
              color: 0xd8e8c8,
              alpha: 0.75,
            });
          }
          g.circle(home.pos.x, home.pos.y, 3.5).fill({ color: 0xc4d9a8, alpha: 0.85 });
          if (fam?.phase === 'expecting') {
            g.circle(home.pos.x, home.pos.y - 1, 2).fill(0x3a3230);
          }
          break;
        }
        case 'sandNest': { // turtle's small sand mound scooped into the shore
          g.ellipse(home.pos.x, home.pos.y + 6, 26, 10).fill({ color: 0xdcc9a0, alpha: 0.9 });
          g.ellipse(home.pos.x, home.pos.y, 18, 8).fill({ color: 0xe8d8b0, alpha: 0.95 });
          if (fam?.phase === 'expecting') {
            g.ellipse(home.pos.x - 4, home.pos.y - 1, 3.5, 3).fill(0xf1ead6);
            g.ellipse(home.pos.x + 4, home.pos.y - 1, 3.5, 3).fill(0xe8e2ce);
          }
          break;
        }
        case 'shadeScrape': { // kangaroo's scraped dirt hollow under a scrub tuft
          g.ellipse(home.pos.x, home.pos.y + 5, 34, 13).fill({ color: 0x9b8560, alpha: 0.85 });
          g.ellipse(home.pos.x, home.pos.y, 24, 9).fill({ color: 0xb59e73, alpha: 0.92 });
          g.ellipse(home.pos.x - 16, home.pos.y - 10, 7, 11).fill({ color: 0x6f8a4c, alpha: 0.85 }); // scrub tuft
          g.ellipse(home.pos.x - 19, home.pos.y - 14, 4, 7).fill({ color: 0x7fa15a, alpha: 0.8 });
          // Kangaroos give live birth (reproduction.mode: 'live') — like glade
          // and drey above, a shade scrape never shows eggs during 'expecting'.
          break;
        }
        default: {
          const _exhaustive: never = home.kind;
          void _exhaustive;
        }
      }
    }

    // Family name labels above claimed homes.
    const claimed = new Set<number>();
    for (const home of state.homes) {
      if (home.familyId === null) continue;
      const fam = famById.get(home.familyId);
      if (!fam) continue;
      claimed.add(home.id);
      let label = this.homeLabels.get(home.id);
      if (!label) {
        label = new Text({
          text: '',
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fill: 0xfffbee,
            stroke: { color: 0x4a4232, width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        this.homeLabels.set(home.id, label);
        this.homeLabelLayer.addChild(label);
      }
      label.text = `The ${familyName(fam.id)} family`;
      label.position.set(home.pos.x, home.pos.y - 34);
      this.homeLabelPos.set(home.id, home.pos);
    }
    for (const [homeId, label] of this.homeLabels) {
      if (!claimed.has(homeId)) {
        label.destroy();
        this.homeLabels.delete(homeId);
        this.homeLabelPos.delete(homeId);
      }
    }
  }

  /** Soft flower clusters where elders have peacefully passed. */
  private syncMemorials(state: WorldState): void {
    const g = this.memorialLayer.clear();
    for (const m of state.memorials) {
      // Bloom fresh, linger, then fade back into the meadow as they age.
      const age = state.tick - m.tick;
      const fade = Math.max(0.15, 1 - age / MEMORIAL_TICKS);
      if (m.species === 'phoenix') {
        // Soft embers, not flowers — the site of a rebirth.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + m.tick * 0.13;
          const r = 5 + ((m.tick + i * 29) % 10);
          g.circle(m.pos.x + Math.cos(a) * r, m.pos.y + Math.sin(a) * r * 0.7, 2.4).fill({
            color: i % 2 === 0 ? 0xf4d03f : 0xd96b35,
            alpha: 0.85 * fade,
          });
        }
        g.circle(m.pos.x, m.pos.y, 3).fill({ color: 0xffdda6, alpha: 0.9 * fade });
        continue;
      }
      const petals = [0xf2d8e4, 0xfdf6b8, 0xe8eef5, 0xf4cddd];
      for (let i = 0; i < 7; i++) {
        // Position petals deterministically off the memorial's own data.
        const a = (i / 7) * Math.PI * 2 + m.tick * 0.1;
        const r = 6 + ((m.tick + i * 37) % 14);
        const color = petals[(m.tick + i) % petals.length] ?? 0xf2d8e4;
        g.circle(m.pos.x + Math.cos(a) * r, m.pos.y + Math.sin(a) * r * 0.7, 3.2).fill({
          color,
          alpha: 0.95 * fade,
        });
      }
      g.circle(m.pos.x, m.pos.y, 2.6).fill({ color: 0xfdf6b8, alpha: 0.9 * fade });
    }
  }

  /** Draw one frame, interpolating between the last two sim snapshots. */
  render(alpha: number): void {
    const now = performance.now();
    const dtMs = this.lastFrameTime === 0 ? 16 : Math.min(now - this.lastFrameTime, 100);
    this.lastFrameTime = now;

    this.updateFading(dtMs);

    const zoom = this.camera.getZoom();
    const tier = lodTier(zoom);
    const grade = rampColor(TINT_RAMP, this.clock.dayT);

    // Glyph culling bounds (world space), computed once per frame rather
    // than per creature — see the on-screen check at the bottom of the
    // per-view loop below (M9 task 5).
    const camCX = this.camera.getCenterX();
    const camCY = this.camera.getCenterY();
    const cw = this.app.renderer.width / this.app.renderer.resolution;
    const ch = this.app.renderer.height / this.app.renderer.resolution;
    const glyphHalfW = cw / 2 / zoom + GLYPH_CULL_MARGIN;
    const glyphHalfH = ch / 2 / zoom + GLYPH_CULL_MARGIN;
    const glyphRadius = clamp(GLYPH_RADIUS_K / zoom, GLYPH_RADIUS_MIN, GLYPH_RADIUS_MAX);
    this.glyphLayer.clear();
    // Reset every frame; the loop below sets it true only if selectedId
    // still has a matching view (cleared automatically otherwise — see
    // sync()'s selectedId-on-removal handling).
    this.selectionRingSprite.visible = false;

    for (const view of this.views.values()) {
      const x = view.prev.x + (view.curr.x - view.prev.x) * alpha;
      const y = view.prev.y + (view.curr.y - view.prev.y) * alpha;
      const tickDisp = Math.hypot(view.curr.x - view.prev.x, view.curr.y - view.prev.y);
      const moving = tickDisp > 0.5;

      // Render-only presentation inference (no sim field — M9 task 4): an
      // air-medium species reads as "airborne" once its per-tick
      // displacement is a real fraction of its own top speed (filters out
      // idle sway); an amphibious species reads as "swimming" straight off
      // the interpolated position via the sim's own isWater geometry.
      const speciesParams = SPECIES[view.species];
      const airborneNow =
        speciesParams.medium === 'air' &&
        moving &&
        tickDisp >= AIRBORNE_SPEED_FRACTION * speedFor(view.species, view.stage);
      view.airborneNow = airborneNow; // mirrored for presentationFor() (M10 task 5)

      // Tap-selection ring (M10 task 5): follows the selected view every
      // frame, same interpolated position as its body — reset to hidden
      // before the loop, only ever set true for the one matching view.
      if (view.id === this.selectedId) {
        this.selectionRingSprite.position.set(x + view.broodOffsetX, y + view.broodOffsetY);
        this.selectionRingSprite.visible = true;
      }

      this.scratchPos.x = x;
      this.scratchPos.y = y;
      // Shore hysteresis (M10 task 4): a single hard isWater boundary test
      // flickered the swim/land clip right at the shoreline (a duck's own
      // position oscillates across it by a px or two frame to frame). Only
      // flip the STABLE decision once the raw reading has disagreed with it
      // for 3 consecutive frames — applies to every amphibious species
      // (duck/frog/turtle), not just the duck the flicker was first seen on.
      const rawWater = speciesParams.medium === 'amphibious' && isWater(this.scratchPos);
      if (rawWater === view.swimmingState) {
        view.swimAgreeCount = 0;
      } else {
        view.swimAgreeCount++;
        if (view.swimAgreeCount >= 3) {
          view.swimmingState = rawWater;
          view.swimAgreeCount = 0;
        }
      }
      const swimming = view.swimmingState;

      // M11: a "just got fed" hold, started by onFeedings() the instant
      // this baby is named in a Feeding — decays every rendered frame
      // (wall-clock, not tick-driven) back to 0.
      if (view.fedMs > 0) view.fedMs = Math.max(0, view.fedMs - dtMs);
      const fed = view.fedMs > 0;

      // Ease the flight lift toward its target over LIFT_EASE_MS, both ways,
      // so takeoff/landing never pop. Stays pinned at 0 for every species
      // that never goes airborne (liftTarget is always 0 for them).
      const liftTarget = airborneNow ? 1 : 0;
      if (view.liftT < liftTarget) view.liftT = Math.min(liftTarget, view.liftT + dtMs / LIFT_EASE_MS);
      else if (view.liftT > liftTarget) view.liftT = Math.max(liftTarget, view.liftT - dtMs / LIFT_EASE_MS);
      const liftEase = view.liftT * view.liftT * (3 - 2 * view.liftT); // smoothstep, matches Animator's sample()
      const liftPx = tier === 2 ? -LIFT_MAX_PX * liftEase : 0; // only the live T2 rig actually lifts

      // Hatch/birth emergence (M10 task 4): scale eases in over EMERGE_MS,
      // and a birth additionally recedes from the home mouth by
      // EMERGE_SLIDE_PX, easing to 0 extra offset — see startEmergence().
      // Cleared once the ease completes, so every ordinary view skips this
      // block entirely (emergeScale 1, no offset, same as before this task).
      let emergeScale = 1;
      let emergeOffX = 0;
      let emergeOffY = 0;
      if (view.emergeKind !== undefined) {
        view.emergeMs += dtMs;
        const t = clamp(view.emergeMs / EMERGE_MS, 0, 1);
        const ease = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out cubic
        if (view.emergeKind === 'hatch') {
          emergeScale = ease;
        } else {
          emergeScale = 0.3 + 0.7 * ease;
          const slide = EMERGE_SLIDE_PX * (1 - ease);
          emergeOffX = -view.emergeDirX * slide;
          emergeOffY = -view.emergeDirY * slide;
        }
        if (t >= 1) view.emergeKind = undefined;
      }

      const facingLeft = Math.cos(view.heading) < 0;
      if (view.pouchAttached) {
        // M12 task 5: riding in a carrier's pouch — `view.node` is a child
        // of the carrier's rig `pouch` container now, not of creatureLayer,
        // so its position is a small FIXED offset within that pouch
        // (POUCH_RIDER_OFFSET), not this frame's interpolated (x, y) — the
        // sim sets `curr` equal to the carrier's own position every tick
        // (sim/movement.ts), so applying it here too would double-count
        // "where the pouch is" (already handled by the parent chain) with
        // "where the rider sits inside it". No facing flip either — the
        // parent chain (the carrier's own node.scale.x) already applies it,
        // and re-applying it here would cancel it back out whenever she
        // faces left.
        //
        // M13 task 9: while `pouchEaseFrom` is defined (set by
        // updatePouchAttachment at the instant of reparenting), lerp from
        // there toward POUCH_RIDER_OFFSET instead of snapping straight to
        // it — ease-out-cubic over POUCH_EASE_MS, mirroring EMERGE_MS's own
        // self-clearing shape exactly. Once the ease completes (t >= 1),
        // clear the field so every frame after is byte-identical to M12's
        // unconditional snap — no per-frame cost once settled.
        if (view.pouchEaseFrom) {
          view.pouchEaseMs += dtMs;
          const t = clamp(view.pouchEaseMs / POUCH_EASE_MS, 0, 1);
          const ease = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out cubic
          view.node.position.set(
            view.pouchEaseFrom.x + (POUCH_RIDER_OFFSET.x - view.pouchEaseFrom.x) * ease,
            view.pouchEaseFrom.y + (POUCH_RIDER_OFFSET.y - view.pouchEaseFrom.y) * ease,
          );
          if (t >= 1) view.pouchEaseFrom = undefined;
        } else {
          view.node.position.set(POUCH_RIDER_OFFSET.x, POUCH_RIDER_OFFSET.y);
        }
        view.node.scale.set(1);
      } else {
        // M13 task 9: the reverse edge — while `pouchEaseDelta` is defined
        // (set by updatePouchAttachment at the instant of release), ease
        // that world-space gap between the pouch anchor and the joey's own
        // actual position down to (0, 0), ease-out-cubic over
        // POUCH_EASE_MS, composed onto the interpolated position exactly
        // the way `emergeOffX/Y` already coexists with `broodOffsetX/Y` and
        // `liftPx` below. Self-clears at t >= 1, same shape as the mount
        // ease above.
        let dismountOffX = 0;
        let dismountOffY = 0;
        if (view.pouchEaseDelta) {
          view.pouchEaseMs += dtMs;
          const t = clamp(view.pouchEaseMs / POUCH_EASE_MS, 0, 1);
          const ease = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out cubic
          dismountOffX = view.pouchEaseDelta.x * (1 - ease);
          dismountOffY = view.pouchEaseDelta.y * (1 - ease);
          if (t >= 1) view.pouchEaseDelta = undefined;
        }
        // A brooding sitter at a treeNest home nudges into the drawn bowl
        // (broodOffsetX/Y, set in sync() — zero for every other case).
        view.node.position.set(
          x + view.broodOffsetX + emergeOffX + dismountOffX,
          y + view.broodOffsetY + emergeOffY + liftPx + dismountOffY,
        );
        view.node.scale.x = (facingLeft ? -1 : 1) * emergeScale;
        view.node.scale.y = emergeScale;
      }
      // A passing elder softens — the gentlest farewell.
      view.node.alpha = view.activityId === 'pass' ? 0.75 : 1;

      // Ground-truth stride: accumulate actual rendered displacement (not
      // wall-clock) and wrap at the rig's stride length, so gait cadence
      // tracks speed exactly at any sim rate (1x, 8x, 64x) with free
      // per-creature desync (no shared clock). One float add + one mod per
      // view — no allocations.
      const speciesRig = rigFor(view.species);
      const stride = speciesRig.strideLength ?? DEFAULT_STRIDE_LENGTH;
      const dispPx = Math.hypot(x - view.lastX, y - view.lastY);
      view.lastX = x;
      view.lastY = y;
      view.odometer = (view.odometer + dispPx) % stride;

      // M12 task 3: feedGive/feedTake selection, resolved here (not inside
      // clipFor) because it needs this view's own rig — exactly the
      // "does this rig define the clip" guard flap/swim already use above.
      // `giving`: true while this creature (a parent) is in the "actual
      // feeding is happening" step of feedYoung — nurse mode's step 2 (the
      // nursing hold itself, same window view.nursing already flags) or
      // carry mode's step 3 (the delivery hold). `feedGiving` only
      // upgrades to the new clip when the rig actually authored it;
      // otherwise the caller falls back to 'sit'/'eat' exactly as before
      // (graceful fallback for the 8 of 12 species that don't define it yet).
      const feedMode = speciesParams.reproduction.feedMode;
      const giving =
        view.nursing ||
        (feedMode === 'carry' && view.activityId === 'feedYoung' && view.step === 3);
      const feedGiving = giving && !!speciesRig.clips.feedGive;
      const feedTaking = view.feedContact && !!speciesRig.clips.feedTake;
      // M13 task 9: same "does this rig define the clip" guard as
      // feedGiving/feedTaking above, for the pouch mount/dismount errand's
      // own pose. `'mount' in speciesRig.clips` checks the presence of the
      // clip — authored (Task 10) for the kangaroo rig specifically, so
      // clipFor's two mount branches resolve to the real 'mount' pose for
      // kangaroo and fall back to 'sit'/'idle' for every other species,
      // which doesn't author it.
      const hasMount = 'mount' in speciesRig.clips;

      // Single source of truth for which pose to show, shared by T2's live
      // rig and T1's baked-frame cascade below (M9 task 5's clipFor fix —
      // moving now outranks brood/nap, so a sitter still walking to the
      // nest reads as walking, not asleep mid-stride). M10 task 4 adds the
      // nurse hold: the mother reads 'sit' (settled) and her snuggled-in
      // babies read 'eat', both computed once per sync in view.nursing/nursed.
      // M11 adds `fed`: any baby mid FED_HOLD_MS also reads 'eat', whether
      // it was carry-delivered or nurse-suckled. M12 task 3 reorders
      // `nursing` above `moving` (a mother mid-settle micro-adjusting to
      // face her baby is still genuinely stationary, so the old ordering
      // cost her pose right on arrival) and layers feedGive/feedTake on top
      // of the sit/eat poses they're replacing. M12 task 5 adds
      // `view.pouchAttached` as the single strongest override: a riding
      // joey's own `activityId` stays 'idle' the whole ride (family.ts's
      // mount() assigns it and nothing else ever touches it while carried)
      // and its `moving` reads true (its `curr`/`prev` track its carrier's
      // real motion) — left alone that would show her joey walking in
      // mid-air inside the pouch, so it's forced to 'sit' regardless.
      const clip = clipFor(
        view.activityId,
        moving,
        airborneNow,
        swimming,
        view.step,
        view.nursing,
        view.nursed,
        fed,
        feedGiving,
        feedTaking,
        view.pouchAttached,
        hasMount,
      );

      if (tier === 2) {
        view.rig.root.visible = true;
        view.spriteWrap.visible = false;
        view.rig.animator.play(clip);
        // A flying carrier ferries food home too, but clipFor deliberately
        // keeps 'flap' as the airborne pose (a ground carry pose mid-air
        // would look broken) — so hideInClips alone would hide the food the
        // whole flight. Override it explicitly here, every frame, since
        // `step` can change without a clip switch (play()'s early-return
        // skips applyClipVisibility when the clip name is unchanged)
        // (final-review fix wave, fix 2). M11 renumbering: carry mode's
        // step 2 is the carry-home leg — the only step the food prop should
        // show for (steps 0/1 are the outbound seek/pickup, still empty-beaked).
        if (view.rig.food && clip === 'flap') view.rig.food.visible = view.step === 2;
        let rate = 1;
        if (clip === 'walk' && dtMs > 0) {
          const walkDurMs = speciesRig.clips.walk.durationMs;
          rate = clamp(((dispPx / dtMs) * walkDurMs) / stride, 0, 2.5);
        }
        view.rig.animator.update(dtMs * rate);
        const tint = multiplyTints(view.rig.stageTint, grade);
        for (const g of view.rig.tintables) g.tint = tint;

        // Flight-lift shadow illusion: the same eased progress that lifted
        // the body above scales/drops the shadow, so it visibly detaches
        // and reattaches with the body instead of snapping.
        if (view.rig.shadow) {
          view.rig.shadow.scale.set(1 - (1 - SHADOW_AIRBORNE_SCALE) * liftEase);
          view.rig.shadow.position.y = view.shadowBaseY + SHADOW_AIRBORNE_OFFSET_PX * liftEase;
          // M12 task 5 (opus review fix): a riding joey has no ground to
          // cast a shadow onto inside the pouch — left visible, its lower
          // half protrudes below pouchBack's own bottom edge at baby scale,
          // floating in mid-air under the mother's pouch. Same `.visible`
          // toggle pattern as the rippleSprite swap right below.
          //
          // M13 task 9: `pouchAttached` alone would pop the shadow back in
          // the instant dismount starts, even though the joey is still
          // easing down from the pouch and doesn't touch ground until that
          // ease completes — so also stay hidden for as long as
          // `pouchEaseDelta` is defined (the dismount ease's own
          // self-clearing flag, cleared exactly when it finishes). The
          // mount side needs no such guard: `pouchAttached` already flips
          // true at the very instant the mount ease begins (see
          // updatePouchAttachment), so the shadow is already hidden from
          // the first eased frame.
          view.rig.shadow.visible = !view.pouchAttached && view.pouchEaseDelta === undefined;
        }

        // Duck swim: the shadow ellipse hands off to a baked ripple sprite
        // (already nested in the same container) with a gentle scale pulse.
        if (view.rippleSprite) {
          view.rippleSprite.visible = swimming;
          if (view.rig.shadowGraphic) view.rig.shadowGraphic.visible = !swimming;
          if (swimming) {
            const pulse = 1 + RIPPLE_PULSE_AMPLITUDE * Math.sin((now / RIPPLE_PULSE_MS) * Math.PI * 2);
            view.rippleSprite.scale.set(pulse);
          }
        }
      } else {
        view.rig.root.visible = false;
        view.spriteWrap.visible = true;
        // T1 flipbook: the same clip drives frame choice as T2 — flap/swim/
        // walk stay distance-driven (multi-frame), carry/sit/sleep/eat show
        // their single mid-pose bake (M9 task 5), and social/idle keep the
        // pre-existing idle fallback. T0 (tier 0) always stays on idle.
        let frame = view.frames.idle;
        if (tier === 1) {
          if (clip === 'flap' && view.frames.flap) {
            const flapIdx = Math.floor((view.odometer / stride) * N_FLAP_FRAMES) % N_FLAP_FRAMES;
            frame = view.frames.flap[flapIdx] ?? view.frames.idle;
          } else if (clip === 'swim' && view.frames.swim) {
            frame = view.frames.swim[0] ?? view.frames.idle;
          } else if (clip === 'walk') {
            const frameIndex = Math.floor((view.odometer / stride) * N_WALK_FRAMES) % N_WALK_FRAMES;
            frame = view.frames.walk[frameIndex] ?? view.frames.idle;
          } else if (clip === 'carry') {
            frame = view.frames.carry;
          } else if (clip === 'sit') {
            frame = view.frames.sit;
          } else if (clip === 'sleep') {
            frame = view.frames.sleep;
          } else if (clip === 'eat') {
            frame = view.frames.eat;
          } else if (clip === 'feedGive' && view.frames.feedGive) {
            frame = view.frames.feedGive;
          } else if (clip === 'feedTake' && view.frames.feedTake) {
            frame = view.frames.feedTake;
          } else if (clip === 'mount' && view.frames.mount) {
            frame = view.frames.mount;
          }
        }
        view.sprite.texture = frame.texture;
        view.sprite.position.set(frame.bx, frame.by);
        view.sprite.tint = grade;
      }

      view.label.visible = this.debugLabels && tier === 2;
      if (view.label.visible && zoom < HOME_LABEL_HIDE_ZOOM) {
        // Family label wins: don't stack an activity label on top of it.
        for (const pos of this.homeLabelPos.values()) {
          if (Math.hypot(view.curr.x - pos.x, view.curr.y - pos.y) < HOME_LABEL_HIDE_RADIUS) {
            view.label.visible = false;
            break;
          }
        }
      }
      if (view.label.visible) {
        view.label.text = view.activityId === 'nap' ? 'nap 💤' : view.activityId;
        view.label.scale.x = facingLeft ? -1 : 1;
      }

      // Crown position + on-screen test, shared below by the activity glyph
      // and the drifting sleep 'z's — both anchor to the same point.
      const stageScale = speciesRig.stages[view.stage].scale;
      const crownX = x + view.broodOffsetX;
      const crownY = y + view.broodOffsetY + LABEL_HEIGHT[view.species] * stageScale;
      const onscreen =
        x > camCX - glyphHalfW && x < camCX + glyphHalfW && y > camCY - glyphHalfH && y < camCY + glyphHalfH;

      // Activity glyph: ease alpha toward the desired kind (0 if none), and
      // only ever swap kinds once fully faded out — see the field comment
      // on CreatureView.glyphKind. Drawn only when visible and on-screen.
      // Nursing wins over everything else — a soft milk-white droplet
      // instead of whatever the underlying activity would otherwise show
      // (M10 task 4; replaces the amber 'carry' dot for nurse-feedMode mothers).
      // M11: a `fed` baby (mid its own FED_HOLD_MS hold) shows the matching
      // fed glyph — carry-amber or nurse-milk, see fedGlyphFor — next in
      // priority, overriding whatever its own activity would otherwise glyph.
      const desiredGlyph: GlyphKind | undefined = view.nursing
        ? 'nurse'
        : fed
          ? fedGlyphFor(view.species)
          : glyphKindFor(view.activityId, view.step, view.minTicks, view.species);
      if (desiredGlyph !== view.glyphKind && view.glyphAlpha <= 0) {
        view.glyphKind = desiredGlyph;
        view.glyphBornMs = 0; // Reset birth time when glyph kind changes.
      }
      const glyphTarget = desiredGlyph !== undefined && view.glyphKind === desiredGlyph ? 1 : 0;
      if (view.glyphAlpha < glyphTarget) {
        view.glyphAlpha = Math.min(glyphTarget, view.glyphAlpha + dtMs / GLYPH_FADE_MS);
      } else if (view.glyphAlpha > glyphTarget) {
        view.glyphAlpha = Math.max(glyphTarget, view.glyphAlpha - dtMs / GLYPH_FADE_MS);
      }
      if (view.glyphKind !== undefined && view.glyphAlpha > 0 && onscreen) {
        // Glyph life: gentle sine bob (period 2.4s, amplitude ±1.5px) phased per
        // creature id, and scale-in using glyphAlpha (M10 task 4 fix).
        view.glyphBornMs += dtMs;
        const bobY = Math.sin((view.glyphBornMs / 1000) * 2 * Math.PI / 2.4) * 1.5;
        const scaledRadius = glyphRadius * view.glyphAlpha;
        this.drawGlyph(view.glyphKind, crownX, crownY + bobY, scaledRadius, view.glyphAlpha);
      }

      // Drifting sleep 'z's (M10 task 4): only while actually settled into
      // the sleep pose (clip 'sleep' via nap) — not just walking toward the
      // nap spot, which the crescent glyph above already shows regardless
      // of motion. Timer resets the moment a nap ends, so waking mid-cycle
      // never leaves a z queued to fire the instant it dozes off again.
      if (clip === 'sleep' && view.activityId === 'nap') {
        view.zzzTimerMs += dtMs;
        if (view.zzzTimerMs >= view.zzzIntervalMs) {
          view.zzzTimerMs -= view.zzzIntervalMs;
          if (onscreen) this.ambient.spawnZ({ x: crownX, y: crownY });
        }
      } else {
        view.zzzTimerMs = 0;
      }
    }

    this.homeLabelLayer.visible = tier >= 1;

    const followed = this.followId === null ? undefined : this.views.get(this.followId);
    if (followed) this.camera.centerOn(followed.curr.x, followed.curr.y);

    this.applyOverlays();
    this.camera.update(dtMs);
    // Zoom is the only view value AmbientEffects consumes — pass it directly
    // (no-alloc) rather than round-tripping through viewInfo(), which builds
    // two object literals and calls getBoundingClientRect() per call and was
    // designed for the 10Hz audio mixer, not this 60Hz render loop.
    this.ambient.update(dtMs, this.clock, this.camera.getZoom());
  }

  /** Draw the current stage to the canvas. Call once per rendered frame,
   * after render(alpha) (and anything else that mutates Pixi objects this
   * frame) — see GameLoop's render callback in main.ts. */
  renderFrame(): void {
    this.app.render();
  }

  /**
   * Eases each passed creature's view out over PASSING_FADE_MS and destroys
   * it once fully faded, instead of the same-frame destroy sync() used to
   * do — the gentlest farewell (M9 task 5). Iterates backward so mid-loop
   * splices never skip an entry.
   */
  private updateFading(dtMs: number): void {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      if (!f) continue;
      f.remainingMs -= dtMs;
      if (f.remainingMs <= 0) {
        f.view.node.destroy({ children: true });
        this.fading.splice(i, 1);
        continue;
      }
      // Fades from the settled 'pass' alpha (0.75, see render()'s per-view
      // alpha line) down to fully transparent.
      f.view.node.alpha = 0.75 * (f.remainingMs / PASSING_FADE_MS);
    }
  }

  /**
   * Draws one small, gentle activity glyph into glyphLayer — the valley's
   * readable vocabulary for forage/nap/court/carry/brood/mourning (M9 task
   * 5), joined by 'gestate' for live-birth mothers (M13). Called only for
   * on-screen, alpha>0 views; glyphLayer.clear() runs
   * once per frame in render(), so every call here is additive within the
   * frame. Shapes are deliberately simple (circle/ellipse/arc-stroke) —
   * small and desaturated, never saturated or fussy.
   */
  private drawGlyph(kind: GlyphKind, cx: number, cy: number, r: number, alpha: number): void {
    const g = this.glyphLayer;
    switch (kind) {
      case 'forage':
        g.circle(cx, cy, r * 0.55).fill({ color: 0x8fae5c, alpha: 0.85 * alpha });
        break;
      case 'nap':
        // A crescent moon, approximated as a short curved stroke.
        strokeArc(g, cx, cy, r * 0.62, -Math.PI * 0.55, Math.PI * 0.55, 0xbcd6e8, r * 0.5, 0.8 * alpha);
        break;
      case 'court':
        strokeArc(g, cx - r * 0.32, cy, r * 0.4, Math.PI * 0.15, Math.PI * 1.35, 0xdf9fb0, r * 0.28, 0.85 * alpha);
        strokeArc(g, cx + r * 0.32, cy, r * 0.4, Math.PI * 1.65, Math.PI * 2.85, 0xdf9fb0, r * 0.28, 0.85 * alpha);
        break;
      case 'carry':
        g.circle(cx, cy, r * 0.5).fill({ color: 0xe8a53c, alpha: 0.85 * alpha });
        break;
      case 'brood':
        g.ellipse(cx, cy, r * 0.62, r * 0.44).fill({ color: 0xf3e9d2, alpha: 0.85 * alpha });
        break;
      case 'gestate':
        // A round warm-cream circle with a small inner dot — a little one
        // within, not a clutch beneath (M13): deliberately round rather than
        // egg-elliptical like 'brood' above, and warm cream rather than
        // green like 'forage', so a gestating mammal never reads as
        // egg-sitting or foraging at a glance.
        g.circle(cx, cy, r * 0.5).fill({ color: 0xe8d9b5, alpha: 0.85 * alpha });
        g.circle(cx, cy, r * 0.18).fill({ color: 0xc9a86a, alpha: 0.9 * alpha });
        break;
      case 'mourning':
        g.ellipse(cx, cy, r * 0.4, r * 0.64).fill({ color: 0xb3aebd, alpha: 0.75 * alpha });
        break;
      case 'nurse': {
        // A soft milk-white droplet: round base + a small peak, distinct in
        // both shape and color from the amber 'carry' dot (M10 task 4).
        const dropColor = 0xf7f3e8;
        g.circle(cx, cy + r * 0.14, r * 0.42).fill({ color: dropColor, alpha: 0.9 * alpha });
        g.moveTo(cx, cy - r * 0.5)
          .lineTo(cx - r * 0.22, cy - r * 0.06)
          .lineTo(cx + r * 0.22, cy - r * 0.06)
          .closePath()
          .fill({ color: dropColor, alpha: 0.9 * alpha });
        break;
      }
    }
  }

  private createView(c: Creature): CreatureView {
    const node = new Container();
    const rig = buildRig(rigFor(c.species), c.stage);
    const spriteWrap = new Container();
    const sprite = new Sprite();
    spriteWrap.addChild(sprite);
    node.addChild(rig.root, spriteWrap);

    // Duck-only: a ripple sprite nested in the shadow container, hidden
    // until this duck is swimming (M9 task 4).
    let rippleSprite: Sprite | undefined;
    if (c.species === 'duck') {
      rippleSprite = new Sprite(this.rippleTexture);
      rippleSprite.anchor.set(0.5);
      rippleSprite.visible = false;
      rig.shadow?.addChild(rippleSprite);
    }

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0xffffff,
        stroke: { color: 0x2c3a26, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    node.addChild(label);

    const view: CreatureView = {
      id: c.id,
      node,
      rig,
      spriteWrap,
      sprite,
      frames: this.bakeFrames(c.species, c.stage),
      label,
      species: c.species,
      stage: c.stage,
      prev: { x: c.pos.x, y: c.pos.y },
      curr: { x: c.pos.x, y: c.pos.y },
      heading: c.heading,
      activityId: c.activity.id,
      step: c.activity.step,
      minTicks: c.activity.minTicks,
      broodOffsetX: 0,
      broodOffsetY: 0,
      glyphKind: undefined,
      glyphAlpha: 0,
      odometer: 0,
      lastX: c.pos.x,
      lastY: c.pos.y,
      liftT: 0,
      shadowBaseY: rigFor(c.species).parts.find((p) => p.id === 'shadow')?.y ?? 0,
      rippleSprite,
      // Seed the swim/land hysteresis from the true reading (no 3-frame
      // delay on spawn) — irrelevant for non-amphibious species, which
      // never read swimmingState (medium gates it every frame in render()).
      swimmingState: SPECIES[c.species].medium === 'amphibious' && isWater(c.pos),
      swimAgreeCount: 0,
      nursing: false,
      nursed: false,
      feedContact: false,
      fedMs: 0,
      emergeKind: undefined,
      emergeMs: 0,
      emergeDirX: 0,
      emergeDirY: 0,
      zzzTimerMs: 0,
      // Jittered ±~20% around ZZZ_INTERVAL_MS off the creature's own id —
      // pure cosmetic variety, deliberately not a sim RNG draw.
      zzzIntervalMs: ZZZ_INTERVAL_MS + ((c.id * 37) % 401) - 200,
      glyphBornMs: 0,
      airborneNow: false,
      carriedBy: null,
      pouchAttached: false,
      pouchEaseFrom: undefined,
      pouchEaseDelta: undefined,
      pouchEaseMs: 0,
    };
    this.positionLabel(view);
    return view;
  }

  /** Swap rig + baked frames when a creature grows into its next stage. */
  private applyStage(view: CreatureView, stage: LifeStage): void {
    view.stage = stage;
    // Detach the persistent ripple sprite before the old rig tree is
    // destroyed (destroy({children:true}) would take it down too), then
    // reattach to the freshly built shadow container.
    if (view.rippleSprite) view.rig.shadow?.removeChild(view.rippleSprite);
    // M12 task 5: same precedent, for any real joey currently riding in
    // THIS view's pouch — rare (a carrying mother changing life stage
    // mid-ride) but the pouch container lives inside the rig about to be
    // destroyed, and a reparented rider would go down with it otherwise.
    // Found by parentage (`node.parent`), not a stored back-reference —
    // clutchMax 1 means there's at most one today, but this stays correct
    // even if that ever changes.
    const oldPouch = view.rig.pouch;
    const riders: CreatureView[] = [];
    if (oldPouch) {
      for (const v of this.views.values()) {
        if (v.node.parent === oldPouch) riders.push(v);
      }
    }
    for (const r of riders) oldPouch?.removeChild(r.node);

    view.rig.root.destroy({ children: true });
    view.rig = buildRig(rigFor(view.species), stage);
    view.node.addChildAt(view.rig.root, 0);
    if (view.rippleSprite) view.rig.shadow?.addChild(view.rippleSprite);
    for (const r of riders) {
      if (view.rig.pouch) {
        this.attachToPouch(r, view.rig.pouch);
      } else {
        // Defensive fallback: the new stage's rig has no pouch. Shouldn't
        // happen (kangarooRig.ts defines `pouch` in every stage), but
        // render the rider at its own position rather than orphaning it.
        this.creatureLayer.addChild(r.node);
        r.pouchAttached = false;
      }
    }
    view.frames = this.bakeFrames(view.species, stage);
    this.positionLabel(view);
  }

  private bakeFrames(species: SpeciesId, stage: LifeStage): CreatureView['frames'] {
    const rig = rigFor(species);
    // Bake off the symmetry points (k/6), not the old 0.25/0.75 pair: every
    // walk clip here is a symmetric 3-key track (t=0, 0.5, 1 mirrored), so
    // sampling at its own midpoints (0.25/0.75) always lands on identical
    // interpolated values — walkA and walkB were pixel-twins for 7 of 8
    // species. k/6 never lands on that symmetry, so all 6 frames differ.
    const walk: BakedFrame[] = [];
    for (let k = 0; k < N_WALK_FRAMES; k++) {
      walk.push(bakedFrame(this.app.renderer, rig, stage, 'walk', k / N_WALK_FRAMES));
    }
    const frames: CreatureView['frames'] = {
      idle: bakedFrame(this.app.renderer, rig, stage, 'idle', 0),
      walk,
      // Single mid-pose frames so mid-zoom (T1) reads eating, sleeping,
      // carrying and sitting too, not just idle/walk (M9 task 5). Core
      // clips, so every rig defines them — no existence guard needed.
      eat: bakedFrame(this.app.renderer, rig, stage, 'eat', 0.5),
      sleep: bakedFrame(this.app.renderer, rig, stage, 'sleep', 0.5),
      carry: bakedFrame(this.app.renderer, rig, stage, 'carry', 0.5),
      sit: bakedFrame(this.app.renderer, rig, stage, 'sit', 0.5),
    };
    // Only rigs that define 'flap'/'swim' get the extra bakes (M9 task 4) —
    // rig.clips.flap/.swim is undefined for every other species/clip pair.
    if (rig.clips.flap) {
      frames.flap = [0, 0.5].map((t) => bakedFrame(this.app.renderer, rig, stage, 'flap', t));
    }
    if (rig.clips.swim) {
      frames.swim = [bakedFrame(this.app.renderer, rig, stage, 'swim', 0)];
    }
    // M12 task 3: same existence guard, for the two Thread-C feeding clips
    // (rig.clips.feedGive/.feedTake — only rabbit/deer/robin/kangaroo define
    // them today). Single mid-pose bakes, like eat/sleep/carry/sit above —
    // these are held poses, not multi-frame cycles.
    if (rig.clips.feedGive) {
      frames.feedGive = bakedFrame(this.app.renderer, rig, stage, 'feedGive', 0.5);
    }
    if (rig.clips.feedTake) {
      frames.feedTake = bakedFrame(this.app.renderer, rig, stage, 'feedTake', 0.5);
    }
    // M13 Task 10: same existence guard, for the pouch mount/dismount
    // errand's own pose — only the kangaroo rig authors 'mount' today.
    // Single mid-pose bake, like feedGive/feedTake above.
    if (rig.clips.mount) {
      frames.mount = bakedFrame(this.app.renderer, rig, stage, 'mount', 0.5);
    }
    return frames;
  }

  /** One 24×10 ripple ellipse, baked once and reused by every swimming duck
   * (Ambient's bake-once pattern) — replaces the shadow while afloat. */
  private bakeRippleTexture(): Texture {
    const g = new Graphics().ellipse(12, 5, 12, 5).fill({ color: 0xdff3f5, alpha: 0.25 });
    const texture = this.app.renderer.generateTexture({
      target: g,
      frame: new Rectangle(0, 0, 24, 10),
      resolution: 1,
    });
    g.destroy(true);
    return texture;
  }

  /** One 48×48 stroked ring, baked once (Ambient's bake-once pattern) —
   * shown under whichever creature is tap-selected (M10 task 5). Deliberately
   * subtle: alpha 0.35, a plain stroke, no fill — a hint, not a highlight. */
  private bakeSelectionRingTexture(): Texture {
    const g = new Graphics().circle(24, 24, 20).stroke({ width: 3, color: 0xfff6da, alpha: 0.35 });
    const texture = this.app.renderer.generateTexture({
      target: g,
      frame: new Rectangle(0, 0, 48, 48),
      resolution: 1,
    });
    g.destroy(true);
    return texture;
  }

  private positionLabel(view: CreatureView): void {
    const scale = rigFor(view.species).stages[view.stage].scale;
    // Stagger by id so clustered creatures' activity labels (T2 only —
    // label.visible gates on tier === 2) don't stack on the same line.
    const stagger = ((view.id % 3) - 1) * 13;
    view.label.position.set(0, LABEL_HEIGHT[view.species] * scale + stagger);
  }

  /** Golden-hour glow + deep-night wash (screen space). */
  private applyOverlays(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    // Grade the static world layers.
    const grade = rampColor(TINT_RAMP, this.clock.dayT);
    this.groundSprite.tint = grade;
    for (const child of this.detailLayer.children) {
      if (child instanceof Graphics) child.tint = grade;
    }

    const phase = this.clock.phase;
    const glow =
      phase === 'dawn' || phase === 'dusk' ? Math.sin(Math.PI * this.clock.phaseT) * 0.14 : 0;
    this.glowOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: phase === 'dawn' ? 0xffb36b : 0xff8f5e, alpha: glow });

    this.nightOverlay
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: 0x16203e, alpha: (1 - this.clock.light) * 0.3 });
  }
}

/**
 * Choose an animation clip from sim activity + motion + the render-only
 * airborne/swimming presentation inference (M9 task 4/5). `pass` wins over
 * everything else — a passing elder is always at rest, per Task 3's
 * nearestRestable() landing guarantee — airborne/swimming come next.
 *
 * M9 task 5 fixes an ordering bug: `moving` outranks brood/nap. Both
 * 'brood' and 'gather' walk to a target before settling (behaviors.ts:
 * "Walk to the clutch, then sit"), so a sitter or napper still covering
 * ground must read as walking, not as asleep mid-stride — only once they
 * stop moving does the brood/nap pose take over. `feedYoung` splits on its
 * `step` field while moving: carry mode's step 2 (carrying food home, M11
 * renumbering — see src/sim/behaviors.ts) shows 'carry' instead of a plain
 * 'walk'.
 *
 * M10 task 4 adds the nurse hold, both stationary-only (already excluded
 * from `moving` since neither mother nor snuggled-in baby travels during a
 * hold): `nursing` (the mother, feedMode 'nurse' + activity 'feedYoung',
 * M12 renumbering — step 2, the 90-tick nursing hold itself) reads 'sit'
 * instead of the generic 'eat' the old feedYoung fallback gave her;
 * `nursed` (a family baby within FEED_RANGE) reads 'eat' regardless of its
 * own activity.
 *
 * M11 adds `fed`: any baby mid its own FED_HOLD_MS "just got fed" beat (see
 * CreatureView.fedMs) also reads 'eat', whether the feeding was a carry
 * delivery or a nurse suckle — same rank as `nursed`, since it's the same
 * "snuggled in and being fed" read.
 *
 * M12 task 3 reorders `nursing` above `moving` — a nursing/settling mother
 * is genuinely stationary, but checking `moving` first cost her pose right
 * on arrival and would have bitten the settle beat's facing micro-
 * adjustments, so nursing is checked first on principle even though the
 * two conditions rarely overlap in practice. It also layers `feedGive`
 * (a parent, mid the "actual feeding is happening" step of either mode) and
 * `feedTake` (a baby in contact during that same window) on top of the
 * sit/eat poses they're replacing — both pre-resolved by the caller against
 * the creature's own rig (graceful fallback: a rig that doesn't author
 * these clips keeps getting 'sit'/'eat' exactly as before).
 *
 * M12 task 5 adds `carried` — a real joey riding in its mother's pouch —
 * checked right after `pass`, the strongest override short of it (a joey
 * is always dismounted, per `stepPouch`, the moment it enters 'pass', so
 * the two never actually overlap — but `pass` still wins over `carried`
 * on principle, matching the "`pass` wins over everything else" rule
 * above). `moving` reads true the whole ride (its `curr`/`prev` literally
 * track its carrier's motion, sim/movement.ts), which unchecked would show
 * her joey walking mid-air inside the pouch — so `carried` is checked
 * before `moving` and wins outright.
 *
 * M13 task 9 (Thread 3 Task 8, sim side) replaces the old instant
 * carriedBy flip with a multi-tick climb errand: `activityId` is `'mount'`
 * — not the M12-era `'idle'` this comment used to describe — for both the
 * brief ride-in settle right after actually climbing aboard (carried,
 * step 3) and the climb-out lead-in right before dismounting (also still
 * carried, step 2); it's `'idle'` only for the steady middle of a ride.
 * `carried` now resolves to `'mount'` instead of the flat `'sit'` whenever
 * `activityId === 'mount'` AND the rig actually authors that clip
 * (`hasMount`, resolved by the caller exactly like `feedGiving`/
 * `feedTaking` against the rig's own `clips` object) — Task 10 authored the
 * kangaroo rig's `'mount'` clip, so `hasMount` is true for kangaroo and this
 * resolves to the real reach-and-scramble pose there; every other rig still
 * fails that guard and falls back to `'sit'`, byte-identical to M12.
 * `hasMount` also gets a second, NON-carried check placed after `moving`:
 * a joey still on its own feet mid-errand (step 0 approach, step 1 settle)
 * reads `'walk'` while it's actually covering ground (the ordinary
 * `moving` branch already handles that — this is why the mount check sits
 * below it) and `'mount'` (or `'idle'` as the same graceful fallback)
 * once it settles stationary just before climbing in.
 */
function clipFor(
  activityId: string,
  moving: boolean,
  airborne: boolean,
  swimming: boolean,
  feedYoungStep: number | undefined,
  nursing: boolean,
  nursed: boolean,
  fed: boolean,
  feedGiving: boolean,
  feedTaking: boolean,
  carried: boolean,
  hasMount: boolean,
): ClipName {
  if (activityId === 'pass') return 'sleep';
  if (carried) return activityId === 'mount' && hasMount ? 'mount' : 'sit';
  if (airborne) return 'flap';
  if (swimming) return 'swim';
  if (nursing) return feedGiving ? 'feedGive' : 'sit';
  if (moving) return activityId === 'feedYoung' && feedYoungStep === 2 ? 'carry' : 'walk';
  // M13 task 9: stationary, not-yet-carried steps 0/1 of the pouch mount
  // errand (see the doc comment above) — `hasMount` is true for the
  // kangaroo rig (Task 10 authored its 'mount' clip), so this resolves to
  // the real pose there; every other species still falls back to 'idle'.
  if (activityId === 'mount') return hasMount ? 'mount' : 'idle';
  if (nursed || fed || feedTaking) return feedTaking ? 'feedTake' : 'eat';
  if (activityId === 'brood' || activityId === 'gestate') return 'sit';
  if (activityId === 'nap') return 'sleep';
  if (activityId === 'forage' || activityId === 'feedYoung') {
    return activityId === 'feedYoung' && feedGiving ? 'feedGive' : 'eat';
  }
  if (activityId === 'socialize' || activityId === 'court') return 'social';
  return 'idle';
}

/**
 * Which small activity glyph (if any) a creature's current activity earns
 * (M9 task 5). `feedYoung` only glyphs for carry-mode species (`species`'s
 * own reproduction.feedMode) — nurse mode's own step-0 walk-home leg reads
 * as plain walking, no glyph, exactly as before M11; its glyph vocabulary
 * comes entirely from the `nursing`/fed overrides in render() instead.
 * Carry mode's four steps (M11 renumbering) split evenly: steps 0-1
 * (seeking, pickup pause) read 'forage' — the parent is out looking; steps
 * 2-3 (carrying home, delivery hold) read 'carry' — it has something.
 * `gather` is reused for three different family moments the sim doesn't
 * otherwise distinguish; only the long-minTicks mourning one glyphs (see
 * MOURNING_GATHER_MIN_TICKS).
 */
function glyphKindFor(
  activityId: string,
  step: number | undefined,
  minTicks: number,
  species: SpeciesId,
): GlyphKind | undefined {
  switch (activityId) {
    case 'forage':
      return 'forage';
    case 'nap':
      return 'nap';
    case 'court':
      return 'court';
    case 'brood':
      return 'brood';
    case 'gestate':
      return 'gestate';
    case 'feedYoung':
      if (SPECIES[species].reproduction.feedMode !== 'carry') return undefined;
      return step === 0 || step === 1 ? 'forage' : step === 2 || step === 3 ? 'carry' : undefined;
    case 'gather':
      return minTicks >= MOURNING_GATHER_MIN_TICKS ? 'mourning' : undefined;
    case 'mount':
      // The pouch mount/dismount errand (M13) reads through animation and
      // reparenting, not a glyph — explicit no-op, not an oversight.
      return undefined;
    default:
      return undefined;
  }
}

/** Which glyph a just-fed baby shows (M11) — matches the mote tint that led
 * into it: nurse-mode babies keep the milk droplet (they were suckling, not
 * carried to), everyone else gets the amber carry dot. */
function fedGlyphFor(species: SpeciesId): GlyphKind {
  return SPECIES[species].reproduction.feedMode === 'nurse' ? 'nurse' : 'carry';
}

const FAMILY_NAMES = [
  'Bramble',
  'Clover',
  'Willow',
  'Fern',
  'Maple',
  'Hazel',
  'Rowan',
  'Aspen',
  'Poppy',
  'Birch',
  'Tansy',
  'Sorrel',
];

export function familyName(id: number): string {
  return FAMILY_NAMES[id % FAMILY_NAMES.length] ?? 'Meadow';
}

/**
 * Strokes a short curved segment as an explicit moveTo/lineTo polyline —
 * deliberately NOT Graphics.arc(), which (like canvas's arc()) implicitly
 * draws a straight connecting line from wherever the shared Graphics
 * object's path last left off to the arc's own start point. glyphLayer is
 * one Graphics redrawn for every on-screen creature each frame, so an arc()
 * chained after another creature's glyph would stitch a stray line clear
 * across the world — this segmented approach always starts its own moveTo,
 * matching how every other multi-shape drawing in this codebase (see
 * ValleyPainter's drawReeds/drawTree) stays artifact-free.
 */
function strokeArc(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: number,
  width: number,
  alpha: number,
): void {
  const segments = 6;
  g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= segments; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / segments;
    g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  g.stroke({ color, width, alpha, cap: 'round' });
}

/** Piecewise-linear color ramp lookup. */
function rampColor(ramp: [number, number][], t: number): number {
  for (let i = 0; i < ramp.length - 1; i++) {
    const a = ramp[i];
    const b = ramp[i + 1];
    if (!a || !b) break;
    if (t >= a[0] && t <= b[0]) {
      const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      return lerpColor(a[1], b[1], f);
    }
  }
  return ramp[ramp.length - 1]?.[1] ?? 0xffffff;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
