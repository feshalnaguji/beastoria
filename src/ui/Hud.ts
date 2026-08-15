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
 */
import type { AudioEngine } from '../audio/AudioEngine';
import type { Clock } from '../sim/clock';

const PULSE_CSS = '@keyframes beastoria-hud-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }';

const PILL_CSS = [
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
  private lastDay: number | null = null;
  private lastPhase: Clock['phase'] | null = null;

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
    if (!document.fullscreenEnabled) this.fullscreenChip.style.display = 'none';
    document.addEventListener('fullscreenchange', () => this.renderFullscreenChip());
    this.renderFullscreenChip();

    this.audio.onUnlock = () => this.renderChip();
    this.renderChip();
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
    this.clockPill.textContent = `Day ${clock.day} · ${icon}`;
    this.clockPill.title = `Day ${clock.day} — ${clock.phase}`;
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
