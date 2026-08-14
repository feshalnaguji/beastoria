/**
 * Dev panel (dev tool, not game UI): toggled with the backquote (~) key.
 * Speed control, clock readout, FPS, creature inspector via click.
 */
import { clearSave } from '../persist/store';
import { getClock } from '../sim/clock';
import type { WorldState } from '../sim/state';
import type { GameLoop } from './GameLoop';
import type { Renderer } from '../render/Renderer';

const SPEEDS = [1, 8, 64];

export class DevPanel {
  private root: HTMLDivElement;
  private info!: HTMLPreElement;
  private visible = false;
  private selectedId: number | null = null;
  private frames = 0;
  private fps = 0;
  private lastFpsTime = performance.now();
  private downAt: { x: number; y: number } | null = null;

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

    // Click (not drag) selects the nearest creature for inspection.
    const canvas = this.renderer.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      this.downAt = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      this.downAt = null;
      if (moved > 6) return; // it was a drag
      const picked = this.renderer.pickCreature(this.state, e.clientX, e.clientY);
      this.selectedId = picked ? picked.id : null;
      this.renderer.followId = this.selectedId; // click = inspect + follow
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

    const c = this.state.creatures.find((x) => x.id === this.selectedId);
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
      lines.push('', '(click a creature to inspect)');
    }
    lines.push(`families ${this.state.families.length}  memorials ${this.state.memorials.length}`);
    this.info.textContent = lines.join('\n');
  }
}

function bar(v: number): string {
  const n = Math.round(v * 10);
  return '█'.repeat(n) + '░'.repeat(10 - n) + ` ${v.toFixed(2)}`;
}
