/**
 * Fixed-timestep accumulator binding the deterministic sim to rAF rendering.
 * The sim only ever advances in whole ticks; rendering interpolates by alpha.
 * Speed multiplier scales elapsed wall time — the sim itself knows only ticks.
 */
import { TICK_MS } from '../sim/Sim';

/** Cap how many ticks a single frame may run at 1x (tab jank guard; real catch-up is M7). */
const MAX_TICKS_PER_FRAME = 30;

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private speed = 1;

  constructor(
    private readonly onTick: () => void,
    private readonly onRender: (alpha: number) => void,
  ) {}

  /** Dev/presentation speed multiplier (1, 8, 64…). */
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getSpeed(): number {
    return this.speed;
  }

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
    const budget = MAX_TICKS_PER_FRAME * this.speed * TICK_MS;
    const elapsed = Math.min((now - this.lastTime) * this.speed, budget);
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
