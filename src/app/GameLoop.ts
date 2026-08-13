/**
 * Fixed-timestep accumulator binding the deterministic sim to rAF rendering.
 * The sim only ever advances in whole ticks; rendering interpolates by alpha.
 */
import { TICK_MS } from '../sim/Sim';

/** Cap how many ticks a single frame may run (tab jank guard; real catch-up is M7). */
const MAX_TICKS_PER_FRAME = 30;

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  constructor(
    private readonly onTick: () => void,
    private readonly onRender: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min(now - this.lastTime, MAX_TICKS_PER_FRAME * TICK_MS);
    this.lastTime = now;
    this.accumulator += elapsed;

    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.onTick();
    }

    this.onRender(this.accumulator / TICK_MS);
    requestAnimationFrame(this.frame);
  };
}
