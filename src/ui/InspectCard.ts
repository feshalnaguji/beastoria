/**
 * InspectCard: tap-to-inspect panel (game UI, always available — not a dev
 * tool). Meet-the-neighbors, M10 task 5: tap any creature to see a gentle
 * little "who's this" card — bottom-center, mobile-safe, PILL_CSS-styled.
 * main.ts owns the tap-vs-drag discriminator and wires taps to show()/hide();
 * this file only renders and computes the card's text.
 */
import { familyName } from '../render/Renderer';
import { idHash } from '../sim/behaviors';
import { SPECIES } from '../sim/species';
import type { Creature, WorldState } from '../sim/state';
import { PILL_CSS } from './Hud';

/** Matches src/sim/family.ts's PASS_GATHER_TICKS and Renderer.ts's own
 * MOURNING_GATHER_MIN_TICKS — 'gather' is reused for three unrelated family
 * moments (mourning vigil, nest-material gathering, baby leash-back) that
 * the sim doesn't otherwise distinguish; only the long-minTicks vigil one
 * reads as mourning (see glyphKindFor's identical gate in Renderer.ts). */
const MOURNING_GATHER_MIN_TICKS = 200;

/** Render-only presentation hint from Renderer.presentationFor() — whether
 * the creature currently reads as airborne/swimming, same inference the
 * animation clip uses (see Renderer's clipFor). */
export interface Presentation {
  airborne: boolean;
  swimming: boolean;
}

/** 24 gentle, nature-flavored given names — deliberately distinct from
 * Renderer's FAMILY_NAMES (plant names for the family surname) so a card
 * never reads like "Willow of the Willow family". */
const CREATURE_NAMES = [
  'Pip', 'Wren', 'Moss', 'Dew', 'Sage', 'Briar', 'Juniper', 'Fennel',
  'Thistle', 'Meadow', 'Marigold', 'Olive', 'Plum', 'Cricket', 'Sprig',
  'Acorn', 'Pebble', 'Breeze', 'Feather', 'Petal', 'Clay', 'Ember',
  'Frost', 'Lark',
];

/** This creature's index within its family's parents+children (0 for a
 * family-less wanderer) — added into the name hash so siblings in the same
 * family never land on the same list index, even though two creatures
 * elsewhere in the valley may still share a name. */
function familyPosition(state: WorldState, c: Creature): number {
  if (c.familyId === null) return 0;
  const fam = state.families.find((f) => f.id === c.familyId);
  if (!fam) return 0;
  const idx = [...fam.parentIds, ...fam.childIds].indexOf(c.id);
  return idx === -1 ? 0 : idx;
}

export function creatureName(state: WorldState, c: Creature): string {
  const idx = (idHash(c.id) + familyPosition(state, c)) % CREATURE_NAMES.length;
  return CREATURE_NAMES[idx] ?? 'Meadow';
}

export function creatureRole(state: WorldState, c: Creature): string {
  const fam = c.familyId === null ? undefined : state.families.find((f) => f.id === c.familyId);
  if (fam) {
    if (fam.parentIds.includes(c.id)) {
      return `${c.sex === 'f' ? 'mother' : 'father'} of the ${familyName(fam.id)} family`;
    }
    const kidIdx = fam.childIds.indexOf(c.id);
    if (kidIdx !== -1) return `kid ${kidIdx + 1}`;
  }
  if (c.stage === 'elder') return 'elder';
  return 'a wanderer (no family yet)';
}

/** Plain-words activity, in the same priority order as Renderer's clipFor:
 * a passing elder always reads as passing; airborne/swimming (render-only
 * inference, not a sim field) come next; everything else maps off the sim's
 * own activity id, with wander/idle/socialize/anything unmapped falling back
 * to a calm catch-all. */
export function creatureDoing(c: Creature, presentation: Presentation | undefined): string {
  if (c.activity.id === 'pass') return 'passing gently';
  if (presentation?.airborne) return 'on the wing';
  if (presentation?.swimming) return 'paddling about';
  switch (c.activity.id) {
    case 'forage':
      return 'looking for something tasty';
    case 'nap':
      return 'dozing';
    case 'feedYoung': {
      // Beat-aware text (M12 task 3): every step of feedYoung's holding
      // sequence now earns its own words, so what's written always matches
      // what's on screen — see src/sim/behaviors.ts's `case 'feedYoung'`
      // for the authoritative step numbers this mirrors.
      //
      // Nurse mode (rabbit/deer/kangaroo — the mother, per family.ts's
      // "the mother always nurses"): 0 travel home (the default fallback
      // below — she hasn't arrived yet), 1 the settle beat (gathering in
      // before the hold itself starts), 2 the 90-tick nursing hold (the
      // actual feeding), 3 a satisfied linger after.
      //
      // Carry mode (bird species, four earlier steps unchanged from M11 +
      // one new linger): 0 seek/1 pickup pause still share the wordless
      // "out finding" fallback (the pause itself reads via the 'eat'-clip
      // head-dip, not a text change), 2 carrying home, 3 the delivery hold,
      // 4 (new) a satisfied linger — distinct from step 3's in-progress text
      // so the words don't just repeat once the delivering is actually done.
      if (SPECIES[c.species].reproduction.feedMode === 'nurse') {
        switch (c.activity.step) {
          case 1:
            return 'gathering her little ones close';
          case 2:
            return 'nursing the little ones';
          case 3:
            return 'resting close, milk-warm and content';
          default:
            return 'heading home to her little ones';
        }
      }
      switch (c.activity.step) {
        case 2:
          return 'bringing food home';
        case 3:
          return 'feeding the little ones';
        case 4:
          return 'resting a moment, the delivery done';
        default:
          return 'out finding food for the little ones';
      }
    }
    case 'brood':
      return 'keeping the eggs warm';
    case 'gestate':
      return 'resting close to home, her time coming soon';
    case 'court':
      return 'smitten';
    case 'gather':
      // 'gather' is reused for 3 distinct family moments (family.ts) that
      // share no other sim field — only minTicks tells them apart, exactly
      // as Renderer.ts's glyphKindFor already gates its mourning glyph:
      // the long vigil (minTicks 200) is the true "paying respects"; both
      // everyday reuses (nest-material gathering, minTicks 30 for a parent;
      // baby leashed back toward home/nurse, minTicks 30 for a baby) get
      // their own routine wording so tapping a nest-building parent or a
      // wandering kit never falsely reads as grief.
      if (c.activity.minTicks >= MOURNING_GATHER_MIN_TICKS) return 'paying respects';
      return c.stage === 'baby' ? 'heading home' : 'gathering nest material';
    default:
      return 'taking the air'; // wander, idle, socialize, and any future id
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** M12 task 5: true while `c` currently has a baby mounted in her pouch.
 * The carry link is stored on the RIDER (`Creature.carriedBy`), not the
 * carrier, so reading it from the carrier's side means scanning for it —
 * see sim/state.ts's own field comment for why. Only ever true for a
 * kangaroo mother (the sole pouchCarry species, sim/species.ts) with a
 * riding joey; a carried creature is excluded from `pickCreature`'s hit
 * test (Renderer.ts), so this is the only way to learn about the joey —
 * through the mother's own card. */
function isCarryingJoey(state: WorldState, c: Creature): boolean {
  return state.creatures.some((rider) => rider.carriedBy === c.id);
}

/** M13: true for a live-birth mother whose family is in its 'expecting'
 * phase — this covers her whole gestation, including the free-roaming early
 * portion where her activity id is still whatever she's naturally doing
 * (forage/wander/idle/etc, no override) and so creatureDoing reads through
 * unchanged. Once family.ts actually drops her into the 'gestate' activity
 * for the late-gestation homebound stretch, creatureDoing's own `case
 * 'gestate'` already returns the specific text (see above) — callers must
 * gate on `c.activity.id !== 'gestate'` before appending this suffix, or
 * the two would double up. */
function isExpectingMother(state: WorldState, c: Creature): boolean {
  if (c.sex !== 'f' || c.familyId === null) return false;
  if (SPECIES[c.species].reproduction.mode !== 'live') return false;
  const fam = state.families.find((f) => f.id === c.familyId);
  return fam?.phase === 'expecting';
}

export class InspectCard {
  private root: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private roleEl: HTMLDivElement;
  private metaEl: HTMLDivElement;
  private doingEl: HTMLDivElement;

  constructor(onDismiss: () => void) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      ...PILL_CSS,
      'bottom:calc(16px + env(safe-area-inset-bottom))', 'left:50%',
      'transform:translateX(-50%)', 'padding:10px 18px 12px',
      'max-width:min(320px, calc(100vw - 24px))', 'text-align:center',
      'display:none', 'cursor:default',
    ].join(';');
    this.root.setAttribute('data-testid', 'inspect-card');

    const closeBtn = document.createElement('div');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('role', 'button');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.setAttribute('aria-label', 'dismiss');
    closeBtn.style.cssText = [
      'position:absolute', 'top:2px', 'right:8px', 'cursor:pointer',
      'font-size:16px', 'line-height:1', 'opacity:.7',
    ].join(';');
    closeBtn.addEventListener('click', () => onDismiss());
    closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDismiss();
      }
    });
    this.root.appendChild(closeBtn);

    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = 'font-weight:bold;font-size:15px;';
    this.root.appendChild(this.nameEl);

    this.roleEl = document.createElement('div');
    this.roleEl.style.cssText = 'font-size:13px;opacity:.9;margin-top:1px;';
    this.root.appendChild(this.roleEl);

    this.metaEl = document.createElement('div');
    this.metaEl.style.cssText = 'font-size:12px;opacity:.75;margin-top:3px;';
    this.root.appendChild(this.metaEl);

    this.doingEl = document.createElement('div');
    this.doingEl.style.cssText = 'font-size:13px;font-style:italic;margin-top:4px;';
    this.root.appendChild(this.doingEl);

    document.body.appendChild(this.root);
  }

  show(state: WorldState, c: Creature, presentation: Presentation | undefined): void {
    this.nameEl.textContent = creatureName(state, c);
    this.roleEl.textContent = creatureRole(state, c);
    this.metaEl.textContent = `${capitalize(c.species)} · ${c.stage}`;
    let doing = creatureDoing(c, presentation);
    // M12 task 5: a riding joey is excluded from pickCreature's own hit
    // test (it shares its mother's exact position), so her card is the
    // only place this is ever visible — appended rather than replacing,
    // so whatever she's actually doing still reads first.
    if (isCarryingJoey(state, c)) doing += ', her joey riding along in the pouch';
    // M13: a roaming live-birth mother earns the same suffix treatment —
    // once she's actually in the 'gestate' activity, creatureDoing's own
    // case already returns dedicated late-gestation text, so the suffix
    // only fires for her free-roaming early phase (guarded here to avoid
    // doubling up with that text).
    if (c.activity.id !== 'gestate' && isExpectingMother(state, c)) doing += ', carrying young';
    this.doingEl.textContent = doing;
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
