/**
 * Camera: drag-pan (mouse/touch), wheel zoom at cursor, two-finger pinch zoom.
 * Damped toward target values each frame for a calm, floaty feel.
 */
import type { Container } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../sim/state';

// Fallback only, used before the canvas has laid out (clientWidth/Height == 0).
// The real floor is computed dynamically per frame from the viewport — see minZoom().
const MIN_ZOOM_FALLBACK = 0.15;
const MAX_ZOOM = 3.0;
const DAMPING = 0.18; // fraction of remaining distance per frame

export class Camera {
  /** Camera center, in world coordinates. */
  private targetX = WORLD_WIDTH / 2;
  private targetY = WORLD_HEIGHT / 2;
  private targetZoom = 0.6;
  private x = this.targetX;
  private y = this.targetY;
  private zoom = this.targetZoom;

  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;

  constructor(
    private readonly world: Container,
    private readonly canvas: HTMLCanvasElement,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  centerOn(x: number, y: number, zoom?: number): void {
    this.targetX = x;
    this.targetY = y;
    if (zoom !== undefined) this.targetZoom = clamp(zoom, this.minZoom(), MAX_ZOOM);
  }

  /**
   * Lowest zoom that still keeps the world covering the full viewport (no
   * background exposed past the world edge). Recomputed from the canvas's
   * current size, so it tracks window resizes and device rotation without a
   * separate resize listener — update() runs every rendered frame anyway.
   */
  private minZoom(): number {
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return MIN_ZOOM_FALLBACK;
    return Math.max(cw / WORLD_WIDTH, ch / WORLD_HEIGHT);
  }

  /** Convert screen (client) coordinates to world coordinates. */
  toWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.x + (screenX - rect.left - rect.width / 2) / this.zoom,
      y: this.y + (screenY - rect.top - rect.height / 2) / this.zoom,
    };
  }

  getZoom(): number {
    return this.zoom;
  }

  /** Apply damping and write the transform. Call once per rendered frame. */
  update(): void {
    this.x += (this.targetX - this.x) * DAMPING;
    this.y += (this.targetY - this.y) * DAMPING;
    this.zoom += (this.targetZoom - this.zoom) * DAMPING;
    this.clampTarget();

    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    this.world.scale.set(this.zoom);
    this.world.position.set(cw / 2 - this.x * this.zoom, ch / 2 - this.y * this.zoom);
  }

  private clampTarget(): void {
    // Keep the view centered inside the world with a soft margin.
    const margin = 200;
    this.targetX = clamp(this.targetX, -margin, WORLD_WIDTH + margin);
    this.targetY = clamp(this.targetY, -margin, WORLD_HEIGHT + margin);
    // Re-clamp zoom every frame too: a resize/rotation can raise the min-zoom
    // floor above whatever zoom was previously in effect.
    this.targetZoom = clamp(this.targetZoom, this.minZoom(), MAX_ZOOM);
  }

  private onPointerDown = (e: PointerEvent): void => {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Pointer may already be released (e.g. synthetic events) — pan still works.
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const curr = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, curr);

    if (this.pointers.size === 1) {
      // Drag pan.
      this.targetX -= (curr.x - prev.x) / this.zoom;
      this.targetY -= (curr.y - prev.y) / this.zoom;
    } else if (this.pointers.size === 2) {
      // Pinch zoom.
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastPinchDist !== null && this.lastPinchDist > 0) {
        this.targetZoom = clamp(this.targetZoom * (dist / this.lastPinchDist), this.minZoom(), MAX_ZOOM);
      }
      this.lastPinchDist = dist;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinchDist = null;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newZoom = clamp(this.targetZoom * factor, this.minZoom(), MAX_ZOOM);

    // Zoom toward the cursor: keep the world point under it stationary.
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldX = this.x + (sx - rect.width / 2) / this.zoom;
    const worldY = this.y + (sy - rect.height / 2) / this.zoom;
    this.targetX = worldX - (sx - rect.width / 2) / newZoom;
    this.targetY = worldY - (sy - rect.height / 2) / newZoom;
    this.targetZoom = newZoom;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
