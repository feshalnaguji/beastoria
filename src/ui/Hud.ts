/**
 * HUD: three fixed pills.
 * - Sound chip (top-right): before unlock "🔈 sound on" (pulsing, inviting the
 *   first tap/click); after unlock, a mute toggle showing 🔊/🔇 reflecting
 *   audio.muted. A click (or Enter/Space) on the chip unlocks audio on first
 *   activation (a real user gesture), or toggles mute thereafter.
 * - Clock pill (top-left): "Day {n} · {phase icon}" — 🌅 dawn / ☀️ day / 🌇 dusk /
 *   🌙 night. Fed from main's tick loop via setClock(); re-renders only when the
 *   day or phase actually changes, not every tick.
 * - Fullscreen chip (top-right, below the sound chip): "⛶" toggles
 *   document.documentElement's fullscreen state (F11 already does this at the
 *   OS/browser level — this is the in-app affordance). Self-contained: reads
 *   document.fullscreenElement directly rather than needing state pushed in,
 *   since (unlike audio/clock) fullscreen has no sim or engine dependency.
 *   Hidden entirely when the browser doesn't support the Fullscreen API.
 * - Share pill (top-left, below the creature guide link): "🔗 share" opens
 *   the ShareCard (G2 Task 5) via `onShare`, set by main.ts once it has the
 *   seed/renderer this needs.
 */
import type { AudioEngine } from '../audio/AudioEngine';
import type { Clock } from '../sim/clock';

const PULSE_CSS = '@keyframes beastoria-hud-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }';

export const PILL_CSS = [
  'position:fixed', 'z-index:10',
  'background:rgba(30,40,30,.65)', 'color:#fff',
  'font-family:Georgia,serif', 'padding:6px 12px', 'border-radius:999px',
  'user-select:none',
];

const PHASE_ICON: Record<Clock['phase'], string> = {
  dawn: '🌅',
  day: '☀️',
  dusk: '🌇',
  night: '🌙',
};

export class Hud {
  private chip: HTMLDivElement;
  private clockPill: HTMLDivElement;
  private fullscreenChip: HTMLDivElement;
  private sharePill: HTMLDivElement;
  private guideLink: HTMLAnchorElement;
  private childPill: HTMLDivElement;
  private childAvailable = true;
  private journalPill: HTMLDivElement;
  private seasonSuffix = '';
  private seasonTitle = '';
  private lastDay: number | null = null;
  private lastPhase: Clock['phase'] | null = null;

  /** Set by main.ts once it has the seed/renderer a share needs. */
  onShare?: () => void;
  /** Set by main.ts: opens the child-mode start card. */
  onChildMode?: () => void;
  /** Set by main.ts: opens the valley journal (G4). */
  onJournal?: () => void;

  constructor(private readonly audio: AudioEngine) {
    const style = document.createElement('style');
    style.textContent = PULSE_CSS;
    document.head.appendChild(style);

    this.chip = document.createElement('div');
    this.chip.style.cssText = [...PILL_CSS, 'top:12px', 'right:12px', 'cursor:pointer'].join(';');
    this.chip.setAttribute('role', 'button');
    this.chip.setAttribute('tabindex', '0');
    this.chip.setAttribute('data-testid', 'sound-chip');
    // Stop the pointerdown from reaching the window's once-only unlock listener first,
    // so isUnlocked is still false when the click handler below runs — otherwise the
    // click would immediately toggle muted=true on what the user intended as the
    // unlock gesture (and persist it).
    this.chip.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.chip.addEventListener('click', () => this.onChipActivate());
    this.chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onChipActivate();
      }
    });
    document.body.appendChild(this.chip);

    this.clockPill = document.createElement('div');
    this.clockPill.style.cssText = [...PILL_CSS, 'top:12px', 'left:12px'].join(';');
    this.clockPill.setAttribute('data-testid', 'hud-clock');
    this.clockPill.setAttribute('aria-hidden', 'false');
    document.body.appendChild(this.clockPill);

    this.fullscreenChip = document.createElement('div');
    this.fullscreenChip.style.cssText = [...PILL_CSS, 'top:54px', 'right:12px', 'cursor:pointer'].join(';');
    this.fullscreenChip.setAttribute('role', 'button');
    this.fullscreenChip.setAttribute('tabindex', '0');
    this.fullscreenChip.setAttribute('data-testid', 'fullscreen-chip');
    this.fullscreenChip.textContent = '⛶';
    this.fullscreenChip.addEventListener('click', () => this.toggleFullscreen());
    this.fullscreenChip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
    document.body.appendChild(this.fullscreenChip);
    this.fullscreenChip.hidden = !document.fullscreenEnabled;
    document.addEventListener('fullscreenchange', () => this.renderFullscreenChip());
    this.renderFullscreenChip();

    this.guideLink = document.createElement('a');
    this.guideLink.href = './guide/';
    this.guideLink.textContent = '🐾 creatures';
    this.guideLink.setAttribute('aria-label', 'creature guide');
    this.guideLink.title = 'Meet the creatures';
    this.guideLink.style.cssText = [...PILL_CSS, 'top:54px', 'left:12px', 'text-decoration:none', 'font-size:14px'].join(';');
    document.body.appendChild(this.guideLink);

    this.sharePill = document.createElement('div');
    this.sharePill.style.cssText = [...PILL_CSS, 'top:96px', 'left:12px', 'cursor:pointer', 'font-size:14px'].join(';');
    this.sharePill.setAttribute('role', 'button');
    this.sharePill.setAttribute('tabindex', '0');
    this.sharePill.setAttribute('aria-label', 'share your valley');
    this.sharePill.setAttribute('data-testid', 'share-pill');
    this.sharePill.textContent = '🔗 share';
    this.sharePill.addEventListener('click', () => this.onShare?.());
    this.sharePill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onShare?.();
      }
    });
    document.body.appendChild(this.sharePill);

    this.childPill = document.createElement('div');
    this.childPill.style.cssText = [...PILL_CSS, 'top:138px', 'left:12px', 'cursor:pointer', 'font-size:14px'].join(';');
    this.childPill.setAttribute('role', 'button');
    this.childPill.setAttribute('tabindex', '0');
    this.childPill.setAttribute('aria-label', 'child mode');
    this.childPill.setAttribute('data-testid', 'child-pill');
    this.childPill.textContent = '👪 child mode';
    this.childPill.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.childPill.addEventListener('click', () => this.onChildMode?.());
    this.childPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onChildMode?.();
      }
    });
    document.body.appendChild(this.childPill);

    // Valley journal (G4): harmless to read, so it stays visible in child mode.
    this.journalPill = document.createElement('div');
    this.journalPill.style.cssText = [...PILL_CSS, 'top:180px', 'left:12px', 'cursor:pointer', 'font-size:14px'].join(';');
    this.journalPill.setAttribute('role', 'button');
    this.journalPill.setAttribute('tabindex', '0');
    this.journalPill.setAttribute('aria-label', 'valley journal');
    this.journalPill.setAttribute('data-testid', 'journal-pill');
    this.journalPill.textContent = '📖 journal';
    this.journalPill.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.journalPill.addEventListener('click', () => this.onJournal?.());
    this.journalPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onJournal?.();
      }
    });
    document.body.appendChild(this.journalPill);

    this.audio.onUnlock = () => this.renderChip();
    this.renderChip();
  }

  /** The journal belongs to your own valley — hidden while visiting a friend's. */
  setJournalAvailable(available: boolean): void {
    this.journalPill.hidden = !available;
  }

  /** Real-calendar season (G4) shown after the day/phase in the clock pill. */
  setSeason(icon: string, name: string, fullMoon: boolean): void {
    this.seasonSuffix = ` · ${icon}${fullMoon ? ' 🌕' : ''}`;
    this.seasonTitle = `${name}${fullMoon ? ', full moon' : ''}`;
    this.lastDay = null; // force the next setClock to re-render
  }

  /** Child mode can't be started from some states (visiting a friend's valley). */
  setChildModeAvailable(available: boolean): void {
    this.childAvailable = available;
    this.childPill.hidden = !available;
  }

  /** Child mode hides everything that leaves the valley or changes settings. */
  setChildMode(on: boolean): void {
    this.guideLink.hidden = on;
    this.sharePill.hidden = on;
    this.fullscreenChip.hidden = on || !document.fullscreenEnabled;
    this.childPill.hidden = on || !this.childAvailable;
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }

  private renderFullscreenChip(): void {
    const isFull = document.fullscreenElement !== null;
    this.fullscreenChip.title = isFull ? 'exit fullscreen' : 'fullscreen';
    this.fullscreenChip.setAttribute('aria-label', isFull ? 'exit fullscreen' : 'enter fullscreen');
  }

  /** Update the clock pill from a fresh sim tick. Re-renders only on day/phase change. */
  setClock(clock: Clock): void {
    if (clock.day === this.lastDay && clock.phase === this.lastPhase) return;
    this.lastDay = clock.day;
    this.lastPhase = clock.phase;
    const icon = PHASE_ICON[clock.phase];
    this.clockPill.textContent = `Day ${clock.day} · ${icon}${this.seasonSuffix}`;
    this.clockPill.title = `Day ${clock.day} — ${clock.phase}${this.seasonTitle ? ` · ${this.seasonTitle}` : ''}`;
  }

  private onChipActivate(): void {
    if (!this.audio.isUnlocked) {
      this.audio.unlock(); // click itself is a user gesture; onUnlock() re-renders
      return;
    }
    this.audio.muted = !this.audio.muted;
    this.renderChip();
  }

  private renderChip(): void {
    if (!this.audio.isUnlocked) {
      this.chip.textContent = '🔈 sound on';
      this.chip.style.animation = 'beastoria-hud-pulse 2s ease-in-out infinite';
      this.chip.setAttribute('aria-label', 'enable sound');
    } else {
      this.chip.textContent = this.audio.muted ? '🔇' : '🔊';
      this.chip.style.animation = 'none';
      this.chip.setAttribute('aria-label', this.audio.muted ? 'unmute sound' : 'mute sound');
    }
  }
}
