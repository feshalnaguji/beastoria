/**
 * InspectCard: tap-to-inspect panel (game UI, always available — not a dev
 * tool). Meet-the-neighbors, M10 task 5: tap any creature to see a gentle
 * little "who's this" card — bottom-center, mobile-safe, PILL_CSS-styled.
 * main.ts owns the tap-vs-drag discriminator and wires taps to show()/hide();
 * this file only renders and computes the card's text.
 */
import { MOURNING_GATHER_MIN_TICKS } from '../sim/behaviors';
import { SPECIES } from '../sim/species';
import type { Creature, WorldState } from '../sim/state';
import { PILL_CSS } from './Hud';
import { creatureName, NAME_MAX, NameBook } from './names';
import { familyName } from '../render/Renderer';

/** Render-only presentation hint from Renderer.presentationFor() — whether
 * the creature currently reads as airborne/swimming, same inference the
 * animation clip uses (see Renderer's clipFor). */
export interface Presentation {
  airborne: boolean;
  swimming: boolean;
}

export function creatureRole(state: WorldState, c: Creature, familyOf: (id: number) => string): string {
  const fam = c.familyId === null ? undefined : state.families.find((f) => f.id === c.familyId);
  if (fam) {
    if (fam.parentIds.includes(c.id)) {
      return `${c.sex === 'f' ? 'mother' : 'father'} of the ${familyOf(fam.id)} family`;
    }
    const kidIdx = fam.childIds.indexOf(c.id);
    if (kidIdx !== -1) return `little one of the ${familyOf(fam.id)} family`;
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
    case 'mount':
      // M13: the joey's real climb-in/climb-out errand (family.ts). Step 2
      // is the climb-out lead-in — still carried, but on its way down —
      // every other step (0 approach, 1 settle, 3 ride-in) reads as
      // climbing in.
      return c.activity.step === 2 ? 'climbing out of the pouch' : 'climbing into the pouch';
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
  // G2 task 4: which field (if any) is mid-edit. show() is called every tick
  // by main.ts's loop to keep doingEl live; while a field is open this must
  // stop it from clobbering the input the child is typing into.
  private editing: 'creature' | 'family' | null = null;
  // The most recent show() args, kept so a save/cancel can re-render the
  // card immediately (without waiting for next tick's show() call).
  private lastArgs: { state: WorldState; c: Creature; presentation: Presentation | undefined } | null = null;

  constructor(onDismiss: () => void, private names: NameBook, private opts: { canRename: boolean }) {
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
    this.lastArgs = { state, c, presentation };
    // Mid-edit: leave nameEl/roleEl (they hold the open input) alone — only
    // doingEl tracks the sim every tick.
    if (this.editing === null) {
      this.renderName(state, c);
      this.renderRole(state, c);
      this.metaEl.textContent = `${capitalize(c.species)} · ${c.stage}`;
    }
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
    this.editing = null;
  }

  isEditing(): boolean {
    return this.editing !== null;
  }

  private renderName(state: WorldState, c: Creature): void {
    this.nameEl.textContent = '';
    const name = this.names.creature(state, c);
    this.nameEl.appendChild(document.createTextNode(name));
    if (this.opts.canRename) {
      this.nameEl.appendChild(this.makeEditButton(`rename ${name}`, () => this.openCreatureEditor(state, c)));
    }
  }

  private renderRole(state: WorldState, c: Creature): void {
    this.roleEl.textContent = '';
    this.roleEl.appendChild(document.createTextNode(creatureRole(state, c, (id) => this.names.family(id))));
    if (this.opts.canRename && c.familyId !== null) {
      const fam = state.families.find((f) => f.id === c.familyId);
      if (fam) {
        const famDisplayName = this.names.family(fam.id);
        this.roleEl.appendChild(
          this.makeEditButton(`rename the ${famDisplayName} family`, () => this.openFamilyEditor(fam.id)),
        );
      }
    }
  }

  private makeEditButton(label: string, onOpen: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✎';
    btn.setAttribute('aria-label', label);
    btn.style.cssText = [
      'background:none', 'border:none', 'color:inherit', 'font-size:13px',
      'opacity:.7', 'margin-left:6px', 'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpen();
    });
    return btn;
  }

  private openCreatureEditor(state: WorldState, c: Creature): void {
    this.editing = 'creature';
    this.buildEditor(this.nameEl, this.names.data.creatures[c.id] ?? '', creatureName(state, c), (value) =>
      this.names.setCreature(c.id, value),
    );
  }

  private openFamilyEditor(familyId: number): void {
    this.editing = 'family';
    this.buildEditor(this.roleEl, this.names.data.families[familyId] ?? '', familyName(familyId), (value) =>
      this.names.setFamily(familyId, value),
    );
  }

  /** Replaces `container`'s content with an inline text editor: an input
   * pre-filled with the current custom name (blank if none, placeholder
   * shows the generated fallback), plus ✓ (save) and ✕ (cancel) buttons.
   * Enter/✓ saves via `onSave`, Escape/✕ discards — either way `editing`
   * clears and the card re-renders from the last-shown creature. */
  private buildEditor(container: HTMLElement, current: string, placeholder: string, onSave: (value: string) => void): void {
    container.textContent = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.placeholder = placeholder;
    input.value = current;
    input.style.cssText = 'font:inherit;width:110px;max-width:100%;';
    // Never let the editor's keys/taps reach window-level listeners (Camera's
    // keydown pan/zoom, DevPanel's backtick toggle, WelcomeBack's
    // dismiss-on-pointerdown) — Camera already ignores INPUT targets, but the
    // others don't check the target at all.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('pointerdown', (e) => e.stopPropagation());

    const finish = (save: boolean): void => {
      if (save) onSave(input.value);
      this.editing = null;
      if (this.lastArgs) this.show(this.lastArgs.state, this.lastArgs.c, this.lastArgs.presentation);
    };

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = '✓';
    okBtn.setAttribute('aria-label', 'save name');
    okBtn.style.cssText = 'background:none;border:none;color:inherit;font-size:13px;opacity:.7;margin-left:4px;cursor:pointer;';
    okBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      finish(true);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '✕';
    cancelBtn.setAttribute('aria-label', 'cancel');
    cancelBtn.style.cssText = okBtn.style.cssText;
    cancelBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      finish(false);
    });

    container.appendChild(input);
    container.appendChild(okBtn);
    container.appendChild(cancelBtn);
    input.focus();
    input.select();
  }
}
