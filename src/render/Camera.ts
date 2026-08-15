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
// Fraction of remaining distance closed per 16.67ms (~1 frame at 60fps).
// update() normalizes this by actual dt so pans/zooms feel the same at any
// frame rate instead of visibly lagging when frames run slow.
const DAMPING = 0.18;

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
   * Event handlers (wheel/pinch/centerOn) call this with no args, which reads
   * the canvas once for that single event; update() reads clientWidth/Height
   * once per frame and passes them in, avoiding repeat layout reads.
   */
  private minZoom(cw?: number, ch?: number): number {
    const w = cw ?? this.canvas.clientWidth;
    const h = ch ?? this.canvas.clientHeight;
    if (w <= 0 || h <= 0) return MIN_ZOOM_FALLBACK;
    return Math.max(w / WORLD_WIDTH, h / WORLD_HEIGHT);
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

  /**
   * Apply damping and write the transform. Call once per rendered frame.
   * @param dtMs milliseconds since the previous rendered frame, for
   * dt-normalized damping (so pan/zoom easing doesn't slow down when frames
   * run long — see DAMPING).
   */
  update(dtMs: number): void {
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;

    const k = 1 - Math.pow(1 - DAMPING, dtMs / 16.67);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;

    this.clampTarget(cw, ch);
    // Re-clamp the damped (actual) position/zoom too — without this, damping
    // overshoot on a hard drag/zoom could flash background for a frame even
    // though the target itself was always in bounds.
    this.zoom = clamp(this.zoom, this.minZoom(cw, ch), MAX_ZOOM);
    const halfW = cw / 2 / this.zoom;
    const halfH = ch / 2 / this.zoom;
    this.x = halfW * 2 >= WORLD_WIDTH ? WORLD_WIDTH / 2 : clamp(this.x, halfW, WORLD_WIDTH - halfW);
    this.y = halfH * 2 >= WORLD_HEIGHT ? WORLD_HEIGHT / 2 : clamp(this.y, halfH, WORLD_HEIGHT - halfH);

    this.world.scale.set(this.zoom);
    this.world.position.set(cw / 2 - this.x * this.zoom, ch / 2 - this.y * this.zoom);
  }

  /**
   * Keep the target strictly inside the world: at any zoom, the half-viewport
   * (in world units) can never push the visible edge past the world bounds.
   * This makes exposing background mathematically impossible, rather than a
   * fixed-margin approximation that broke down at low zoom on wide windows.
   */
  private clampTarget(cw: number, ch: number): void {
    this.targetZoom = clamp(this.targetZoom, this.minZoom(cw, ch), MAX_ZOOM);
    const halfW = cw / 2 / this.targetZoom;
    const halfH = ch / 2 / this.targetZoom;
    this.targetX = halfW * 2 >= WORLD_WIDTH ? WORLD_WIDTH / 2 : clamp(this.targetX, halfW, WORLD_WIDTH - halfW);
    this.targetY = halfH * 2 >= WORLD_HEIGHT ? WORLD_HEIGHT / 2 : clamp(this.targetY, halfH, WORLD_HEIGHT - halfH);
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
    const rect = this.canvas.getBoundingClientRect();
    // deltaMode: 0 = pixel (Chrome/Safari trackpads & most mice), 1 = line
    // (Firefox's default mouse-wheel unit — tiny raw deltaY values, nearly
    // inert without this), 2 = page. Normalize all three to an approximate
    // pixel delta before converting to a zoom factor.
    const px =
      e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * rect.height : e.deltaY;
    const factor = Math.exp(-px * 0.002);
    const newZoom = clamp(this.targetZoom * factor, this.minZoom(), MAX_ZOOM);

    // Zoom toward the cursor: keep the world point under it stationary.
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
