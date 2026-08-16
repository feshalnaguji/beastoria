/**
 * InspectCard: tap-to-inspect panel (game UI, always available — not a dev
 * tool). Meet-the-neighbors, M10 task 5: tap any creature to see a gentle
 * little "who's this" card — bottom-center, mobile-safe, PILL_CSS-styled.
 * main.ts owns the tap-vs-drag discriminator and wires taps to show()/hide();
 * this file only renders and computes the card's text.
 */
import { familyName } from '../render/Renderer';
import { SPECIES } from '../sim/species';
import type { Creature, WorldState } from '../sim/state';
import { PILL_CSS } from './Hud';

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

/** Same Math.imul mix as behaviors.ts's idOffsetAngle — a different id-hash
 * trick reused here for name choice instead of an angle. */
function idHash(id: number): number {
  let h = Math.imul(id, 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

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
    case 'feedYoung':
      return SPECIES[c.species].reproduction.feedMode === 'nurse'
        ? 'nursing the little ones'
        : 'bringing food home';
    case 'brood':
      return 'keeping the eggs warm';
    case 'court':
      return 'smitten';
    case 'gather':
      return 'paying respects';
    default:
      return 'taking the air'; // wander, idle, socialize, and any future id
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    this.doingEl.textContent = creatureDoing(c, presentation);
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
