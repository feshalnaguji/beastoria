/**
 * Dev panel (dev tool, not game UI): toggled with the backquote (~) key.
 * Speed control, clock readout, FPS, and a raw-numbers creature inspector —
 * both this inspector and the game's own InspectCard (src/ui/InspectCard.ts)
 * read off renderer.selectedId, the single source of truth for "who's
 * selected"; main.ts is the only place that sets it (tap-to-inspect is now
 * an always-available game feature, not a DevPanel-only click, M10 task 5).
 */
import { clearSave, suppressSaves } from '../persist/store';
import { getClock } from '../sim/clock';
import type { WorldState } from '../sim/state';
import type { GameLoop } from './GameLoop';
import type { Renderer } from '../render/Renderer';

const SPEEDS = [1, 8, 64];

export class DevPanel {
  private root: HTMLDivElement;
  private info!: HTMLPreElement;
  private visible = false;
  private frames = 0;
  private fps = 0;
  private lastFpsTime = performance.now();

  constructor(
    private readonly state: WorldState,
    private readonly loop: GameLoop,
    private readonly renderer: Renderer,
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:10',
      'background:rgba(20,28,18,0.85)', 'color:#e8f0dc',
      'font:12px/1.5 monospace', 'padding:10px 12px', 'border-radius:8px',
      'display:none', 'user-select:none', 'max-width:280px',
    ].join(';');

    const buttons = document.createElement('div');
    for (const s of SPEEDS) {
      const b = document.createElement('button');
      b.textContent = `${s}x`;
      b.style.cssText = 'margin-right:6px;font:12px monospace;cursor:pointer;';
      b.addEventListener('click', () => this.loop.setSpeed(s));
      buttons.appendChild(b);
    }
    const labelToggle = document.createElement('button');
    labelToggle.textContent = 'labels';
    labelToggle.style.cssText = 'font:12px monospace;cursor:pointer;';
    labelToggle.addEventListener('click', () => {
      this.renderer.debugLabels = !this.renderer.debugLabels;
    });
    buttons.appendChild(labelToggle);

    const resetButton = document.createElement('button');
    resetButton.textContent = '🌱 reset valley';
    resetButton.style.cssText = 'font:12px monospace;cursor:pointer;margin-left:6px;';
    resetButton.addEventListener('click', () => {
      // Suppress saves first: location.reload() fires visibilitychange/pagehide
      // on the way out, and those handlers would otherwise re-persist the
      // world we're about to clear (see src/persist/store.ts suppressSaves).
      suppressSaves();
      void clearSave().then(() => location.reload());
    });
    buttons.appendChild(resetButton);

    this.root.appendChild(buttons);

    this.info = document.createElement('pre');
    this.info.style.cssText = 'margin:8px 0 0;white-space:pre-wrap;';
    this.root.appendChild(this.info);
    document.body.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        this.visible = !this.visible;
        this.root.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  /** Call once per rendered frame. */
  update(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastFpsTime = now;
    }
    if (!this.visible) return;

    const clock = getClock(this.state.tick);
    const lines = [
      `day ${clock.day}  ${clock.phase} (${Math.round(clock.phaseT * 100)}%)`,
      `tick ${this.state.tick}  speed ${this.loop.getSpeed()}x  fps ${this.fps}`,
      `creatures ${this.state.creatures.length}`,
    ];

    const c = this.state.creatures.find((x) => x.id === this.renderer.selectedId);
    if (c) {
      lines.push(
        '',
        `#${c.id} ${c.species} ${c.sex} ${c.stage} — ${c.activity.id} (${c.activity.ticks}t)`,
        `hunger ${bar(c.needs.hunger)}`,
        `rest   ${bar(c.needs.rest)}`,
        `social ${bar(c.needs.social)}`,
      );
      const fam = this.state.families.find((f) => f.id === c.familyId);
      if (fam) {
        const role = fam.parentIds.includes(c.id) ? 'parent' : 'child';
        lines.push(`family #${fam.id} — ${fam.phase} (${role})`);
      }
    } else {
      lines.push('', '(tap a creature to inspect)');
    }
    lines.push(`families ${this.state.families.length}  memorials ${this.state.memorials.length}`);
    this.info.textContent = lines.join('\n');
  }
}

function bar(v: number): string {
  const n = Math.round(v * 10);
  return '█'.repeat(n) + '░'.repeat(10 - n) + ` ${v.toFixed(2)}`;
}
