/**
 * Sound chip (game UI, not dev tool): fixed top-right pill.
 * Before audio unlock: "🔈 sound on" (pulsing, inviting the first tap/click).
 * After unlock: a mute toggle showing 🔊 / 🔇, reflecting audio.muted.
 * A click on the chip itself also unlocks audio (it's a real user gesture).
 */
import type { AudioEngine } from '../audio/AudioEngine';

const PULSE_CSS = '@keyframes beastoria-hud-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }';

export class Hud {
  private chip: HTMLDivElement;

  constructor(private readonly audio: AudioEngine) {
    const style = document.createElement('style');
    style.textContent = PULSE_CSS;
    document.head.appendChild(style);

    this.chip = document.createElement('div');
    this.chip.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:10',
      'background:rgba(30,40,30,.65)', 'color:#fff',
      'font-family:Georgia,serif', 'padding:6px 12px', 'border-radius:999px',
      'cursor:pointer', 'user-select:none',
    ].join(';');
    // Stop the pointerdown from reaching the window's once-only unlock listener first,
    // so isUnlocked is still false when the click handler below runs — otherwise the
    // click would immediately toggle muted=true on what the user intended as the
    // unlock gesture (and persist it).
    this.chip.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.chip.addEventListener('click', () => {
      if (!this.audio.isUnlocked) {
        this.audio.unlock(); // click itself is a user gesture; onUnlock() re-renders
        return;
      }
      this.audio.muted = !this.audio.muted;
      this.render();
    });
    document.body.appendChild(this.chip);

    this.audio.onUnlock = () => this.render();
    this.render();
  }

  private render(): void {
    if (!this.audio.isUnlocked) {
      this.chip.textContent = '🔈 sound on';
      this.chip.style.animation = 'beastoria-hud-pulse 2s ease-in-out infinite';
    } else {
      this.chip.textContent = this.audio.muted ? '🔇' : '🔊';
      this.chip.style.animation = 'none';
    }
  }
}
